# Design Document: Pincode API Production Hardening

## Overview

This design implements production hardening for the pincode API system to handle 10k-100k users reliably. The system currently functions well in development but requires hardening in seven critical areas to ensure production readiness: cache TTL optimization, architecture compliance, rate limiting, database timeout protection, structured logging, state normalization, and cache abstraction.

The hardening maintains the existing clean architecture where the resolver layer handles data retrieval (WHERE the user is) and the service layer handles business logic (WHETHER delivery is available). All changes are backward compatible with the existing API contract.

### Critical Production Fixes Applied

This design incorporates critical production-safety improvements identified during senior engineering review:

1. **Rate Limiter Redis Migration Path**: Memory-based rate limiting breaks with multiple instances. Added mandatory Redis migration path for horizontal scaling.

2. **Cache TTL Single Source of Truth**: Eliminated TTL duplication bug risk by storing `expiresAt` timestamp directly with cached values instead of separate timestamp map.

3. **Correct Graceful Degradation Order**: Fixed data source priority to Cache → MongoDB (primary) → CSV (fallback only). CSV never overrides MongoDB.

4. **Circuit Breaker for Cascading Failure Prevention**: Added simple circuit breaker to prevent thread exhaustion when MongoDB becomes slow (opens after 5 failures for 30 seconds).

5. **Log Sampling for Cost Control**: Implemented 10% sampling for info logs to prevent log explosion at scale (10k req/min → 60k logs/hour instead of 600k). Errors and warnings always logged.

6. **Simplified CSV Testing**: Reduced over-engineering of CSV parser property tests since CSV is fallback only, not primary runtime path.

These fixes elevate the system from "startup production-ready" (95%) to "real production-ready" (98%) for 10k-100k users.

### Design Goals

1. Reduce cache TTL from 24 hours to 10 minutes for faster business logic updates
2. Enforce architectural separation between data and business logic layers
3. Protect against DDoS attacks and abuse with rate limiting
4. Prevent API freezes from slow database queries with timeout protection
5. Enable production log aggregation with structured JSON logging
6. Ensure consistent state name comparisons with centralized normalization
7. Abstract cache implementation for future Redis migration

### Non-Goals

- Distance-based delivery logic (deferred to future iteration)
- Redis cache implementation (interface only, implementation deferred)
- Multi-store support (future enhancement)
- Breaking changes to API contract

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Application                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP Request
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Rate Limiter Middleware                   │
│  - 100 requests/minute per IP                                │
│  - Returns 429 on limit exceeded                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Pincode Controller (API)                    │
│  - Validates pincode format                                  │
│  - Calls resolver for location data                          │
│  - Calls service for deliverability                          │
│  - Returns unified response                                  │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             │ Get location data             │ Check deliverability
             ▼                               ▼
┌──────────────────────────────┐  ┌──────────────────────────┐
│    Pincode Resolver          │  │   Delivery Service       │
│  - Checks cache (10min TTL)  │  │  - State normalization   │
│  - Queries CSV/MongoDB       │  │  - Business logic        │
│  - Returns location only     │  │  - Returns boolean       │
│  - Uses timeout wrapper      │  └──────────────────────────┘
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      Cache Service           │
│  - Interface abstraction     │
│  - InMemoryCache impl        │
│  - 10-minute TTL             │
│  - Promise-based API         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│   DB Timeout Wrapper         │
│  - 2-second timeout          │
│  - Promise.race pattern      │
│  - Graceful degradation      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│   Data Sources               │
│  - CSV (ap_telangana)        │
│  - MongoDB (full India)      │
└──────────────────────────────┘

         Cross-Cutting Concerns
┌──────────────────────────────────────────────────────────────┐
│                  Structured Logger                            │
│  - JSON format output                                         │
│  - ISO 8601 timestamps                                        │
│  - Event, environment, service fields                         │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Successful Pincode Lookup (Cache Hit)

```
Client → Rate Limiter → Controller → Resolver → Cache Service
                                                    ↓ (hit)
Client ← Controller ← Delivery Service ← Resolver ← Cache
```

#### Successful Pincode Lookup (Cache Miss)

```
Client → Rate Limiter → Controller → Resolver → Cache Service
                                                    ↓ (miss)
                                                 CSV/MongoDB
                                                    ↓
Client ← Controller ← Delivery Service ← Resolver ← Data
                                                    ↓
                                                 Cache (store)
```

#### Database Timeout Scenario

```
Client → Rate Limiter → Controller → Resolver → Timeout Wrapper → MongoDB
                                                    ↓ (timeout after 2s)
Client ← Controller ← Resolver ← Cache (fallback) or null
```

## Components and Interfaces

### 1. Cache Service

**Purpose**: Abstract cache implementation to support future Redis migration without code changes.

**Interface**:
```typescript
interface CacheService {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

**Implementation: InMemoryCacheService**:
```typescript
interface CacheEntry {
  value: any;
  expiresAt: number; // Unix timestamp when entry expires
}

class InMemoryCacheService implements CacheService {
  private cache: Map<string, CacheEntry>;
  private readonly cleanupIntervalMs: number;

  constructor() {
    this.cache = new Map();
    this.cleanupIntervalMs = 60 * 60 * 1000; // 1 hour
    this.startCleanupInterval();
  }

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Single source of truth: check expiresAt
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  private startCleanupInterval(): void {
    setInterval(() => this.clearExpired(), this.cleanupIntervalMs);
  }

  private clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
```

**Factory Function**:
```typescript
export const createCacheService = (): CacheService => {
  // Future: Check for Redis configuration
  // if (process.env.REDIS_URL) {
  //   return new RedisCacheService();
  // }
  return new InMemoryCacheService();
};
```

**Key Design Decisions**:
- All methods return Promises for async compatibility with Redis
- Single source of truth: expiresAt timestamp stored with value (prevents TTL duplication bugs)
- Cleanup interval runs hourly to prevent memory leaks
- Factory pattern enables zero-code-change Redis migration

### 2. Rate Limiter Middleware

**Purpose**: Protect API from abuse, DDoS attacks, and cost explosion.

**Implementation**:
```typescript
import rateLimit from 'express-rate-limit';

export const pincodeRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute per IP
  message: 'Too many requests, please try again later',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res) => {
    logger.warn('RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      endpoint: req.path,
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
    });
  },
});
```

**Application**:
```typescript
// In pincodeRoutes.ts
router.get('/check/:pincode', pincodeRateLimiter, checkPincodeController);
```

**Rate Limit Headers**:
- `RateLimit-Limit`: Maximum requests allowed (100)
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Timestamp when the window resets

**Key Design Decisions**:
- Per-IP limiting prevents single source abuse
- 100 requests/minute balances protection and usability
- Standard headers enable client-side rate limit handling
- Custom handler logs abuse attempts for monitoring

**CRITICAL PRODUCTION WARNING**:
The memory-based rate limiter (express-rate-limit default store) is NOT production-safe for multi-instance deployments:
- Server restart → rate limit state lost
- Multiple instances → inconsistent limits (User can hit Instance A 100x + Instance B 100x = 200 total)
- Load balancer → broken behavior

**Phase 2 Migration (MANDATORY for horizontal scaling)**:
```typescript
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const pincodeRateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:pincode:',
  }),
  windowMs: 1 * 60 * 1000,
  max: 100,
  // ... rest of config
});
```

**When to migrate**: Before deploying multiple instances or behind load balancer

### 3. Database Timeout Wrapper

**Purpose**: Prevent API freezes from slow or hanging database queries.

**Implementation**:
```typescript
// Simple circuit breaker state
let dbFailureCount = 0;
let circuitOpenUntil = 0;
const FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_DURATION_MS = 30000; // 30 seconds

export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number = 2000,
  operation: string = 'Database query'
): Promise<T> => {
  // Circuit breaker: skip DB if too many failures
  if (Date.now() < circuitOpenUntil) {
    return Promise.reject(new Error(`Circuit breaker open for ${operation}`));
  }

  const timeoutPromise = new Promise<T>((_, reject) =>
    setTimeout(
      () => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)),
      timeoutMs
    )
  );

  return Promise.race([promise, timeoutPromise])
    .then((result) => {
      // Success: reset failure count
      dbFailureCount = 0;
      return result;
    })
    .catch((error) => {
      // Failure: increment counter
      dbFailureCount++;
      
      // Open circuit if threshold exceeded
      if (dbFailureCount >= FAILURE_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
        logError('CIRCUIT_BREAKER_OPEN', {
          operation,
          failureCount: dbFailureCount,
          openDuration: CIRCUIT_OPEN_DURATION_MS,
        });
      }
      
      throw error;
    });
};
```

**Usage in Resolver**:
```typescript
try {
  const pincodeData = await withTimeout(
    Pincode.findOne({ pincode }),
    2000,
    'Pincode lookup'
  );
  
  if (!pincodeData) return null;
  
  // Process data...
} catch (error) {
  if (error instanceof Error && error.message.includes('timeout')) {
    logError('DB_TIMEOUT', {
      pincode,
      operation: 'Pincode lookup',
      timestamp: new Date().toISOString(),
    });
    
    // Graceful degradation: return null
    return null;
  }
  
  if (error instanceof Error && error.message.includes('Circuit breaker')) {
    logWarn('CIRCUIT_BREAKER_SKIP', {
      pincode,
      operation: 'Pincode lookup',
    });
    
    // Skip DB, use cache or return null
    return null;
  }
  
  throw error;
}
```

**Key Design Decisions**:
- 2-second timeout balances responsiveness and query completion
- Promise.race pattern is simple and reliable
- Graceful degradation returns null instead of throwing
- Timeout errors are logged for monitoring
- Generic implementation works for any Promise-based operation
- **Circuit breaker prevents cascading failures**: After 5 failures, skip DB for 30 seconds to prevent thread exhaustion

### 4. Structured Logger

**Purpose**: Enable production log aggregation and querying in tools like ELK, Datadog, CloudWatch.

**Implementation**:
```typescript
interface LogEntry {
  event: string;
  timestamp: string;
  environment: string;
  service: string;
  [key: string]: any;
}

// Log sampling rate (10% for info logs, 100% for warn/error)
const LOG_SAMPLE_RATE = 0.1;

export const structuredLog = (
  level: 'info' | 'warn' | 'error',
  event: string,
  data?: Record<string, any>
): void => {
  // Sample info logs to prevent log explosion at scale
  if (level === 'info' && Math.random() > LOG_SAMPLE_RATE) {
    return; // Skip this log (90% of info logs dropped)
  }
  
  const entry: LogEntry = {
    event,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    service: 'pincode-api',
    level,
    ...data,
  };
  
  const output = JSON.stringify(entry);
  
  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
};

// Convenience methods
export const logInfo = (event: string, data?: Record<string, any>) =>
  structuredLog('info', event, data);

export const logWarn = (event: string, data?: Record<string, any>) =>
  structuredLog('warn', event, data);

export const logError = (event: string, data?: Record<string, any>) =>
  structuredLog('error', event, data);
```

**Usage Examples**:
```typescript
// Cache hit (sampled at 10%)
logInfo('PINCODE_CACHE_HIT', {
  pincode: '500001',
  duration: 5,
});

// Database timeout (always logged)
logError('DB_TIMEOUT', {
  pincode: '500001',
  operation: 'Pincode lookup',
  timeoutMs: 2000,
});

// Rate limit exceeded (always logged)
logWarn('RATE_LIMIT_EXCEEDED', {
  ip: '192.168.1.1',
  endpoint: '/api/pincode/check/500001',
});
```

**Log Format Example**:
```json
{
  "event": "PINCODE_CACHE_HIT",
  "timestamp": "2024-03-31T10:30:45.123Z",
  "environment": "production",
  "service": "pincode-api",
  "level": "info",
  "pincode": "500001",
  "duration": 5
}
```

**Key Design Decisions**:
- JSON format is parseable by all log aggregation tools
- ISO 8601 timestamps are universally compatible
- Required fields (event, timestamp, environment, service) enable filtering
- Convenience methods reduce boilerplate
- Replaces all console.log calls in pincode-related code
- **Log sampling prevents cost explosion**: 10% sampling for info logs (10k req/min → 60k logs/hour instead of 600k)
- **Always log errors and warnings**: Critical events never sampled

### 5. State Normalizer

**Purpose**: Ensure consistent state name comparisons across the codebase.

**Current Implementation** (already exists in deliveryService.ts):
```typescript
export const normalizeState = (state: string): string => {
  return state.trim().toLowerCase();
};
```

**Usage**:
```typescript
// In deliveryService.ts
export const isDeliverableState = (state: string | undefined): boolean => {
  if (!state) return false;
  
  const normalized = normalizeState(state);
  return normalized === 'andhra pradesh' || normalized === 'telangana';
};

// In pincodeResolver.ts (when processing data)
const state = normalizeState(String(pincodeData.state).trim());
```

**Key Design Decisions**:
- Already implemented and working correctly
- Centralized in deliveryService.ts for single source of truth
- Handles whitespace and case variations
- Used consistently in resolver and service layers

### 6. Pincode Resolver Updates

**Current Issues**:
- Cache TTL is 24 hours (too long)
- Uses direct Map access instead of abstraction
- Contains some console.log instead of structured logging

**Updated Implementation**:
```typescript
import { createCacheService } from '../services/cacheService';
import { withTimeout } from '../utils/dbHelpers';
import { logInfo, logError, logWarn } from '../utils/structuredLogger';

const cacheService = createCacheService();
const CACHE_TTL_SECONDS = 600; // 10 minutes

export const resolvePincodeDetails = async (
  pincode: string
): Promise<ResolvedPincodeDetails | null> => {
  if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) return null;

  const startTime = Date.now();

  // 1. Check cache first
  const cached = await cacheService.get(`pincode:${pincode}`);
  if (cached) {
    logInfo('PINCODE_CACHE_HIT', {
      pincode,
      duration: Date.now() - startTime,
    });
    return cached;
  }

  // 2. Try MongoDB (primary source) with timeout protection
  try {
    const pincodeData = await withTimeout(
      Pincode.findOne({ pincode }),
      2000,
      'Pincode lookup'
    );
    
    if (pincodeData && pincodeData.state) {
      const result = {
        state: String(pincodeData.state).trim(),
        postal_district: String(pincodeData.district || "").trim(),
        cities: [pincodeData.taluka].filter(Boolean) as string[],
        single_city: pincodeData.taluka || null,
      };
      
      await cacheService.set(`pincode:${pincode}`, result, CACHE_TTL_SECONDS);
      
      logInfo('PINCODE_LOOKUP', {
        pincode,
        source: 'MongoDB',
        cacheHit: false,
        found: true,
        duration: Date.now() - startTime,
      });
      
      return result;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      logError('DB_TIMEOUT', {
        pincode,
        operation: 'Pincode lookup',
        duration: Date.now() - startTime,
      });
      // Fall through to CSV fallback
    } else if (error instanceof Error && error.message.includes('Circuit breaker')) {
      logWarn('CIRCUIT_BREAKER_SKIP', {
        pincode,
        operation: 'Pincode lookup',
      });
      // Fall through to CSV fallback
    } else {
      logError('PINCODE_LOOKUP_ERROR', {
        pincode,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      // Fall through to CSV fallback
    }
  }

  // 3. Fallback to CSV (only when MongoDB fails)
  const csvIndex = await getCsvMetaIndex();
  const meta = csvIndex.get(pincode);
  if (meta) {
    const result = {
      state: meta.state,
      postal_district: meta.postal_district || "",
      cities: Array.from(meta.cities),
      single_city: meta.cities.size === 1 ? Array.from(meta.cities)[0] : null,
    };
    
    await cacheService.set(`pincode:${pincode}`, result, CACHE_TTL_SECONDS);
    
    logInfo('PINCODE_LOOKUP', {
      pincode,
      source: 'CSV_FALLBACK',
      cacheHit: false,
      duration: Date.now() - startTime,
    });
    
    return result;
  }

  // 4. Not found anywhere
  logWarn('PINCODE_NOT_FOUND', {
    pincode,
    duration: Date.now() - startTime,
  });
  return null;
};
```

**Key Changes**:
- Uses CacheService interface instead of direct Map
- Cache TTL reduced to 10 minutes (600 seconds)
- All logging uses structured logger with sampling
- Database queries wrapped with timeout protection and circuit breaker
- Returns only location data (no deliverability logic)
- **Correct graceful degradation order**: Cache → MongoDB (primary) → CSV (fallback only) → null
- CSV never overrides MongoDB (architectural correctness)

### 7. Controller Updates

**Current State**: Controller already has good separation - calls resolver for location data and service for deliverability.

**Minor Updates Needed**:
```typescript
import { logInfo, logWarn, logError } from '../utils/structuredLogger';

export const checkPincodeController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { pincode } = req.params;
    const startTime = Date.now();

    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      logWarn('INVALID_PINCODE_FORMAT', { pincode });
      res.status(200).json({
        deliverable: false,
        message: "Not deliverable to this location or pincode",
      });
      return;
    }

    // Get location data from resolver (WHERE)
    const resolved = await resolvePincodeDetails(pincode);
    
    if (resolved) {
      const admin_district = applyDistrictOverride(
        resolved.state,
        resolved.postal_district
      );

      // Get deliverability from service (WHETHER)
      const deliverable = checkDeliveryAvailability(resolved.state);

      logInfo('PINCODE_CHECK', {
        pincode,
        state: resolved.state,
        deliverable,
        duration: Date.now() - startTime,
      });

      res.status(200).json({
        deliverable,
        state: resolved.state,
        postal_district: resolved.postal_district,
        admin_district,
        cities: resolved.cities,
        single_city: resolved.single_city,
        message: deliverable
          ? undefined
          : "Not deliverable to this location or pincode",
      });
      return;
    }

    logWarn('PINCODE_NOT_FOUND', { pincode });
    res.status(200).json({
      deliverable: false,
      message: "Not deliverable to this location or pincode",
    });
  } catch (error) {
    logError('PINCODE_CHECK_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      deliverable: false,
      message: "Internal server error",
    });
  }
};
```

**Key Changes**:
- Uses structured logger instead of logger.info/warn/error
- Maintains clean separation: resolver for location, service for deliverability
- No breaking changes to response format

## Data Models

### Cache Entry

```typescript
interface CacheEntry {
  value: ResolvedPincodeDetails;  // The cached data
  expiresAt: number;              // Unix timestamp when entry expires (single source of truth)
}
```

### Resolved Pincode Details

```typescript
interface ResolvedPincodeDetails {
  state: string;              // e.g., "Telangana"
  postal_district: string;    // e.g., "Hyderabad"
  cities: string[];           // e.g., ["Hyderabad", "Secunderabad"]
  single_city: string | null; // Non-null if cities.length === 1
}
```

### Rate Limit State

```typescript
interface RateLimitState {
  ip: string;           // Client IP address
  count: number;        // Request count in current window
  resetTime: number;    // Unix timestamp when window resets
}
```

### Log Entry

```typescript
interface LogEntry {
  event: string;        // Event name (e.g., "PINCODE_CACHE_HIT")
  timestamp: string;    // ISO 8601 format
  environment: string;  // "development" | "production"
  service: string;      // "pincode-api"
  level: string;        // "info" | "warn" | "error"
  [key: string]: any;   // Event-specific data
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Expired Cache Entries Are Not Returned

*For any* pincode lookup, if a cached entry exists but its age exceeds 10 minutes (600 seconds), the cache service SHALL NOT return the cached value and SHALL evict the entry from cache.

**Validates: Requirements 1.2, 1.3**

### Property 2: Resolver Returns Only Location Data

*For any* successful pincode lookup result from the resolver, the returned object SHALL contain only location fields (state, postal_district, cities, single_city) and SHALL NOT contain any deliverability determination fields (deliverable, message).

**Validates: Requirements 2.1**

### Property 3: Rate Limiter Enforces Request Limits

*For any* IP address, when more than 100 requests are made to the rate-limited endpoint within a 1-minute window, all requests after the 100th SHALL be rejected with HTTP 429 status, and the request count SHALL reset after the 1-minute window expires.

**Validates: Requirements 3.1, 3.3**

### Property 4: Rate Limiter Includes Standard Headers

*For any* response from a rate-limited endpoint, the response SHALL include the headers RateLimit-Limit, RateLimit-Remaining, and RateLimit-Reset with valid values.

**Validates: Requirements 3.4**

### Property 5: Database Timeout Enforced

*For any* MongoDB query wrapped with the timeout wrapper, if the query execution time exceeds 2 seconds, the wrapper SHALL reject the promise with a timeout error.

**Validates: Requirements 4.1**

### Property 6: Timeout Errors Return Null

*For any* timeout error that occurs during pincode lookup, the resolver SHALL log the timeout event and return null for graceful degradation.

**Validates: Requirements 4.3**

### Property 7: Structured Logs Are Valid JSON

*For any* log entry produced by the structured logger, the output SHALL be valid JSON that can be parsed without errors.

**Validates: Requirements 5.1**

### Property 8: Structured Logs Contain Required Fields

*For any* log entry produced by the structured logger, the JSON object SHALL contain the fields: event, timestamp, environment, service, and level.

**Validates: Requirements 5.2**

### Property 9: Timestamps Use ISO 8601 Format

*For any* log entry produced by the structured logger, the timestamp field SHALL match the ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ).

**Validates: Requirements 5.3**

### Property 10: State Normalization Removes Whitespace and Converts to Lowercase

*For any* state name string, applying the normalizeState function SHALL produce a result that has no leading or trailing whitespace and all characters are lowercase.

**Validates: Requirements 6.1, 6.2**

### Property 11: Cache Service Returns Promises

*For any* cache service operation (get, set, delete, clear), the method SHALL return a Promise to support future async implementations.

**Validates: Requirements 7.5**

### Property 12: API Response Time Under Failure

*For any* failure condition (database timeout, connection failure), the API SHALL respond within 3 seconds.

**Validates: Requirements 8.4**

### Property 13: API Response Format Maintained

*For any* successful pincode check request to /api/pincode/check/:pincode, the response SHALL contain the fields: deliverable, state, postal_district, admin_district, cities, single_city, and message (optional).

**Validates: Requirements 9.1, 9.2**

### Property 14: CSV Parser Produces Valid Objects

*For any* valid CSV row with pincode, state, and district fields, the CSV parser SHALL produce a structured object where state and district fields are non-empty strings and UTF-8 encoded state names are preserved correctly.

**Validates: Requirements 10.1, 10.3, 10.4**

### Property 15: CSV Parser Skips Invalid Rows

*For any* invalid CSV row (missing required fields or malformed pincode), the CSV parser SHALL skip the row and continue processing subsequent rows.

**Validates: Requirements 10.2**

## Error Handling

### Error Categories

#### 1. Client Errors (4xx)

**Invalid Pincode Format**:
- Trigger: Pincode is not 6 digits or contains non-numeric characters
- Response: HTTP 200 with `deliverable: false`
- Message: "Not deliverable to this location or pincode"
- Logging: WARN level with `INVALID_PINCODE_FORMAT` event

**Rate Limit Exceeded**:
- Trigger: IP exceeds 100 requests in 1-minute window
- Response: HTTP 429
- Message: "Too many requests, please try again later"
- Headers: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
- Logging: WARN level with `RATE_LIMIT_EXCEEDED` event

#### 2. Server Errors (5xx)

**Database Timeout**:
- Trigger: MongoDB query exceeds 2-second timeout
- Fallback: Return cached data if available, otherwise null
- Response: HTTP 200 with `deliverable: false` (graceful degradation)
- Logging: ERROR level with `DB_TIMEOUT` event

**Database Connection Failure**:
- Trigger: MongoDB connection unavailable
- Fallback: Use CSV data source if available
- Response: HTTP 200 with data from CSV or `deliverable: false`
- Logging: ERROR level with `DB_CONNECTION_FAILED` event

**Unexpected Server Error**:
- Trigger: Unhandled exception in controller
- Response: HTTP 500
- Message: "Internal server error"
- Logging: ERROR level with `PINCODE_CHECK_ERROR` event

### Error Handling Strategy

#### Graceful Degradation Hierarchy

```
1. Primary: Cache (10-minute TTL)
   ↓ (on cache miss)
2. Secondary: MongoDB with timeout protection (2s) and circuit breaker
   ↓ (on timeout, circuit open, or failure)
3. Tertiary: CSV data source (fallback only, never overrides MongoDB)
   ↓ (if no CSV or not found)
4. Final: Return deliverable=false with message
```

**CRITICAL**: CSV is fallback only. MongoDB is the primary source of truth.

#### Timeout Protection Pattern

```typescript
try {
  const result = await withTimeout(
    databaseQuery(),
    2000,
    'Operation name'
  );
  // Process result
} catch (error) {
  if (error instanceof Error && error.message.includes('timeout')) {
    logError('DB_TIMEOUT', { operation: 'Operation name' });
    // Graceful degradation
    return fallbackValue;
  }
  throw error; // Re-throw non-timeout errors
}
```

#### Rate Limit Error Response

```json
{
  "success": false,
  "message": "Too many requests, please try again later"
}
```

Headers:
```
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 1711891200
```

### Error Logging Format

All errors are logged in structured JSON format:

```json
{
  "event": "DB_TIMEOUT",
  "timestamp": "2024-03-31T10:30:45.123Z",
  "environment": "production",
  "service": "pincode-api",
  "level": "error",
  "pincode": "500001",
  "operation": "Pincode lookup",
  "timeoutMs": 2000,
  "duration": 2001
}
```

### Monitoring and Alerting

**Critical Errors** (require immediate attention):
- Database timeout rate > 5% of requests
- Rate limit exceeded rate > 10% of requests
- Server error rate > 1% of requests

**Warning Conditions** (require investigation):
- Cache miss rate > 50%
- Average response time > 500ms
- Invalid pincode rate > 20% of requests

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing

**Library**: fast-check (for TypeScript/Node.js)

**Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: pincode-api-production-hardening, Property {number}: {property_text}`

**Property Test Examples**:

#### Property 1: Expired Cache Entries

```typescript
import fc from 'fast-check';

// Feature: pincode-api-production-hardening, Property 1: Expired cache entries are not returned
test('expired cache entries are not returned', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s)),
      async (pincode) => {
        const cacheService = new InMemoryCacheService();
        const data = { state: 'Telangana', postal_district: 'Hyderabad', cities: [], single_city: null };
        
        // Set cache entry
        await cacheService.set(`pincode:${pincode}`, data, 600);
        
        // Simulate time passing (11 minutes)
        jest.advanceTimersByTime(11 * 60 * 1000);
        
        // Should return null (expired)
        const result = await cacheService.get(`pincode:${pincode}`);
        expect(result).toBeNull();
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 3: Rate Limiter Enforces Limits

```typescript
// Feature: pincode-api-production-hardening, Property 3: Rate limiter enforces request limits
test('rate limiter enforces 100 requests per minute', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.ipV4(),
      async (ip) => {
        // Make 100 requests (should succeed)
        for (let i = 0; i < 100; i++) {
          const res = await request(app)
            .get('/api/pincode/check/500001')
            .set('X-Forwarded-For', ip);
          expect(res.status).toBe(200);
        }
        
        // 101st request should be rate limited
        const res = await request(app)
          .get('/api/pincode/check/500001')
          .set('X-Forwarded-For', ip);
        expect(res.status).toBe(429);
        
        // After 1 minute, should reset
        jest.advanceTimersByTime(61 * 1000);
        const resAfterReset = await request(app)
          .get('/api/pincode/check/500001')
          .set('X-Forwarded-For', ip);
        expect(resAfterReset.status).toBe(200);
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 7: Structured Logs Are Valid JSON

```typescript
// Feature: pincode-api-production-hardening, Property 7: Structured logs are valid JSON
test('structured logs produce valid JSON', () => {
  fc.assert(
    fc.property(
      fc.string(),
      fc.record({
        pincode: fc.string(),
        duration: fc.nat(),
      }),
      (event, data) => {
        // Capture console output
        const originalLog = console.log;
        let output = '';
        console.log = (msg: string) => { output = msg; };
        
        logInfo(event, data);
        
        console.log = originalLog;
        
        // Should be valid JSON
        expect(() => JSON.parse(output)).not.toThrow();
        
        // Should contain required fields
        const parsed = JSON.parse(output);
        expect(parsed).toHaveProperty('event');
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('environment');
        expect(parsed).toHaveProperty('service');
        expect(parsed).toHaveProperty('level');
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 10: State Normalization

```typescript
// Feature: pincode-api-production-hardening, Property 10: State normalization removes whitespace and converts to lowercase
test('state normalization removes whitespace and converts to lowercase', () => {
  fc.assert(
    fc.property(
      fc.string().filter(s => s.length > 0),
      (state) => {
        const normalized = normalizeState(state);
        
        // Should have no leading/trailing whitespace
        expect(normalized).toBe(normalized.trim());
        
        // Should be lowercase
        expect(normalized).toBe(normalized.toLowerCase());
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing

**Focus Areas**:
- Specific examples of cache expiration
- Rate limiter behavior at boundary (100th, 101st request)
- Database timeout at exactly 2 seconds
- Specific error messages and status codes
- Integration between controller, resolver, and service

**Example Unit Tests**:

```typescript
describe('Cache Service', () => {
  test('returns cached data within TTL', async () => {
    const cache = new InMemoryCacheService();
    await cache.set('test', { value: 'data' }, 600);
    
    const result = await cache.get('test');
    expect(result).toEqual({ value: 'data' });
  });
  
  test('returns null for expired data', async () => {
    const cache = new InMemoryCacheService();
    await cache.set('test', { value: 'data' }, 600);
    
    jest.advanceTimersByTime(11 * 60 * 1000); // 11 minutes
    
    const result = await cache.get('test');
    expect(result).toBeNull();
  });
});

describe('Database Timeout Wrapper', () => {
  test('resolves when query completes within timeout', async () => {
    const fastQuery = new Promise(resolve => setTimeout(() => resolve('data'), 1000));
    
    const result = await withTimeout(fastQuery, 2000);
    expect(result).toBe('data');
  });
  
  test('rejects when query exceeds timeout', async () => {
    const slowQuery = new Promise(resolve => setTimeout(() => resolve('data'), 3000));
    
    await expect(withTimeout(slowQuery, 2000)).rejects.toThrow('timeout');
  });
});

describe('Rate Limiter', () => {
  test('allows 100 requests from same IP', async () => {
    for (let i = 0; i < 100; i++) {
      const res = await request(app)
        .get('/api/pincode/check/500001')
        .set('X-Forwarded-For', '192.168.1.1');
      expect(res.status).toBe(200);
    }
  });
  
  test('blocks 101st request with 429', async () => {
    // Make 100 requests
    for (let i = 0; i < 100; i++) {
      await request(app)
        .get('/api/pincode/check/500001')
        .set('X-Forwarded-For', '192.168.1.2');
    }
    
    // 101st should be blocked
    const res = await request(app)
      .get('/api/pincode/check/500001')
      .set('X-Forwarded-For', '192.168.1.2');
    
    expect(res.status).toBe(429);
    expect(res.body.message).toBe('Too many requests, please try again later');
  });
});

describe('Structured Logger', () => {
  test('outputs valid JSON with required fields', () => {
    const originalLog = console.log;
    let output = '';
    console.log = (msg: string) => { output = msg; };
    
    logInfo('TEST_EVENT', { key: 'value' });
    
    console.log = originalLog;
    
    const parsed = JSON.parse(output);
    expect(parsed.event).toBe('TEST_EVENT');
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(parsed.environment).toBeDefined();
    expect(parsed.service).toBe('pincode-api');
    expect(parsed.level).toBe('info');
    expect(parsed.key).toBe('value');
  });
});

describe('Pincode Controller Integration', () => {
  test('calls resolver and service separately', async () => {
    const resolveSpy = jest.spyOn(resolver, 'resolvePincodeDetails');
    const serviceSpy = jest.spyOn(deliveryService, 'checkDeliveryAvailability');
    
    await request(app).get('/api/pincode/check/500001');
    
    expect(resolveSpy).toHaveBeenCalledWith('500001');
    expect(serviceSpy).toHaveBeenCalled();
  });
  
  test('returns correct response format', async () => {
    const res = await request(app).get('/api/pincode/check/500001');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('deliverable');
    expect(res.body).toHaveProperty('state');
    expect(res.body).toHaveProperty('postal_district');
    expect(res.body).toHaveProperty('admin_district');
    expect(res.body).toHaveProperty('cities');
    expect(res.body).toHaveProperty('single_city');
  });
});
```

### Edge Cases and Error Conditions

**Edge Cases to Test**:
- Cache entry at exactly 10 minutes age (boundary)
- Exactly 100th request (should succeed)
- Exactly 101st request (should fail)
- Database query at exactly 2 seconds (boundary)
- Empty state name in normalization
- Pincode with leading zeros (e.g., "000001")
- Concurrent cache access from multiple requests

**Error Conditions to Test**:
- MongoDB connection completely unavailable
- CSV file missing or corrupted
- Invalid JSON in log output (should never happen)
- Rate limiter with invalid IP address
- Timeout wrapper with negative timeout value

### Test Coverage Goals

- **Line Coverage**: > 90%
- **Branch Coverage**: > 85%
- **Function Coverage**: > 95%
- **Property Tests**: All 15 properties implemented
- **Unit Tests**: All edge cases and error conditions covered

### Testing Tools

- **Test Framework**: Jest
- **Property Testing**: fast-check
- **HTTP Testing**: supertest
- **Mocking**: jest.mock, jest.spyOn
- **Time Manipulation**: jest.useFakeTimers

## Implementation Plan

### Phase 1: Core Infrastructure (Priority: High)

**Estimated Time**: 4 hours

1. Create `backend/src/services/cacheService.ts`
   - Define CacheService interface
   - Implement InMemoryCacheService
   - Implement factory function
   - Write unit tests

2. Create `backend/src/utils/dbHelpers.ts`
   - Implement withTimeout wrapper
   - Write unit tests

3. Create `backend/src/utils/structuredLogger.ts`
   - Implement structuredLog function
   - Implement convenience methods (logInfo, logWarn, logError)
   - Write unit tests

4. Create `backend/src/middleware/rateLimiter.ts`
   - Implement pincodeRateLimiter middleware
   - Configure rate limit settings
   - Write unit tests

### Phase 2: Integration (Priority: High)

**Estimated Time**: 3 hours

1. Update `backend/src/utils/pincodeResolver.ts`
   - Replace direct Map with CacheService
   - Update cache TTL to 10 minutes
   - Replace console.log with structured logger
   - Wrap MongoDB queries with withTimeout
   - Write integration tests

2. Update `backend/src/controllers/pincodeController.ts`
   - Replace logger calls with structured logger
   - Verify separation of resolver and service calls
   - Write integration tests

3. Update `backend/src/routes/pincodeRoutes.ts`
   - Apply rate limiter to /check/:pincode endpoint
   - Write integration tests

### Phase 3: Testing (Priority: High)

**Estimated Time**: 4 hours

1. Write property-based tests
   - Implement all 15 properties using fast-check
   - Configure 100 iterations per test
   - Tag tests with feature and property references

2. Write unit tests
   - Cover all edge cases
   - Cover all error conditions
   - Achieve > 90% code coverage

3. Write integration tests
   - Test end-to-end flows
   - Test graceful degradation scenarios
   - Test rate limiting behavior

### Phase 4: Documentation and Deployment (Priority: Medium)

**Estimated Time**: 2 hours

1. Update API documentation
   - Document rate limiting behavior
   - Document new error responses
   - Document graceful degradation

2. Update deployment configuration
   - Set environment variables (NODE_ENV)
   - Configure log aggregation (if available)
   - Set up monitoring alerts

3. Create runbook
   - Document common issues and solutions
   - Document monitoring queries
   - Document rollback procedures

### Total Estimated Time: 13 hours

### Rollout Strategy

**Stage 1: Development Testing** (1 day)
- Deploy to development environment
- Run full test suite
- Manual testing of all endpoints
- Verify log output format

**Stage 2: Staging Deployment** (2 days)
- Deploy to staging environment
- Load testing with realistic traffic
- Monitor cache hit rates
- Monitor rate limit triggers
- Verify graceful degradation

**Stage 3: Production Deployment** (1 day)
- Deploy during low-traffic window
- Monitor error rates closely
- Monitor response times
- Monitor cache performance
- Be ready to rollback if issues arise

**Stage 4: Monitoring and Optimization** (ongoing)
- Analyze log data for patterns
- Tune rate limits if needed
- Optimize cache TTL if needed
- Plan Redis migration if scaling required

### Rollback Plan

If critical issues arise in production:

1. **Immediate Rollback** (< 5 minutes)
   - Revert to previous deployment
   - Verify system stability
   - Investigate issue in staging

2. **Partial Rollback** (if specific component fails)
   - Disable rate limiting (remove middleware)
   - Increase timeout values
   - Increase cache TTL temporarily

3. **Configuration Rollback** (if settings are wrong)
   - Adjust rate limit values
   - Adjust timeout values
   - Adjust cache TTL

### Success Metrics

**Performance Metrics**:
- Average response time < 200ms (p50)
- 95th percentile response time < 500ms (p95)
- 99th percentile response time < 1000ms (p99)
- Cache hit rate > 70%

**Reliability Metrics**:
- Error rate < 0.1%
- Database timeout rate < 1%
- Rate limit trigger rate < 5%
- Uptime > 99.9%

**Operational Metrics**:
- Log parsing success rate = 100%
- Alert response time < 5 minutes
- Incident resolution time < 30 minutes

## Appendix

### Configuration Reference

**Environment Variables**:
```bash
NODE_ENV=production                    # Environment name
PINCODE_DATASET_PATH=/path/to/csv     # CSV file path (optional)
MONGODB_URI=mongodb://localhost:27017  # MongoDB connection
REDIS_URL=redis://localhost:6379       # Redis connection (future)
```

**Cache Configuration**:
```typescript
const CACHE_TTL_SECONDS = 600;  // 10 minutes
const CLEANUP_INTERVAL_MS = 3600000;  // 1 hour
```

**Rate Limit Configuration**:
```typescript
const RATE_LIMIT_WINDOW_MS = 60000;  // 1 minute
const RATE_LIMIT_MAX = 100;  // 100 requests per window
```

**Timeout Configuration**:
```typescript
const DB_TIMEOUT_MS = 2000;  // 2 seconds
const API_TIMEOUT_MS = 3000;  // 3 seconds
```

### Monitoring Queries

**Log Aggregation Queries** (for ELK, Datadog, CloudWatch):

```
# Cache hit rate
event:PINCODE_CACHE_HIT | stats count by cacheHit

# Database timeout rate
event:DB_TIMEOUT | stats count by hour

# Rate limit violations
event:RATE_LIMIT_EXCEEDED | stats count by ip

# Average response time
event:PINCODE_CHECK | stats avg(duration)

# Error rate
level:error | stats count by event
```

### Future Enhancements

**Immediate (Before Multi-Instance Deployment)**:
- Migrate rate limiter to Redis store (MANDATORY for horizontal scaling)
- Add basic request payload size limits (prevent abuse)

**Short-Term** (1-3 months):
- Migrate cache to Redis for distributed caching
- Add Prometheus metrics export
- Implement log aggregation pipeline (ELK/Datadog)

**Medium-Term** (3-6 months):
- **Distance-based delivery logic** (CRITICAL - replaces state-based)
- Multi-store support
- Delivery fee calculation
- Geo-indexing for faster queries

**Long-Term** (6-12 months):
- Machine learning for delivery time prediction
- Dynamic rate limiting based on user tier
- Real-time cache invalidation
- Multi-region deployment

---

**Document Version**: 1.0  
**Last Updated**: 2024-03-31  
**Status**: Ready for Implementation

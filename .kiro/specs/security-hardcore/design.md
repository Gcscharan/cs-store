# Security Hardcore Bugfix Design

## Overview

This design addresses 18 CRITICAL security vulnerabilities across 50+ files that are blocking production deployment. The vulnerabilities include hardcoded API keys (Resend, Gmail), test credential fallbacks (Razorpay), OTP exposure in API responses, unsecured debug endpoints, and missing environment validation. The fix implements a fail-fast startup validation system, removes all hardcoded secrets, eliminates OTP leakage, and secures debug endpoints. The approach uses centralized validation (`validateEnv.ts`), file-by-file secret removal, integration into startup sequence, and comprehensive testing to ensure zero security regressions.

## Glossary

- **Bug_Condition (C)**: The condition that triggers security vulnerabilities - when environment variables are missing/invalid or hardcoded secrets are used
- **Property (P)**: The desired behavior - application fails immediately at startup with clear error messages when configuration is invalid
- **Preservation**: Existing functionality (authentication, payments, email, database) that must continue working with valid configuration
- **validateEnv.ts**: Centralized environment validation module in `backend/src/config/validateEnv.ts` that checks all required variables
- **Fail-Fast**: Design principle where application exits immediately on startup if configuration is invalid, preventing runtime failures
- **Hardcoded Secret**: API key, password, or credential embedded directly in source code (e.g., "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx")
- **Fallback Value**: Default value used when environment variable is missing (e.g., `process.env.KEY || "default"`)
- **OTP Exposure**: Security vulnerability where one-time passwords are included in API responses
- **Debug Endpoint**: HTTP route that exposes internal system information, intended for development only

## Bug Details

### Bug Condition

The security vulnerabilities manifest across multiple categories. The application starts and runs with missing, invalid, or compromised credentials, leading to runtime failures, security breaches, and data exposure.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ApplicationStartup OR ApiRequest
  OUTPUT: boolean
  
  RETURN (
    // Category 1: Missing Environment Variables
    (input.type == "startup" AND 
     (NOT exists(JWT_SECRET) OR NOT exists(RESEND_API_KEY) OR 
      NOT exists(GMAIL_USER) OR NOT exists(GMAIL_APP_PASSWORD) OR
      NOT exists(RAZORPAY_KEY_ID) OR NOT exists(RAZORPAY_KEY_SECRET) OR
      NOT exists(RAZORPAY_WEBHOOK_SECRET) OR NOT exists(MONGODB_URI) OR
      NOT exists(GOOGLE_MAPS_API_KEY) OR NOT exists(CLOUDINARY_*)))
    
    OR
    
    // Category 2: Invalid Secret Formats
    (input.type == "startup" AND
     (length(JWT_SECRET) < 32 OR length(JWT_REFRESH_SECRET) < 32 OR
      NOT startsWith(RESEND_API_KEY, "re_") OR
      NOT startsWith(RAZORPAY_KEY_ID, "rzp_") OR
      NOT startsWith(MONGODB_URI, "mongodb")))
    
    OR
    
    // Category 3: Exposed/Compromised Secrets
    (input.type == "startup" AND
     (RESEND_API_KEY == "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx" OR
      GMAIL_APP_PASSWORD == "lnjhscqyipztkvyu" OR
      JWT_SECRET IN ["your-secret-key", "your-super-secret-jwt-key-here"]))
    
    OR
    
    // Category 4: Test Credentials in Production
    (input.type == "startup" AND NODE_ENV == "production" AND
     (contains(RAZORPAY_KEY_ID, "test") OR contains(JWT_SECRET, "test")))
    
    OR
    
    // Category 5: Hardcoded Fallbacks in Code
    (input.type == "code_execution" AND
     uses_hardcoded_fallback(RESEND_API_KEY, GMAIL_*, RAZORPAY_*))
    
    OR
    
    // Category 6: OTP Exposure
    (input.type == "api_response" AND NODE_ENV == "development" AND
     response_contains_field("otp"))
    
    OR
    
    // Category 7: Unsecured Debug Endpoints
    (input.type == "http_request" AND path MATCHES "/debug-*" AND
     NOT authenticated AND NOT admin_role)
  )
END FUNCTION
```


### Examples

- **Example 1 - Missing JWT_SECRET**: Application starts without JWT_SECRET → uses fallback "your-secret-key" → attacker forges tokens → authentication bypass
  - Expected: Application exits with error "JWT_SECRET is required but not set"
  - Actual: Application starts and accepts forged tokens

- **Example 2 - Exposed Resend API Key**: Application uses hardcoded "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx" → attacker sends unlimited emails → financial loss
  - Expected: Application exits with error "RESEND_API_KEY is using EXPOSED key from code - MUST be changed immediately"
  - Actual: Application uses compromised key

- **Example 3 - OTP in API Response**: POST /api/auth/send-otp in development → response includes `{"otp": "123456"}` → OTP intercepted in logs/monitoring
  - Expected: OTP only logged to server console, never in API response
  - Actual: OTP exposed in response body

- **Example 4 - Weak JWT Secret**: JWT_SECRET = "short" (5 chars) → brute force attack succeeds in minutes
  - Expected: Application exits with error "JWT_SECRET must be at least 32 characters (current: 5)"
  - Actual: Application accepts weak secret

- **Example 5 - Test Credentials in Production**: NODE_ENV=production, RAZORPAY_KEY_ID="rzp_test_abc" → test transactions processed instead of real payments
  - Expected: Application exits with error "RAZORPAY_KEY_ID appears to be a test key but NODE_ENV is production"
  - Actual: Application processes test transactions

- **Example 6 - Unsecured Debug Endpoint**: GET /api/debug-user/123 without auth → returns full user PII including email, phone, addresses
  - Expected: 404 in production, or requires admin authentication
  - Actual: Exposes PII to unauthenticated requests

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Authentication flow with valid JWT_SECRET must continue to generate and verify tokens correctly
- Email OTP delivery via Resend or Gmail SMTP must continue to work with valid credentials
- Payment intent creation via Razorpay must continue to work with valid API keys
- Database connections must continue to work with valid MONGODB_URI
- Image uploads to Cloudinary must continue to work with valid credentials
- Google Maps distance calculations must continue to work with valid API key
- Refresh token generation must continue to use JWT_REFRESH_SECRET
- Webhook signature verification must continue to use RAZORPAY_WEBHOOK_SECRET
- CORS configuration must continue to allow requests from configured origins
- Rate limiting must continue to enforce request limits per IP
- Socket.io connections must continue to work for real-time updates
- User profile updates must continue to work
- Order creation and management must continue to work
- Product search and filtering must continue to work
- Delivery route optimization must continue to work

**Scope:**
All inputs that involve VALID environment configuration should be completely unaffected by this fix. This includes:
- All API endpoints with valid authentication
- All database operations with valid connection string
- All third-party service integrations with valid credentials
- All business logic and domain operations
- All frontend-backend communication
- All scheduled jobs and background tasks

## Hypothesized Root Cause

Based on the security audit, the root causes are:

1. **No Startup Validation**: The application lacks centralized environment validation at startup
   - `validateEnv.ts` exists but is not integrated into `backend/src/index.ts`
   - Application starts even with missing/invalid configuration
   - Errors only surface at runtime when features are used

2. **Defensive Programming Anti-Pattern**: Developers used fallback values to prevent crashes
   - `process.env.KEY || "default"` pattern used throughout codebase
   - 50+ instances of unsafe fallbacks across backend and frontend
   - Intention was resilience, but created security vulnerabilities

3. **Development Convenience Over Security**: Debug features left in production code
   - OTP exposure in development mode (lines 227-229 in otpController.ts, line 1097 in authController.ts)
   - Debug endpoints without authentication (debugDbTest.ts routes)
   - Test credentials as fallbacks for easier local development

4. **Secrets Committed to Repository**: Hardcoded credentials in source code
   - Resend API key "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx" in sendEmailOTP.ts and sendDeliveryOtpEmail.ts
   - Gmail credentials "gcs.charan@gmail.com" / "lnjhscqyipztkvyu" in sendEmailOTP.ts
   - Test Razorpay keys "rzp_test_key" / "rzp_test_secret" in RazorpayAdapter.ts

5. **Lack of Format Validation**: No checks for secret format correctness
   - Razorpay keys must start with "rzp_"
   - Resend keys must start with "re_"
   - JWT secrets must be at least 32 characters
   - MongoDB URIs must start with "mongodb://" or "mongodb+srv://"


## Correctness Properties

Property 1: Bug Condition - Fail-Fast Startup Validation

_For any_ application startup where required environment variables are missing, invalid, or use compromised values, the fixed application SHALL exit immediately with a descriptive error message and exit code 1, preventing the application from running with insecure configuration.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18**

Property 2: Preservation - Valid Configuration Behavior

_For any_ application startup where all required environment variables are present, valid, and secure, the fixed application SHALL start successfully and all existing functionality (authentication, payments, email, database operations) SHALL work exactly as before, preserving all business logic and API behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15**

Property 3: Bug Condition - OTP Confidentiality

_For any_ OTP generation request in any environment (development, production, test), the fixed application SHALL only log OTP values to server-side logs and SHALL never include OTP values in API responses, preventing OTP interception through network monitoring or client-side logging.

**Validates: Requirements 2.7**

Property 4: Bug Condition - Debug Endpoint Security

_For any_ HTTP request to debug endpoints (paths matching /debug-*) in production environment, the fixed application SHALL either return 404 (endpoint not registered) or require admin authentication, preventing unauthorized access to internal system information and user PII.

**Validates: Requirements 2.8**

## Fix Implementation

### Architecture Changes

The fix implements a layered security architecture:

**Layer 1: Centralized Validation Module**
- File: `backend/src/config/validateEnv.ts` (already created, needs integration)
- Validates all 14 required environment variables
- Checks format constraints (length, prefix, pattern)
- Detects exposed/compromised secrets
- Provides clear error messages with remediation guidance

**Layer 2: Startup Integration**
- File: `backend/src/index.ts`
- Import and call `validateEnvironment()` at the very top (before any other imports)
- Ensures validation runs before Express, MongoDB, Socket.io, or any service initialization
- Application exits immediately if validation fails

**Layer 3: Code Hardening**
- Remove all hardcoded secrets from source files
- Remove all unsafe fallback values (|| "default" patterns)
- Replace with strict validation that throws errors
- Add format checks at point of use (defense in depth)

**Layer 4: Debug Information Removal**
- Remove OTP from API responses in all environments
- Add server-side logging for development debugging
- Disable or secure debug endpoints in production


### Changes Required

Assuming our root cause analysis is correct:

#### Change 1: Integrate validateEnv.ts into Startup Sequence

**File**: `backend/src/index.ts`

**Specific Changes**:
1. **Add validation import at line 1-3** (before all other imports):
   ```typescript
   // CRITICAL: Validate environment before anything else
   import { validateEnvironment } from './config/validateEnv';
   validateEnvironment();
   ```

2. **Remove duplicate validation logic** (lines 17-50):
   - Delete the inline validation code that checks JWT_SECRET, JWT_REFRESH_SECRET, etc.
   - This is now handled by validateEnv.ts

3. **Verify execution order**:
   - validateEnvironment() must run before Express initialization
   - Must run before MongoDB connection
   - Must run before any service imports that use environment variables

**Rationale**: Centralized validation prevents code duplication and ensures consistent error messages. Running at the very top ensures no service initializes with invalid config.

#### Change 2: Remove Hardcoded Secrets from Email Services

**File**: `backend/src/utils/sendEmailOTP.ts`

**Specific Changes**:
1. **Replace lines 6-9** (Resend initialization):
   ```typescript
   // OLD (INSECURE):
   const resend = new Resend(
     process.env.RESEND_API_KEY || "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx"
   );
   
   // NEW (SECURE):
   const RESEND_API_KEY = process.env.RESEND_API_KEY;
   if (!RESEND_API_KEY || !RESEND_API_KEY.startsWith('re_')) {
     throw new Error('RESEND_API_KEY must be set and valid (starts with re_)');
   }
   const resend = new Resend(RESEND_API_KEY);
   ```

2. **Replace lines 24-31** (Gmail SMTP configuration):
   ```typescript
   // OLD (INSECURE):
   const transporter = nodemailer.createTransport({
     service: 'gmail',
     auth: {
       user: 'gcs.charan@gmail.com',
       pass: 'lnjhscqyipztkvyu',
     },
   });
   
   // NEW (SECURE):
   const GMAIL_USER = process.env.GMAIL_USER;
   const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
   
   if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
     throw new Error('Gmail credentials must be set: GMAIL_USER, GMAIL_APP_PASSWORD');
   }
   
   const transporter = nodemailer.createTransport({
     service: 'gmail',
     auth: {
       user: GMAIL_USER,
       pass: GMAIL_APP_PASSWORD,
     },
   });
   ```

**Rationale**: Removes exposed credentials from source code. Fail-fast approach ensures email service doesn't initialize with invalid config.

**File**: `backend/src/utils/sendDeliveryOtpEmail.ts`

**Specific Changes**:
1. **Replace lines 5-7** (Resend initialization):
   ```typescript
   // OLD (INSECURE):
   const resend = new Resend(
     process.env.RESEND_API_KEY || "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx"
   );
   
   // NEW (SECURE):
   const RESEND_API_KEY = process.env.RESEND_API_KEY;
   if (!RESEND_API_KEY || !RESEND_API_KEY.startsWith('re_')) {
     throw new Error('RESEND_API_KEY must be set and valid (starts with re_)');
   }
   const resend = new Resend(RESEND_API_KEY);
   ```

**Rationale**: Same as sendEmailOTP.ts - removes exposed API key and adds validation.


#### Change 3: Remove Test Credential Fallbacks from Payment Adapter

**File**: `backend/src/domains/payments/adapters/RazorpayAdapter.ts`

**Specific Changes**:
1. **Replace lines 22-35** (constructor credential loading):
   ```typescript
   // OLD (INSECURE):
   const isTest = process.env.NODE_ENV === "test";
   const keyId = String(process.env.RAZORPAY_KEY_ID || (isTest ? "rzp_test_key" : "")).trim();
   const keySecret = String(process.env.RAZORPAY_KEY_SECRET || (isTest ? "rzp_test_secret" : "")).trim();
   const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || (isTest ? "test-webhook-secret" : "")).trim();
   
   if (!keyId || !keySecret) {
     throw new Error("RazorpayAdapter misconfigured: RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET required");
   }
   if (!webhookSecret) {
     throw new Error("RazorpayAdapter misconfigured: RAZORPAY_WEBHOOK_SECRET required");
   }
   
   // NEW (SECURE):
   const keyId = process.env.RAZORPAY_KEY_ID?.trim();
   const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
   const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
   
   if (!keyId || !keySecret || !webhookSecret) {
     throw new Error(
       'Razorpay credentials required: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET'
     );
   }
   
   // Validate format
   if (!keyId.startsWith('rzp_')) {
     throw new Error('Invalid RAZORPAY_KEY_ID format (must start with rzp_)');
   }
   ```

2. **Add validation logging**:
   ```typescript
   this.keyId = keyId;
   this.keySecret = keySecret;
   this.webhookSecret = webhookSecret;
   
   // Log successful initialization (mask secret)
   logger.info(`✅ Razorpay initialized with key: ${keyId.substring(0, 8)}****`);
   ```

**Rationale**: Removes test credential fallbacks that could be used in production. Adds format validation to catch configuration errors early.

#### Change 4: Remove OTP Exposure from API Responses

**File**: `backend/src/domains/security/controllers/otpController.ts`

**Specific Changes**:
1. **Remove lines 227-231** (OTP in payment response):
   ```typescript
   // OLD (INSECURE):
   if (process.env.NODE_ENV === "development") {
     logger.info(`💳 Development PAYMENT OTP for order ${orderId}: ${otp}`);
     paymentResponse.otp = otp; 
     paymentResponse.phone = user.phone;
     paymentResponse.note = "OTP included in response for development only";
   }
   
   // NEW (SECURE):
   if (process.env.NODE_ENV === "development") {
     logger.debug(`[DEV ONLY] Payment OTP for order ${orderId}, phone ${user.phone}: ${otp}`);
   }
   ```

**Rationale**: OTP should never be in API responses, even in development. Server logs are sufficient for debugging.

**File**: `backend/src/domains/identity/controllers/authController.ts`

**Specific Changes**:
1. **Remove line 1097** (OTP in login response):
   ```typescript
   // OLD (INSECURE):
   ...(process.env.NODE_ENV === "development" && { otp, devMode: true }),
   
   // NEW (SECURE):
   // Remove this line entirely from the response object
   ```

2. **Add server-side logging** (after response is sent):
   ```typescript
   // After res.status(200).json({ ... })
   if (process.env.NODE_ENV === "development") {
     logger.debug(`[DEV ONLY] OTP sent to ${phone}: ${otp}`);
   }
   ```

**Rationale**: Prevents OTP interception through network monitoring, client-side logging, or error tracking services.


#### Change 5: Secure or Remove Debug Endpoints

**File**: `backend/src/routes/debugDbTest.ts`

**Option 1: Delete the entire file** (Recommended):
```bash
rm backend/src/routes/debugDbTest.ts
```

**Option 2: Add strict authentication** (If needed for production debugging):
```typescript
// Add at top of file
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';

// Wrap all routes
router.get("/debug-user/:userId", 
  requireAuth,
  requireRole(['admin']),
  async (req, res) => {
    // ... existing implementation
  }
);

// Add production guard
if (process.env.NODE_ENV === "production") {
  // Don't register debug routes in production
  module.exports = express.Router(); // Empty router
} else {
  module.exports = router;
}
```

**Rationale**: Debug endpoints expose sensitive user data. Either remove them entirely or require admin authentication. Production guard ensures they're never accessible in production.

#### Change 6: Remove Unsafe Fallbacks from Configuration Files

**Files with unsafe fallbacks** (identified by grep search):

1. **backend/src/controllers/deliveryAuthController.ts** (lines 13-14):
   ```typescript
   // OLD:
   const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "24h";
   const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";
   
   // NEW:
   const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "24h"; // Safe - reasonable default
   const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d"; // Safe - reasonable default
   ```
   **Decision**: KEEP - These are safe defaults for token expiry, not secrets.

2. **backend/src/services/autoTranslateService.ts** (line 15):
   ```typescript
   // OLD:
   url: process.env.REDIS_URL || 'redis://localhost:6379',
   
   // NEW:
   const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
   // Safe - localhost default for optional service
   ```
   **Decision**: KEEP - Redis is optional, localhost default is safe for development.

3. **backend/src/services/qdrantClient.ts** (line 11):
   ```typescript
   // OLD:
   const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
   
   // NEW:
   const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
   // Safe - localhost default for optional service
   ```
   **Decision**: KEEP - Qdrant is optional, localhost default is safe.

4. **backend/src/controllers/adminController.ts** (lines 1970-1971):
   ```typescript
   // OLD:
   const AUTO_CAPACITY_MIN = parseInt(process.env.ROUTE_CAPACITY_MIN || '20');
   const AUTO_CAPACITY_MAX = parseInt(process.env.ROUTE_CAPACITY_MAX || '30');
   
   // NEW:
   const AUTO_CAPACITY_MIN = parseInt(process.env.ROUTE_CAPACITY_MIN || '20');
   const AUTO_CAPACITY_MAX = parseInt(process.env.ROUTE_CAPACITY_MAX || '30');
   // Safe - business logic defaults, not secrets
   ```
   **Decision**: KEEP - These are business logic parameters with reasonable defaults.

5. **backend/src/services/cvrpRouteAssignmentService.ts** (lines 31-54):
   ```typescript
   // All warehouse and routing configuration with defaults
   ```
   **Decision**: KEEP - These are business logic parameters, not security-sensitive.

6. **backend/src/services/socketService.ts** (line 22):
   ```typescript
   // OLD:
   process.env.FRONTEND_URL || "http://localhost:3000",
   
   // NEW:
   process.env.FRONTEND_URL || "http://localhost:3000",
   // Safe - localhost default for development
   ```
   **Decision**: KEEP - Safe default for CORS in development.

7. **backend/src/index.ts** (lines 17, 18, 211, 212, 217, 261, 626):
   ```typescript
   // Various NODE_ENV, PORT, and logging defaults
   ```
   **Decision**: KEEP - These are safe operational defaults, not secrets.

8. **backend/src/queues/dashboard.ts** (line 45):
   ```typescript
   // OLD:
   const adminSecret = process.env.BULL_BOARD_ADMIN_SECRET || 'admin-secret-change-in-production';
   
   // NEW:
   const adminSecret = process.env.BULL_BOARD_ADMIN_SECRET;
   if (!adminSecret || adminSecret === 'admin-secret-change-in-production') {
     throw new Error('BULL_BOARD_ADMIN_SECRET must be set to a secure value');
   }
   ```
   **Decision**: FIX - This is a security-sensitive secret that should not have a default.

9. **Frontend files** (apps/customer-app/src/):
   ```typescript
   // All EXPO_PUBLIC_API_URL fallbacks to localhost
   ```
   **Decision**: KEEP - Frontend localhost defaults are safe for development. Frontend env vars are not security-sensitive (they're public).

**Summary**: Only 2 files need changes for unsafe fallbacks:
- `backend/src/utils/sendEmailOTP.ts` (already covered in Change 2)
- `backend/src/utils/sendDeliveryOtpEmail.ts` (already covered in Change 2)
- `backend/src/domains/payments/adapters/RazorpayAdapter.ts` (already covered in Change 3)
- `backend/src/queues/dashboard.ts` (new - add to fix list)


#### Change 7: Fix Bull Board Admin Secret

**File**: `backend/src/queues/dashboard.ts`

**Specific Changes**:
1. **Replace line 45**:
   ```typescript
   // OLD (INSECURE):
   const adminSecret = process.env.BULL_BOARD_ADMIN_SECRET || 'admin-secret-change-in-production';
   
   // NEW (SECURE):
   const adminSecret = process.env.BULL_BOARD_ADMIN_SECRET;
   if (!adminSecret || adminSecret === 'admin-secret-change-in-production') {
     throw new Error('BULL_BOARD_ADMIN_SECRET must be set to a secure value (not default)');
   }
   ```

**Rationale**: Bull Board provides access to job queues and sensitive data. Must not have a default secret.

#### Change 8: Add BULL_BOARD_ADMIN_SECRET to validateEnv.ts

**File**: `backend/src/config/validateEnv.ts`

**Specific Changes**:
1. **Add to RequiredEnvVars interface** (after line 27):
   ```typescript
   // Bull Board (Job Queue Dashboard)
   BULL_BOARD_ADMIN_SECRET: string;
   ```

2. **Add to required array** (after line 48):
   ```typescript
   'BULL_BOARD_ADMIN_SECRET',
   ```

3. **Add validation rule** (after line 90):
   ```typescript
   // Bull Board Admin Secret validation
   if (process.env.BULL_BOARD_ADMIN_SECRET) {
     if (process.env.BULL_BOARD_ADMIN_SECRET === 'admin-secret-change-in-production') {
       errors.push(`❌ BULL_BOARD_ADMIN_SECRET is using default value - MUST be changed`);
     }
     if (process.env.BULL_BOARD_ADMIN_SECRET.length < 16) {
       errors.push(`❌ BULL_BOARD_ADMIN_SECRET must be at least 16 characters`);
     }
   }
   ```

**Rationale**: Ensures Bull Board secret is validated at startup like other secrets.

#### Change 9: Update .env.example

**File**: `backend/.env.example`

**Specific Changes**:
1. **Verify all required variables are documented**:
   ```bash
   # Core Secrets
   JWT_SECRET=
   JWT_REFRESH_SECRET=
   
   # Database
   MONGODB_URI=
   
   # Payment Gateway
   RAZORPAY_KEY_ID=
   RAZORPAY_KEY_SECRET=
   RAZORPAY_WEBHOOK_SECRET=
   
   # Email Services
   RESEND_API_KEY=
   GMAIL_USER=
   GMAIL_APP_PASSWORD=
   
   # External APIs
   GOOGLE_MAPS_API_KEY=
   
   # Image Storage
   CLOUDINARY_CLOUD_NAME=
   CLOUDINARY_API_KEY=
   CLOUDINARY_API_SECRET=
   
   # Job Queue Dashboard
   BULL_BOARD_ADMIN_SECRET=
   
   # Environment
   NODE_ENV=development
   PORT=5001
   ```

2. **Add generation instructions**:
   ```bash
   # Generate secure secrets:
   # node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
   ```

**Rationale**: Ensures developers know all required variables and how to generate secure values.


#### Change 10: Credential Rotation Procedures

**Manual Steps** (not code changes, but required for security):

1. **Revoke Exposed Resend API Key**:
   - Go to: https://resend.com/api-keys
   - Find key: `re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx`
   - Click "Revoke" or "Delete"
   - Generate new API key
   - Update `RESEND_API_KEY` in all environments

2. **Revoke Exposed Gmail App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Find password: `lnjhscqyipztkvyu`
   - Click "Remove" or "Revoke"
   - Generate new app password
   - Update `GMAIL_APP_PASSWORD` in all environments

3. **Verify Razorpay Keys**:
   - Go to: https://dashboard.razorpay.com/app/keys
   - Verify production keys are NOT test keys
   - Rotate if compromised

4. **Update All Deployment Environments**:
   - Development: Update `.env` file
   - Staging: Update environment variables in hosting platform
   - Production: Update environment variables in hosting platform
   - CI/CD: Update secrets in GitHub Actions / GitLab CI / etc.

**Documentation**: Create `CREDENTIAL_ROTATION.md` with step-by-step instructions for future rotations.

### File-by-File Fix Summary

| File | Lines | Change Type | Description |
|------|-------|-------------|-------------|
| `backend/src/index.ts` | 1-3 | Add | Import and call validateEnvironment() |
| `backend/src/index.ts` | 17-50 | Remove | Delete duplicate validation logic |
| `backend/src/utils/sendEmailOTP.ts` | 6-9 | Replace | Remove hardcoded Resend API key |
| `backend/src/utils/sendEmailOTP.ts` | 24-31 | Replace | Remove hardcoded Gmail credentials |
| `backend/src/utils/sendDeliveryOtpEmail.ts` | 5-7 | Replace | Remove hardcoded Resend API key |
| `backend/src/domains/payments/adapters/RazorpayAdapter.ts` | 22-35 | Replace | Remove test credential fallbacks |
| `backend/src/domains/security/controllers/otpController.ts` | 227-231 | Remove | Remove OTP from API response |
| `backend/src/domains/identity/controllers/authController.ts` | 1097 | Remove | Remove OTP from API response |
| `backend/src/domains/identity/controllers/authController.ts` | After 1099 | Add | Add server-side OTP logging |
| `backend/src/routes/debugDbTest.ts` | Entire file | Delete/Secure | Remove or add admin auth |
| `backend/src/queues/dashboard.ts` | 45 | Replace | Remove default admin secret |
| `backend/src/config/validateEnv.ts` | 27, 48, 90 | Add | Add BULL_BOARD_ADMIN_SECRET validation |
| `backend/.env.example` | Entire file | Update | Document all required variables |

**Total Files Modified**: 13 files
**Total Lines Changed**: ~150 lines
**Estimated Time**: 2-3 hours including testing


## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach: first, demonstrate the bugs exist on unfixed code (exploratory), then verify the fixes work correctly (fix checking), and finally ensure existing functionality is preserved (preservation checking). This approach provides high confidence that all 18 vulnerabilities are fixed without introducing regressions.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that attempt to start the application with missing/invalid environment variables and verify the application fails appropriately. Run these tests on the UNFIXED code to observe current behavior (application starts anyway), then on FIXED code to verify fail-fast behavior.

**Test Cases**:

1. **Missing JWT_SECRET Test**:
   - Setup: Remove JWT_SECRET from environment
   - Run: Start application
   - Expected on UNFIXED: Application starts, uses fallback "your-secret-key"
   - Expected on FIXED: Application exits with error "JWT_SECRET is required but not set"

2. **Short JWT_SECRET Test**:
   - Setup: Set JWT_SECRET="short" (5 characters)
   - Run: Start application
   - Expected on UNFIXED: Application starts with weak secret
   - Expected on FIXED: Application exits with error "JWT_SECRET must be at least 32 characters (current: 5)"

3. **Exposed Resend API Key Test**:
   - Setup: Set RESEND_API_KEY="re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx"
   - Run: Start application
   - Expected on UNFIXED: Application starts with exposed key
   - Expected on FIXED: Application exits with error "RESEND_API_KEY is using EXPOSED key from code - MUST be changed immediately"

4. **Exposed Gmail Password Test**:
   - Setup: Set GMAIL_APP_PASSWORD="lnjhscqyipztkvyu"
   - Run: Start application
   - Expected on UNFIXED: Application starts with exposed password
   - Expected on FIXED: Application exits with error "GMAIL_APP_PASSWORD is using EXPOSED password from code - MUST be changed immediately"

5. **Invalid Razorpay Key Format Test**:
   - Setup: Set RAZORPAY_KEY_ID="invalid_key" (doesn't start with rzp_)
   - Run: Start application
   - Expected on UNFIXED: Application starts, fails at runtime when payment is attempted
   - Expected on FIXED: Application exits with error "RAZORPAY_KEY_ID must start with 'rzp_'"

6. **Test Credentials in Production Test**:
   - Setup: Set NODE_ENV="production", RAZORPAY_KEY_ID="rzp_test_abc123"
   - Run: Start application
   - Expected on UNFIXED: Application starts with test credentials
   - Expected on FIXED: Application exits with error "RAZORPAY_KEY_ID appears to be a test key but NODE_ENV is production"

7. **OTP Exposure Test**:
   - Setup: Start application with valid config, NODE_ENV="development"
   - Run: POST /api/auth/send-otp with valid phone
   - Expected on UNFIXED: Response includes `{"otp": "123456", "devMode": true}`
   - Expected on FIXED: Response does NOT include otp field, only server logs contain OTP

8. **Debug Endpoint Exposure Test**:
   - Setup: Start application with valid config
   - Run: GET /api/debug-user/123 without authentication
   - Expected on UNFIXED: Returns user PII (email, phone, addresses)
   - Expected on FIXED: Returns 404 or requires authentication

9. **Identical JWT Secrets Test**:
   - Setup: Set JWT_SECRET="abc123..." and JWT_REFRESH_SECRET="abc123..." (same value)
   - Run: Start application
   - Expected on UNFIXED: Application starts with identical secrets
   - Expected on FIXED: Application exits with error "JWT_REFRESH_SECRET must be different from JWT_SECRET"

10. **Invalid MongoDB URI Test**:
    - Setup: Set MONGODB_URI="invalid://localhost"
    - Run: Start application
    - Expected on UNFIXED: Application starts, fails at runtime when connecting to DB
    - Expected on FIXED: Application exits with error "MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'"

**Expected Counterexamples**:
- Application starts with missing/invalid configuration (fails to fail-fast)
- OTP values appear in API responses
- Debug endpoints accessible without authentication
- Hardcoded secrets used as fallbacks

**Confirmation Criteria**:
- All 10 test cases fail on UNFIXED code (demonstrate bugs exist)
- Root cause analysis is confirmed if failures match predictions
- If failures don't match, re-hypothesize and update design


### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed application produces the expected behavior (fail-fast with clear errors).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := startApplication_fixed(input)
  ASSERT result.exitCode == 1
  ASSERT result.errorMessage contains descriptive_error
  ASSERT result.errorMessage contains remediation_guidance
END FOR
```

**Testing Approach**: Automated integration tests that start the application with various invalid configurations and verify exit behavior.

**Test Implementation**:

```typescript
// test/security/environment-validation.test.ts

describe('Environment Validation - Fix Checking', () => {
  
  test('Missing JWT_SECRET causes immediate exit', async () => {
    const env = { ...validEnv };
    delete env.JWT_SECRET;
    
    const result = await startApp(env);
    
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('JWT_SECRET is required but not set');
  });
  
  test('Short JWT_SECRET causes immediate exit', async () => {
    const env = { ...validEnv, JWT_SECRET: 'short' };
    
    const result = await startApp(env);
    
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('JWT_SECRET must be at least 32 characters');
    expect(result.stderr).toContain('current: 5');
  });
  
  test('Exposed Resend API key causes immediate exit', async () => {
    const env = { 
      ...validEnv, 
      RESEND_API_KEY: 're_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx' 
    };
    
    const result = await startApp(env);
    
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('RESEND_API_KEY is using EXPOSED key');
    expect(result.stderr).toContain('MUST be changed immediately');
  });
  
  test('Invalid Razorpay key format causes immediate exit', async () => {
    const env = { ...validEnv, RAZORPAY_KEY_ID: 'invalid_key' };
    
    const result = await startApp(env);
    
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("RAZORPAY_KEY_ID must start with 'rzp_'");
  });
  
  test('Test credentials in production cause immediate exit', async () => {
    const env = { 
      ...validEnv, 
      NODE_ENV: 'production',
      RAZORPAY_KEY_ID: 'rzp_test_abc123' 
    };
    
    const result = await startApp(env);
    
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('appears to be a test key but NODE_ENV is production');
  });
  
  // ... additional tests for all 18 bug conditions
});
```

**Test Cases**: 18 tests (one for each bug condition in requirements 2.1-2.18)

**Success Criteria**:
- All tests pass on FIXED code
- Application exits with code 1 for all invalid configurations
- Error messages are clear and actionable
- No false positives (valid configs don't trigger errors)


### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (valid configuration), the fixed application produces the same result as the original application, preserving all existing functionality.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT application_original(input) = application_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all valid inputs

**Test Plan**: Observe behavior on UNFIXED code first for valid configurations, then write property-based tests capturing that behavior.

**Test Implementation**:

```typescript
// test/security/preservation.test.ts

describe('Security Fix - Preservation Checking', () => {
  
  describe('Authentication Preservation', () => {
    test('JWT token generation works with valid config', async () => {
      const env = validEnv;
      await startApp(env);
      
      const response = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: '9999999999' });
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('OTP sent successfully');
      expect(response.body.otp).toBeUndefined(); // OTP not in response
    });
    
    test('JWT token verification works with valid config', async () => {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
    });
  });
  
  describe('Email Service Preservation', () => {
    test('Resend email sending works with valid API key', async () => {
      const env = { ...validEnv, RESEND_API_KEY: 're_valid_key_here' };
      await startApp(env);
      
      const result = await sendEmailOTP('test@example.com', '123456');
      
      expect(result).toBe(true);
      // Verify email was sent (mock or integration test)
    });
    
    test('Gmail SMTP sending works with valid credentials', async () => {
      const env = { 
        ...validEnv, 
        GMAIL_USER: 'valid@gmail.com',
        GMAIL_APP_PASSWORD: 'valid_app_password_16chars'
      };
      await startApp(env);
      
      const result = await sendEmailOTP('test@example.com', '123456');
      
      expect(result).toBe(true);
    });
  });
  
  describe('Payment Service Preservation', () => {
    test('Razorpay order creation works with valid credentials', async () => {
      const env = { 
        ...validEnv,
        RAZORPAY_KEY_ID: 'rzp_live_valid123',
        RAZORPAY_KEY_SECRET: 'valid_secret',
        RAZORPAY_WEBHOOK_SECRET: 'valid_webhook_secret'
      };
      await startApp(env);
      
      const order = await createPaymentOrder({
        amount: 100,
        currency: 'INR',
        receipt: 'order_123'
      });
      
      expect(order.gatewayOrderId).toBeDefined();
      expect(order.gateway).toBe('RAZORPAY');
    });
    
    test('Razorpay webhook verification works with valid secret', async () => {
      const signature = generateValidSignature();
      
      const result = verifyWebhookSignature({
        rawBody: Buffer.from('{}'),
        headers: { 'x-razorpay-signature': signature }
      });
      
      expect(result.ok).toBe(true);
    });
  });
  
  describe('Database Preservation', () => {
    test('MongoDB connection works with valid URI', async () => {
      const env = { 
        ...validEnv,
        MONGODB_URI: 'mongodb://localhost:27017/test'
      };
      await startApp(env);
      
      const user = await User.create({
        name: 'Test User',
        phone: '9999999999',
        role: 'customer'
      });
      
      expect(user._id).toBeDefined();
    });
  });
  
  describe('API Endpoint Preservation', () => {
    test('All public endpoints remain accessible', async () => {
      const endpoints = [
        { method: 'POST', path: '/api/auth/send-otp' },
        { method: 'POST', path: '/api/auth/verify-otp' },
        { method: 'GET', path: '/api/products' },
        { method: 'GET', path: '/api/categories' },
        // ... all public endpoints
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method.toLowerCase()](endpoint.path);
        expect(response.status).not.toBe(404);
      }
    });
    
    test('All authenticated endpoints require valid token', async () => {
      const endpoints = [
        { method: 'GET', path: '/api/user/profile' },
        { method: 'POST', path: '/api/orders' },
        { method: 'GET', path: '/api/orders' },
        // ... all authenticated endpoints
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method.toLowerCase()](endpoint.path);
        expect(response.status).toBe(401);
      }
    });
  });
  
  describe('OTP Confidentiality Preservation', () => {
    test('OTP never appears in API responses (all environments)', async () => {
      const environments = ['development', 'production', 'test'];
      
      for (const env of environments) {
        process.env.NODE_ENV = env;
        
        const response = await request(app)
          .post('/api/auth/send-otp')
          .send({ phone: '9999999999' });
        
        expect(response.body.otp).toBeUndefined();
        expect(response.body.devMode).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain('otp');
      }
    });
  });
  
  describe('Debug Endpoint Security Preservation', () => {
    test('Debug endpoints not accessible in production', async () => {
      process.env.NODE_ENV = 'production';
      await startApp(validEnv);
      
      const response = await request(app).get('/api/debug-user/123');
      
      expect(response.status).toBe(404);
    });
    
    test('Debug endpoints require admin auth in development', async () => {
      process.env.NODE_ENV = 'development';
      await startApp(validEnv);
      
      const response = await request(app).get('/api/debug-user/123');
      
      expect(response.status).toBe(401); // or 404 if deleted
    });
  });
});
```

**Property-Based Tests**:

```typescript
// test/security/preservation.property.test.ts

import * as fc from 'fast-check';

describe('Security Fix - Property-Based Preservation', () => {
  
  test('Valid JWT secrets always allow token generation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 32, maxLength: 128 }), // Valid JWT secret
        (jwtSecret) => {
          process.env.JWT_SECRET = jwtSecret;
          
          const token = generateToken({ userId: '123', role: 'customer' });
          const decoded = verifyToken(token);
          
          return decoded.userId === '123' && decoded.role === 'customer';
        }
      )
    );
  });
  
  test('Valid Razorpay keys always allow order creation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }).map(s => `rzp_live_${s}`), // Valid key format
        fc.string({ minLength: 20 }), // Valid secret
        async (keyId, keySecret) => {
          process.env.RAZORPAY_KEY_ID = keyId;
          process.env.RAZORPAY_KEY_SECRET = keySecret;
          
          const adapter = new RazorpayAdapter();
          // Should not throw during initialization
          return adapter.gateway === 'RAZORPAY';
        }
      )
    );
  });
  
  test('Valid email credentials always allow email sending', () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        fc.string({ minLength: 16, maxLength: 16 }), // Gmail app password format
        async (email, password) => {
          process.env.GMAIL_USER = email;
          process.env.GMAIL_APP_PASSWORD = password;
          
          // Should not throw during transporter creation
          const transporter = createTransporter();
          return transporter !== null;
        }
      )
    );
  });
});
```

**Success Criteria**:
- All preservation tests pass on FIXED code
- No regressions in authentication, payments, email, database operations
- API endpoints remain accessible with same authentication requirements
- OTP never appears in responses in any environment
- Debug endpoints secured or removed


### Unit Tests

**Test Coverage by Component**:

1. **Environment Validation Module** (`backend/src/config/validateEnv.ts`):
   - Test missing required variables (14 tests - one per variable)
   - Test invalid formats (JWT length, Razorpay prefix, Resend prefix, MongoDB URI)
   - Test exposed secrets detection (Resend, Gmail)
   - Test identical JWT secrets detection
   - Test test credentials in production detection
   - Test valid configuration passes (happy path)

2. **Email Services** (`backend/src/utils/sendEmailOTP.ts`, `sendDeliveryOtpEmail.ts`):
   - Test Resend initialization with valid key
   - Test Resend initialization fails with invalid key
   - Test Gmail SMTP initialization with valid credentials
   - Test Gmail SMTP initialization fails with invalid credentials
   - Test email sending success
   - Test email sending failure and fallback behavior

3. **Payment Adapter** (`backend/src/domains/payments/adapters/RazorpayAdapter.ts`):
   - Test initialization with valid credentials
   - Test initialization fails with missing credentials
   - Test initialization fails with invalid key format
   - Test order creation with valid config
   - Test webhook signature verification with valid secret
   - Test webhook signature verification fails with invalid secret

4. **OTP Controllers** (`backend/src/domains/security/controllers/otpController.ts`, `authController.ts`):
   - Test OTP generation returns success message
   - Test OTP not included in response body (all environments)
   - Test OTP logged to server console in development
   - Test OTP verification works correctly
   - Test OTP expiry handling

5. **Debug Endpoints** (`backend/src/routes/debugDbTest.ts`):
   - Test debug routes not registered in production
   - Test debug routes require admin auth in development
   - Test unauthorized access returns 401 or 404

6. **Bull Board Dashboard** (`backend/src/queues/dashboard.ts`):
   - Test initialization with valid admin secret
   - Test initialization fails with default secret
   - Test initialization fails with short secret
   - Test authentication works with valid secret

**Test File Structure**:
```
backend/test/
├── unit/
│   ├── config/
│   │   └── validateEnv.test.ts (50+ tests)
│   ├── utils/
│   │   ├── sendEmailOTP.test.ts (10 tests)
│   │   └── sendDeliveryOtpEmail.test.ts (8 tests)
│   ├── domains/
│   │   ├── payments/
│   │   │   └── RazorpayAdapter.test.ts (12 tests)
│   │   ├── security/
│   │   │   └── otpController.test.ts (15 tests)
│   │   └── identity/
│   │       └── authController.test.ts (20 tests)
│   ├── routes/
│   │   └── debugDbTest.test.ts (6 tests)
│   └── queues/
│       └── dashboard.test.ts (8 tests)
├── integration/
│   └── security/
│       ├── environment-validation.test.ts (18 tests)
│       └── preservation.test.ts (30 tests)
└── property/
    └── security/
        └── preservation.property.test.ts (10 properties)
```

**Total Test Count**: ~200 tests
**Estimated Test Writing Time**: 4-6 hours
**Estimated Test Execution Time**: 2-3 minutes


### Property-Based Tests

**PBT Strategy**: Use fast-check (TypeScript) or Hypothesis (Python) to generate random inputs and verify properties hold across the input domain.

**Property 1: Valid Configuration Always Starts Successfully**
```typescript
test('Property 1: Valid configs always start app', () => {
  fc.assert(
    fc.property(
      validConfigGenerator(), // Generates valid env configs
      async (config) => {
        const result = await startApp(config);
        return result.exitCode === 0 && result.started === true;
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 2: Invalid Configuration Always Fails Fast**
```typescript
test('Property 2: Invalid configs always fail fast', () => {
  fc.assert(
    fc.property(
      invalidConfigGenerator(), // Generates configs with at least one invalid field
      async (config) => {
        const result = await startApp(config);
        return result.exitCode === 1 && result.stderr.length > 0;
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 3: OTP Never in Response**
```typescript
test('Property 3: OTP never appears in any API response', () => {
  fc.assert(
    fc.property(
      fc.record({
        phone: fc.string({ minLength: 10, maxLength: 10 }).map(s => '9' + s.slice(1)),
        endpoint: fc.constantFrom('/api/auth/send-otp', '/api/security/generate-payment-otp'),
        env: fc.constantFrom('development', 'production', 'test')
      }),
      async ({ phone, endpoint, env }) => {
        process.env.NODE_ENV = env;
        const response = await request(app).post(endpoint).send({ phone });
        
        const bodyStr = JSON.stringify(response.body);
        return !bodyStr.includes('otp') && 
               !bodyStr.includes('devMode') &&
               response.body.otp === undefined;
      }
    ),
    { numRuns: 50 }
  );
});
```

**Property 4: JWT Token Roundtrip**
```typescript
test('Property 4: JWT tokens can always be verified if generated with valid secret', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 32, maxLength: 128 }), // Valid JWT secret
      fc.record({
        userId: fc.uuid(),
        role: fc.constantFrom('customer', 'admin', 'delivery'),
        phone: fc.string({ minLength: 10, maxLength: 10 })
      }),
      (jwtSecret, payload) => {
        process.env.JWT_SECRET = jwtSecret;
        
        const token = generateToken(payload);
        const decoded = verifyToken(token);
        
        return decoded.userId === payload.userId &&
               decoded.role === payload.role &&
               decoded.phone === payload.phone;
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 5: Razorpay Key Format Validation**
```typescript
test('Property 5: Razorpay keys starting with rzp_ always pass format check', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 10 }).map(s => `rzp_${s}`),
      (keyId) => {
        process.env.RAZORPAY_KEY_ID = keyId;
        process.env.RAZORPAY_KEY_SECRET = 'valid_secret';
        process.env.RAZORPAY_WEBHOOK_SECRET = 'valid_webhook';
        
        // Should not throw
        const adapter = new RazorpayAdapter();
        return adapter.gateway === 'RAZORPAY';
      }
    ),
    { numRuns: 50 }
  );
});
```

**Property 6: Resend Key Format Validation**
```typescript
test('Property 6: Resend keys starting with re_ always pass format check', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 20 }).map(s => `re_${s}`),
      (apiKey) => {
        process.env.RESEND_API_KEY = apiKey;
        
        // Should not throw during initialization
        const resend = new Resend(apiKey);
        return resend !== null;
      }
    ),
    { numRuns: 50 }
  );
});
```

**Property 7: MongoDB URI Format Validation**
```typescript
test('Property 7: MongoDB URIs with correct prefix always pass format check', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('mongodb://', 'mongodb+srv://'),
      fc.string({ minLength: 10 }),
      (prefix, rest) => {
        const uri = prefix + rest;
        process.env.MONGODB_URI = uri;
        
        // Validation should pass
        const errors = validateMongoUri(uri);
        return errors.length === 0;
      }
    ),
    { numRuns: 50 }
  );
});
```

**Property 8: Debug Endpoints Security**
```typescript
test('Property 8: Debug endpoints always require auth or return 404', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('production', 'development', 'test'),
      fc.uuid(), // Random user ID
      async (env, userId) => {
        process.env.NODE_ENV = env;
        
        const response = await request(app)
          .get(`/api/debug-user/${userId}`);
        
        // Either 404 (not registered) or 401 (requires auth)
        return response.status === 404 || response.status === 401;
      }
    ),
    { numRuns: 30 }
  );
});
```

**Property 9: Exposed Secrets Detection**
```typescript
test('Property 9: Exposed secrets always trigger validation failure', () => {
  const exposedSecrets = [
    { key: 'RESEND_API_KEY', value: 're_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx' },
    { key: 'GMAIL_APP_PASSWORD', value: 'lnjhscqyipztkvyu' },
    { key: 'JWT_SECRET', value: 'your-secret-key' },
    { key: 'JWT_SECRET', value: 'your-super-secret-jwt-key-here' }
  ];
  
  fc.assert(
    fc.property(
      fc.constantFrom(...exposedSecrets),
      (secret) => {
        const config = { ...validEnv, [secret.key]: secret.value };
        const result = validateEnvironment(config);
        
        return result.errors.length > 0 &&
               result.errors.some(e => e.includes('EXPOSED'));
      }
    ),
    { numRuns: exposedSecrets.length }
  );
});
```

**Property 10: Test Credentials in Production Detection**
```typescript
test('Property 10: Test credentials in production always fail validation', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 10 }).map(s => `rzp_test_${s}`),
      (testKey) => {
        const config = {
          ...validEnv,
          NODE_ENV: 'production',
          RAZORPAY_KEY_ID: testKey
        };
        
        const result = validateEnvironment(config);
        
        return result.errors.length > 0 &&
               result.errors.some(e => e.includes('test key') && e.includes('production'));
      }
    ),
    { numRuns: 50 }
  );
});
```

**PBT Execution**:
- Run with 50-100 iterations per property
- Use shrinking to find minimal failing examples
- Total execution time: ~30 seconds for all properties


### Integration Tests

**Integration Test Scenarios**: Test full application flows with real services (or mocks) to ensure end-to-end functionality is preserved.

**Scenario 1: Complete Authentication Flow**
```typescript
describe('Integration: Authentication Flow', () => {
  test('User can sign up, receive OTP, and login', async () => {
    // 1. Request OTP
    const otpResponse = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '9999999999' });
    
    expect(otpResponse.status).toBe(200);
    expect(otpResponse.body.otp).toBeUndefined(); // OTP not in response
    
    // 2. Get OTP from server logs (in test environment)
    const otp = await getOtpFromLogs('9999999999');
    
    // 3. Verify OTP and complete signup
    const signupResponse = await request(app)
      .post('/api/auth/signup')
      .send({
        phone: '9999999999',
        otp,
        name: 'Test User',
        email: 'test@example.com'
      });
    
    expect(signupResponse.status).toBe(201);
    expect(signupResponse.body.accessToken).toBeDefined();
    expect(signupResponse.body.user).toBeDefined();
    
    // 4. Use access token to access protected route
    const profileResponse = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${signupResponse.body.accessToken}`);
    
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.user.phone).toBe('9999999999');
  });
});
```

**Scenario 2: Complete Payment Flow**
```typescript
describe('Integration: Payment Flow', () => {
  test('User can create order and complete payment', async () => {
    // 1. Login
    const { accessToken } = await loginUser('9999999999');
    
    // 2. Create order
    const orderResponse = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        items: [{ productId: 'prod_123', quantity: 2 }],
        deliveryAddress: { /* ... */ }
      });
    
    expect(orderResponse.status).toBe(201);
    expect(orderResponse.body.order._id).toBeDefined();
    
    // 3. Create payment intent
    const paymentResponse = await request(app)
      .post('/api/payments/create-intent')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        orderId: orderResponse.body.order._id,
        amount: 100
      });
    
    expect(paymentResponse.status).toBe(200);
    expect(paymentResponse.body.gatewayOrderId).toBeDefined();
    expect(paymentResponse.body.checkoutPayload).toBeDefined();
    
    // 4. Simulate webhook (payment captured)
    const webhookResponse = await request(app)
      .post('/api/payments/webhook')
      .set('x-razorpay-signature', generateValidSignature())
      .send({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_123',
              order_id: paymentResponse.body.gatewayOrderId,
              amount: 10000,
              currency: 'INR'
            }
          }
        }
      });
    
    expect(webhookResponse.status).toBe(200);
    
    // 5. Verify order status updated
    const updatedOrder = await request(app)
      .get(`/api/orders/${orderResponse.body.order._id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(updatedOrder.body.order.paymentStatus).toBe('paid');
  });
});
```

**Scenario 3: Email OTP Delivery**
```typescript
describe('Integration: Email OTP Delivery', () => {
  test('Email OTP is sent via Resend or Gmail', async () => {
    const emailSpy = jest.spyOn(emailService, 'send');
    
    const response = await request(app)
      .post('/api/auth/send-email-otp')
      .send({ email: 'test@example.com' });
    
    expect(response.status).toBe(200);
    expect(response.body.otp).toBeUndefined(); // OTP not in response
    expect(emailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('OTP')
      })
    );
  });
});
```

**Scenario 4: Environment Validation on Startup**
```typescript
describe('Integration: Startup Validation', () => {
  test('Application starts successfully with valid config', async () => {
    const result = await startAppInChildProcess(validEnv);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✅ Environment validation passed');
    expect(result.stdout).toContain('Server started on port');
  });
  
  test('Application fails to start with invalid config', async () => {
    const invalidEnv = { ...validEnv };
    delete invalidEnv.JWT_SECRET;
    
    const result = await startAppInChildProcess(invalidEnv);
    
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('JWT_SECRET is required but not set');
    expect(result.stdout).not.toContain('Server started');
  });
});
```

**Scenario 5: Debug Endpoint Security**
```typescript
describe('Integration: Debug Endpoint Security', () => {
  test('Debug endpoints not accessible in production', async () => {
    process.env.NODE_ENV = 'production';
    await startApp(validEnv);
    
    const response = await request(app)
      .get('/api/debug-user/123');
    
    expect(response.status).toBe(404);
  });
  
  test('Debug endpoints require admin auth in development', async () => {
    process.env.NODE_ENV = 'development';
    await startApp(validEnv);
    
    // Without auth
    const unauthResponse = await request(app)
      .get('/api/debug-user/123');
    
    expect(unauthResponse.status).toBe(401);
    
    // With admin auth
    const { accessToken } = await loginAdmin();
    const authResponse = await request(app)
      .get('/api/debug-user/123')
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(authResponse.status).toBe(200);
  });
});
```

**Scenario 6: Credential Rotation**
```typescript
describe('Integration: Credential Rotation', () => {
  test('Application detects and rejects exposed credentials', async () => {
    const exposedEnv = {
      ...validEnv,
      RESEND_API_KEY: 're_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx'
    };
    
    const result = await startAppInChildProcess(exposedEnv);
    
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('EXPOSED key');
    expect(result.stderr).toContain('MUST be changed immediately');
  });
  
  test('Application accepts new credentials after rotation', async () => {
    const rotatedEnv = {
      ...validEnv,
      RESEND_API_KEY: 're_new_rotated_key_12345'
    };
    
    const result = await startAppInChildProcess(rotatedEnv);
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✅ Environment validation passed');
  });
});
```

**Integration Test Execution**:
- Run against real MongoDB instance (test database)
- Mock external services (Resend, Razorpay) or use test accounts
- Use child process spawning to test startup behavior
- Total execution time: ~5-10 minutes

**Test Environment Setup**:
```typescript
// test/setup.ts
beforeAll(async () => {
  // Start MongoDB test instance
  await startMongoMemoryServer();
  
  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = generateTestSecret(64);
  process.env.JWT_REFRESH_SECRET = generateTestSecret(64);
  // ... other test credentials
});

afterAll(async () => {
  // Clean up
  await stopMongoMemoryServer();
});
```


## Testing Summary

### Test Coverage Matrix

| Bug Condition | Exploratory Test | Fix Check Test | Preservation Test | PBT Property | Integration Test |
|---------------|------------------|----------------|-------------------|--------------|------------------|
| 1.1 Missing JWT_SECRET | ✓ | ✓ | ✓ | ✓ (Prop 1,2) | ✓ (Scenario 4) |
| 1.2 Missing RESEND_API_KEY | ✓ | ✓ | ✓ | ✓ (Prop 1,2) | ✓ (Scenario 4) |
| 1.3 Missing Gmail credentials | ✓ | ✓ | ✓ | ✓ (Prop 1,2) | ✓ (Scenario 4) |
| 1.4 Missing Razorpay credentials | ✓ | ✓ | ✓ | ✓ (Prop 1,2) | ✓ (Scenario 4) |
| 1.5 Missing MONGODB_URI | ✓ | ✓ | ✓ | ✓ (Prop 1,2) | ✓ (Scenario 4) |
| 1.6 Missing GOOGLE_MAPS_API_KEY | ✓ | ✓ | ✓ | ✓ (Prop 1,2) | ✓ (Scenario 4) |
| 1.7 OTP in API response | ✓ | ✓ | ✓ | ✓ (Prop 3) | ✓ (Scenario 1,3) |
| 1.8 Unsecured debug endpoints | ✓ | ✓ | ✓ | ✓ (Prop 8) | ✓ (Scenario 5) |
| 1.9 Short JWT_SECRET | ✓ | ✓ | ✓ | ✓ (Prop 4) | ✓ (Scenario 4) |
| 1.10 Invalid RAZORPAY_KEY_ID format | ✓ | ✓ | ✓ | ✓ (Prop 5) | ✓ (Scenario 2) |
| 1.11 Invalid RESEND_API_KEY format | ✓ | ✓ | ✓ | ✓ (Prop 6) | ✓ (Scenario 3) |
| 1.12 Exposed API keys | ✓ | ✓ | ✓ | ✓ (Prop 9) | ✓ (Scenario 6) |
| 1.13 Identical JWT secrets | ✓ | ✓ | ✓ | ✓ (Prop 1,2) | ✓ (Scenario 4) |
| 1.14 Test credentials in production | ✓ | ✓ | ✓ | ✓ (Prop 10) | ✓ (Scenario 4) |
| 1.15 Missing required variables | ✓ | ✓ | ✓ | ✓ (Prop 1,2) | ✓ (Scenario 4) |
| 1.16 Invalid NODE_ENV | ✓ | ✓ | ✓ | ✓ (Prop 1,2) | ✓ (Scenario 4) |
| 1.17 Invalid MONGODB_URI format | ✓ | ✓ | ✓ | ✓ (Prop 7) | ✓ (Scenario 4) |
| 1.18 Default JWT_SECRET | ✓ | ✓ | ✓ | ✓ (Prop 9) | ✓ (Scenario 6) |

**Coverage Statistics**:
- Total Bug Conditions: 18
- Exploratory Tests: 10 (covers all 18 conditions)
- Fix Check Tests: 18 (one per condition)
- Preservation Tests: 30 (covers all unchanged behaviors)
- PBT Properties: 10 (covers all critical properties)
- Integration Tests: 6 scenarios (covers end-to-end flows)
- Total Tests: ~200 unit + 18 fix + 30 preservation + 10 PBT + 6 integration = ~264 tests

### Test Execution Plan

**Phase 1: Exploratory Testing (Before Fix)**
1. Run exploratory tests on UNFIXED code
2. Document all failures (expected)
3. Confirm root cause analysis
4. Estimated time: 1 hour

**Phase 2: Implementation**
1. Implement all 10 changes from Fix Implementation section
2. Estimated time: 2-3 hours

**Phase 3: Fix Checking (After Fix)**
1. Run fix check tests on FIXED code
2. Verify all 18 bug conditions now fail-fast
3. Estimated time: 30 minutes

**Phase 4: Preservation Checking (After Fix)**
1. Run preservation tests on FIXED code
2. Verify all existing functionality works
3. Run property-based tests (100 iterations each)
4. Estimated time: 1 hour

**Phase 5: Integration Testing (After Fix)**
1. Run integration tests on FIXED code
2. Verify end-to-end flows work correctly
3. Estimated time: 30 minutes

**Phase 6: Manual Verification**
1. Start application with valid config → should start
2. Start application with invalid config → should fail
3. Test OTP flow → OTP not in response
4. Test payment flow → works correctly
5. Test debug endpoints → secured or removed
6. Estimated time: 30 minutes

**Total Testing Time**: ~6 hours

### Success Criteria

**Fix is considered successful if**:
1. All 18 bug conditions trigger fail-fast behavior (exit code 1)
2. All preservation tests pass (no regressions)
3. All property-based tests pass (100 iterations each)
4. All integration tests pass (end-to-end flows work)
5. Manual verification confirms expected behavior
6. Code review approves changes
7. Security audit confirms vulnerabilities are fixed

**Deployment Checklist**:
- [ ] All tests pass
- [ ] Exposed credentials revoked and rotated
- [ ] .env.example updated
- [ ] Documentation updated (README, SECURITY.md)
- [ ] Team notified of changes
- [ ] Staging deployment successful
- [ ] Production deployment planned
- [ ] Rollback plan prepared
- [ ] Monitoring alerts configured


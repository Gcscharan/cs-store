# Voice AI Queue System - Requirements

## Overview

Transform the voice AI system from synchronous direct-to-DB writes to an async queue-based architecture that can handle 1M+ concurrent users without DB spikes or request slowdowns.

## Problem Statement

**Current Architecture (Broken at Scale)**:
```
User Action → API → Direct DB Write → Response
```

**Issues**:
- DB spikes under high load
- Request slowdown when DB is busy
- No retry logic for failed writes
- Single point of failure
- Cannot scale horizontally

**Target Architecture (Scale-Ready)**:
```
User Action → API → Queue → Worker → DB
                  ↓
              Immediate Response
```

## Business Requirements

### BR-1: High Throughput
- **Requirement**: Handle 10,000+ voice corrections/sec
- **Rationale**: 1M concurrent users, each making ~10 corrections/hour
- **Success Criteria**: Queue never blocks API requests

### BR-2: Zero Data Loss
- **Requirement**: Every correction and click must be persisted
- **Rationale**: Learning data is business-critical
- **Success Criteria**: Failed jobs retry automatically, dead letter queue for manual recovery

### BR-3: Low Latency
- **Requirement**: API response time < 50ms
- **Rationale**: User experience must not degrade
- **Success Criteria**: Queue write is non-blocking, response immediate

### BR-4: Fault Tolerance
- **Requirement**: System survives Redis/Worker failures
- **Rationale**: 1000000 crore project cannot have downtime
- **Success Criteria**: Graceful degradation, automatic recovery

### BR-5: Observability
- **Requirement**: Real-time monitoring of queue health
- **Rationale**: Operations team needs visibility
- **Success Criteria**: Metrics for queue depth, processing rate, failures

## Functional Requirements

### FR-1: Queue Infrastructure
- Use BullMQ (Redis-based) for job queue
- Separate queues for different job types:
  - `voice:corrections` - Learning corrections
  - `voice:clicks` - Click tracking
  - `voice:sync` - User data sync
- Job priority levels (high/normal/low)
- Configurable concurrency per queue

### FR-2: Job Processing
- Worker processes consume jobs from queue
- Automatic retry with exponential backoff
- Dead letter queue for failed jobs after max retries
- Job deduplication (prevent duplicate processing)
- Idempotent job handlers

### FR-3: API Integration
- Replace direct DB writes with queue.add()
- Immediate response to client (202 Accepted)
- Job ID returned for tracking
- Optional webhook for job completion

### FR-4: Monitoring & Metrics
- Queue depth (current jobs waiting)
- Processing rate (jobs/sec)
- Success/failure rate
- Average processing time
- Worker health status

### FR-5: Admin Dashboard
- View queue status
- Retry failed jobs
- Purge queue
- View dead letter queue
- Manual job submission

## Non-Functional Requirements

### NFR-1: Performance
- Queue write latency: < 5ms
- Job processing latency: < 100ms
- Worker throughput: 1000+ jobs/sec per worker

### NFR-2: Scalability
- Horizontal scaling: Add more workers
- Queue capacity: 1M+ jobs
- Redis cluster support for sharding

### NFR-3: Reliability
- Job persistence (Redis AOF/RDB)
- Automatic retry (max 3 attempts)
- Dead letter queue retention: 7 days
- Worker crash recovery

### NFR-4: Security
- Redis authentication
- Job payload encryption (optional)
- Rate limiting per user
- Job size limits (max 1MB)

### NFR-5: Maintainability
- Structured logging
- Health check endpoints
- Graceful shutdown
- Configuration via environment variables

## Technical Requirements

### TR-1: Technology Stack
- **Queue**: BullMQ (Redis-based)
- **Redis**: Redis 6+ (with streams support)
- **Worker**: Node.js worker processes
- **Monitoring**: Bull Board (web UI)

### TR-2: Job Schema
```typescript
interface VoiceCorrectionJob {
  type: 'correction';
  data: {
    wrong: string;
    correct: string;
    productId: string;
    userId?: string;
    confidence: number;
  };
  metadata: {
    timestamp: number;
    source: 'api' | 'sync';
    requestId: string;
  };
}

interface VoiceClickJob {
  type: 'click';
  data: {
    productId: string;
    productName: string;
    userId: string;
    query: string;
    isVoice: boolean;
    sessionId?: string;
  };
  metadata: {
    timestamp: number;
    requestId: string;
  };
}
```

### TR-3: Queue Configuration
```typescript
{
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 2s, 4s
    },
    removeOnComplete: 100, // Keep last 100
    removeOnFail: 1000,    // Keep last 1000 failures
  },
  limiter: {
    max: 1000,      // Max 1000 jobs
    duration: 1000, // Per second
  },
}
```

### TR-4: Worker Configuration
```typescript
{
  concurrency: 10,        // Process 10 jobs concurrently
  maxStalledCount: 3,     // Max stalled retries
  stalledInterval: 30000, // Check every 30s
  lockDuration: 30000,    // Lock job for 30s
}
```

## Data Flow

### Correction Flow
```
1. POST /api/voice/correction
   ↓
2. Validate request
   ↓
3. Add job to queue (voice:corrections)
   ↓
4. Return 202 Accepted { jobId: "..." }
   ↓
5. Worker picks up job
   ↓
6. Process correction (save to MongoDB)
   ↓
7. Mark job complete
   ↓
8. (Optional) Webhook callback
```

### Click Flow
```
1. POST /api/voice/click
   ↓
2. Validate request
   ↓
3. Add job to queue (voice:clicks)
   ↓
4. Return 202 Accepted { jobId: "..." }
   ↓
5. Worker picks up job
   ↓
6. Save click to MongoDB
   ↓
7. Mark job complete
```

## Error Handling

### Retry Strategy
- **Attempt 1**: Immediate
- **Attempt 2**: After 1 second
- **Attempt 3**: After 2 seconds
- **Attempt 4**: After 4 seconds
- **Failed**: Move to dead letter queue

### Failure Scenarios
1. **Redis down**: Graceful degradation (log error, return 503)
2. **MongoDB down**: Retry with backoff, move to DLQ after max attempts
3. **Worker crash**: Job returns to queue, picked up by another worker
4. **Invalid job data**: Move to DLQ immediately (no retry)

## Monitoring & Alerts

### Metrics to Track
- `voice_queue_depth` - Current jobs in queue
- `voice_queue_processing_rate` - Jobs/sec
- `voice_queue_success_rate` - Success %
- `voice_queue_failure_rate` - Failure %
- `voice_queue_latency_p95` - 95th percentile latency
- `voice_worker_active` - Active workers
- `voice_dlq_size` - Dead letter queue size

### Alerts
- Queue depth > 10,000 (WARNING)
- Queue depth > 50,000 (CRITICAL)
- Success rate < 95% (WARNING)
- Success rate < 90% (CRITICAL)
- No active workers (CRITICAL)
- DLQ size > 1,000 (WARNING)

## Migration Strategy

### Phase 1: Parallel Run (Week 1)
- Deploy queue system
- Write to both queue AND direct DB
- Compare results
- Monitor for discrepancies

### Phase 2: Queue Primary (Week 2)
- Switch to queue-first
- Direct DB as fallback
- Monitor error rates

### Phase 3: Queue Only (Week 3)
- Remove direct DB writes
- Queue is single source of truth
- Full monitoring in place

## Success Criteria

1. ✅ API response time < 50ms (99th percentile)
2. ✅ Queue processing rate > 10,000 jobs/sec
3. ✅ Zero data loss (all jobs processed or in DLQ)
4. ✅ Worker auto-scaling based on queue depth
5. ✅ Admin dashboard operational
6. ✅ Monitoring and alerts configured
7. ✅ Load test: 1M corrections in 1 hour (no failures)

## Out of Scope

- Kafka/RabbitMQ (using BullMQ for simplicity)
- Multi-region replication (future)
- Real-time streaming (future)
- ML model training pipeline (separate spec)

## Dependencies

- Redis 6+ installed and configured
- MongoDB replica set (already in place)
- Node.js worker processes
- Bull Board for monitoring

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Redis single point of failure | HIGH | Redis Sentinel for HA |
| Queue fills up faster than processing | HIGH | Auto-scale workers, alerts |
| Job data corruption | MEDIUM | Schema validation, DLQ |
| Worker memory leak | MEDIUM | Worker restart policy, monitoring |

## Timeline

- **Week 1**: Queue infrastructure + basic workers
- **Week 2**: Monitoring + admin dashboard
- **Week 3**: Migration + load testing
- **Week 4**: Production deployment + monitoring

---

**This is the foundation for 1M+ user scale. Every subsequent layer depends on this.**

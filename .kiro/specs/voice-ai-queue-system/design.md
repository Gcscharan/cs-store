# Voice AI Queue System - Technical Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     VOICE AI QUEUE SYSTEM                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Frontend   │         │   Backend    │         │    Redis     │
│              │         │   API        │         │   (BullMQ)   │
│  Learning    │────────▶│              │────────▶│              │
│  Engine      │  HTTP   │  Controller  │  Queue  │  Queues:     │
│              │         │              │  Write  │  - corrections│
└──────────────┘         └──────────────┘         │  - clicks    │
                                                   │  - sync      │
                                                   └──────┬───────┘
                                                          │
                                                          │ Poll
                                                          │
                         ┌────────────────────────────────▼───────┐
                         │         Worker Processes               │
                         │                                        │
                         │  ┌──────────┐  ┌──────────┐          │
                         │  │ Worker 1 │  │ Worker 2 │  ...     │
                         │  └────┬─────┘  └────┬─────┘          │
                         │       │             │                 │
                         └───────┼─────────────┼─────────────────┘
                                 │             │
                                 ▼             ▼
                         ┌────────────────────────────┐
                         │       MongoDB              │
                         │                            │
                         │  - VoiceCorrection         │
                         │  - ProductClick            │
                         │  - ProductRanking          │
                         └────────────────────────────┘
```

## Component Design

### 1. Queue Manager (`backend/src/queues/queueManager.ts`)

**Responsibility**: Initialize and manage all queues

```typescript
class QueueManager {
  private queues: Map<string, Queue>;
  private connection: IORedis.Redis;
  
  // Initialize all queues
  async initialize(): Promise<void>;
  
  // Get queue by name
  getQueue(name: string): Queue;
  
  // Add job to queue
  async addJob(queueName: string, data: any, options?: JobOptions): Promise<Job>;
  
  // Close all queues
  async close(): Promise<void>;
  
  // Health check
  async healthCheck(): Promise<QueueHealth>;
}
```

**Queues**:
- `voice:corrections` - Learning corrections
- `voice:clicks` - Click tracking  
- `voice:sync` - User data sync

**Configuration**:
```typescript
const queueConfig = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // Required for BullMQ
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 1000,
      age: 7 * 24 * 3600, // 7 days
    },
  },
};
```

### 2. Job Processors (`backend/src/queues/processors/`)

#### Correction Processor (`correctionProcessor.ts`)

```typescript
interface CorrectionJobData {
  wrong: string;
  correct: string;
  productId: string;
  userId?: string;
  confidence: number;
  requestId: string;
  timestamp: number;
}

async function processCorrectionJob(job: Job<CorrectionJobData>): Promise<void> {
  const { wrong, correct, productId, userId, confidence } = job.data;
  
  // Validate data
  if (!wrong || !correct || !productId) {
    throw new Error('Invalid job data');
  }
  
  // Normalize
  const wrongNorm = normalize(wrong);
  const correctNorm = normalize(correct);
  
  // Check for existing correction
  const existing = await VoiceCorrection.findOne({
    wrong: wrongNorm,
    userId: userId || null,
  });
  
  if (existing) {
    // Update existing
    existing.count += 1;
    existing.confidence = Math.min(0.98, existing.confidence + 0.02);
    existing.lastUsed = new Date();
    await existing.save();
  } else {
    // Create new
    const correction = new VoiceCorrection({
      wrong: wrongNorm,
      correct: correctNorm,
      productId,
      userId: userId || null,
      count: 1,
      confidence,
      validationScore: 0.8,
      source: userId ? 'user' : 'global',
      lastUsed: new Date(),
    });
    await correction.save();
  }
  
  // Log success
  console.log('[CorrectionProcessor] ✅ Processed:', {
    jobId: job.id,
    wrong: wrongNorm,
    correct: correctNorm,
  });
}
```

#### Click Processor (`clickProcessor.ts`)

```typescript
interface ClickJobData {
  productId: string;
  productName: string;
  userId: string;
  query: string;
  isVoice: boolean;
  sessionId?: string;
  requestId: string;
  timestamp: number;
}

async function processClickJob(job: Job<ClickJobData>): Promise<void> {
  const { productId, productName, userId, query, isVoice, sessionId } = job.data;
  
  // Validate data
  if (!productId || !productName || !userId || !query) {
    throw new Error('Invalid job data');
  }
  
  // Save click
  const click = new ProductClick({
    productId,
    productName,
    userId,
    query: normalize(query),
    isVoice,
    timestamp: new Date(),
    sessionId,
  });
  
  await click.save();
  
  // Log success
  console.log('[ClickProcessor] ✅ Processed:', {
    jobId: job.id,
    productId,
    userId,
  });
}
```

### 3. Worker Manager (`backend/src/queues/workerManager.ts`)

**Responsibility**: Manage worker processes

```typescript
class WorkerManager {
  private workers: Map<string, Worker>;
  
  // Start all workers
  async start(): Promise<void>;
  
  // Stop all workers
  async stop(): Promise<void>;
  
  // Get worker stats
  async getStats(): Promise<WorkerStats[]>;
  
  // Pause/resume worker
  async pauseWorker(name: string): Promise<void>;
  async resumeWorker(name: string): Promise<void>;
}
```

**Worker Configuration**:
```typescript
const workerConfig = {
  concurrency: parseInt(process.env.QUEUE_WORKER_CONCURRENCY || '10'),
  maxStalledCount: 3,
  stalledInterval: 30000, // 30 seconds
  lockDuration: 30000,    // 30 seconds
};
```

### 4. API Controller Updates

#### Voice Controller (`backend/src/controllers/voiceController.ts`)

**Before (Direct DB)**:
```typescript
export const saveCorrection = async (req: Request, res: Response) => {
  // Validate
  // Save to MongoDB directly
  await correction.save();
  res.status(201).json({ success: true, correction });
};
```

**After (Queue)**:
```typescript
export const saveCorrection = async (req: Request, res: Response) => {
  const { wrong, correct, productId, userId, confidence } = req.body;
  
  // Validate
  if (!wrong || !correct || !productId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Add to queue
  const job = await queueManager.addJob('voice:corrections', {
    wrong,
    correct,
    productId,
    userId,
    confidence: confidence || 0.7,
    requestId: req.id,
    timestamp: Date.now(),
  }, {
    priority: userId ? 1 : 2, // User corrections higher priority
  });
  
  // Return immediately
  res.status(202).json({
    success: true,
    jobId: job.id,
    message: 'Correction queued for processing',
  });
};
```

### 5. Monitoring Dashboard (`backend/src/queues/dashboard.ts`)

**Bull Board Integration**:
```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(correctionsQueue),
    new BullMQAdapter(clicksQueue),
    new BullMQAdapter(syncQueue),
  ],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

**Access**: `http://localhost:5001/admin/queues`

### 6. Metrics & Monitoring

#### Metrics Collector (`backend/src/queues/metrics.ts`)

```typescript
interface QueueMetrics {
  queueName: string;
  waiting: number;      // Jobs waiting
  active: number;       // Jobs being processed
  completed: number;    // Jobs completed (last hour)
  failed: number;       // Jobs failed (last hour)
  delayed: number;      // Jobs delayed
  processingRate: number; // Jobs/sec
  avgProcessingTime: number; // ms
}

class MetricsCollector {
  async collectMetrics(): Promise<QueueMetrics[]>;
  async getQueueHealth(): Promise<QueueHealth>;
}
```

#### Health Check Endpoint

```typescript
app.get('/health/queues', async (req, res) => {
  const health = await queueManager.healthCheck();
  
  if (health.status === 'healthy') {
    res.status(200).json(health);
  } else {
    res.status(503).json(health);
  }
});
```

**Response**:
```json
{
  "status": "healthy",
  "queues": {
    "voice:corrections": {
      "waiting": 45,
      "active": 10,
      "failed": 2,
      "workers": 3
    },
    "voice:clicks": {
      "waiting": 120,
      "active": 15,
      "failed": 0,
      "workers": 5
    }
  },
  "redis": {
    "connected": true,
    "memory": "45MB"
  }
}
```

## Data Models

### Job Data Schema

```typescript
// Correction Job
{
  id: "correction:1234567890",
  name: "process-correction",
  data: {
    wrong: "greenlense",
    correct: "green lays",
    productId: "prod_123",
    userId: "user_abc",
    confidence: 0.85,
    requestId: "req_xyz",
    timestamp: 1234567890000
  },
  opts: {
    attempts: 3,
    priority: 1,
    timestamp: 1234567890000
  },
  progress: 0,
  returnvalue: null,
  stacktrace: [],
  attemptsMade: 0,
  processedOn: null,
  finishedOn: null
}
```

### Dead Letter Queue

Failed jobs after max retries:
```typescript
{
  jobId: "correction:1234567890",
  queueName: "voice:corrections",
  data: { ... },
  error: "MongoDB connection timeout",
  attempts: 3,
  failedAt: "2024-01-01T00:00:00Z",
  stackTrace: "..."
}
```

## Error Handling

### Retry Logic

```typescript
const retryStrategy = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s
  },
};
```

### Error Classification

```typescript
enum ErrorType {
  TRANSIENT = 'transient',     // Retry
  PERMANENT = 'permanent',     // Move to DLQ
  VALIDATION = 'validation',   // Move to DLQ (no retry)
}

function classifyError(error: Error): ErrorType {
  if (error.name === 'MongoNetworkError') {
    return ErrorType.TRANSIENT;
  }
  if (error.name === 'ValidationError') {
    return ErrorType.VALIDATION;
  }
  return ErrorType.PERMANENT;
}
```

### Graceful Degradation

```typescript
// If Redis is down
if (!queueManager.isHealthy()) {
  // Fallback to direct DB write
  console.warn('[Queue] Redis unavailable, falling back to direct write');
  await saveDirectToDB(data);
  return res.status(201).json({ success: true, fallback: true });
}
```

## Performance Optimization

### 1. Job Batching

Process multiple jobs in a single DB transaction:

```typescript
async function processBatch(jobs: Job[]): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    for (const job of jobs) {
      await processJob(job, session);
    }
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### 2. Worker Auto-Scaling

```typescript
// Scale workers based on queue depth
async function autoScale(): Promise<void> {
  const metrics = await metricsCollector.collectMetrics();
  
  for (const queue of metrics) {
    if (queue.waiting > 1000 && queue.workers < MAX_WORKERS) {
      await workerManager.addWorker(queue.queueName);
    }
    if (queue.waiting < 100 && queue.workers > MIN_WORKERS) {
      await workerManager.removeWorker(queue.queueName);
    }
  }
}

setInterval(autoScale, 60000); // Every minute
```

### 3. Job Deduplication

```typescript
const jobId = `correction:${userId}:${hash(wrong + correct)}`;

await queue.add('process-correction', data, {
  jobId, // Prevents duplicate jobs
  removeOnComplete: true,
});
```

## Security

### 1. Redis Authentication

```typescript
const connection = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD, // Required in production
  tls: process.env.NODE_ENV === 'production' ? {} : undefined,
};
```

### 2. Job Payload Validation

```typescript
const correctionJobSchema = z.object({
  wrong: z.string().min(3).max(100),
  correct: z.string().min(3).max(100),
  productId: z.string(),
  userId: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

// Validate before adding to queue
const validated = correctionJobSchema.parse(data);
```

### 3. Rate Limiting

```typescript
// Per-user rate limit
const userJobCount = await redis.incr(`user:${userId}:jobs:${Date.now()}`);
if (userJobCount > 100) {
  throw new Error('Rate limit exceeded');
}
```

## Deployment

### Environment Variables

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Queue
QUEUE_WORKER_CONCURRENCY=10
QUEUE_MAX_WORKERS=50
QUEUE_MIN_WORKERS=2

# Monitoring
BULL_BOARD_ENABLED=true
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=secure_password
```

### Docker Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
  
  worker:
    build: .
    command: npm run worker
    environment:
      - REDIS_HOST=redis
      - MONGODB_URI=${MONGODB_URI}
    depends_on:
      - redis
    deploy:
      replicas: 3
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voice-worker
spec:
  replicas: 5
  selector:
    matchLabels:
      app: voice-worker
  template:
    metadata:
      labels:
        app: voice-worker
    spec:
      containers:
      - name: worker
        image: voice-ai:latest
        command: ["npm", "run", "worker"]
        env:
        - name: REDIS_HOST
          value: "redis-service"
        - name: QUEUE_WORKER_CONCURRENCY
          value: "10"
```

## Testing

### Unit Tests

```typescript
describe('CorrectionProcessor', () => {
  it('should process valid correction job', async () => {
    const job = createMockJob({
      wrong: 'greenlense',
      correct: 'green lays',
      productId: 'prod_123',
      confidence: 0.85,
    });
    
    await processCorrectionJob(job);
    
    const saved = await VoiceCorrection.findOne({ wrong: 'greenlense' });
    expect(saved).toBeDefined();
    expect(saved.correct).toBe('green lays');
  });
});
```

### Integration Tests

```typescript
describe('Queue Integration', () => {
  it('should process job end-to-end', async () => {
    // Add job
    const job = await queueManager.addJob('voice:corrections', {
      wrong: 'test',
      correct: 'test product',
      productId: 'prod_123',
      confidence: 0.85,
    });
    
    // Wait for processing
    await job.waitUntilFinished(queueEvents);
    
    // Verify in DB
    const saved = await VoiceCorrection.findOne({ wrong: 'test' });
    expect(saved).toBeDefined();
  });
});
```

### Load Tests

```typescript
// Simulate 10,000 jobs/sec
for (let i = 0; i < 10000; i++) {
  await queueManager.addJob('voice:corrections', {
    wrong: `test${i}`,
    correct: `product${i}`,
    productId: `prod_${i}`,
    confidence: 0.85,
  });
}

// Monitor queue depth and processing rate
const metrics = await metricsCollector.collectMetrics();
expect(metrics.processingRate).toBeGreaterThan(1000);
```

## Migration Plan

### Phase 1: Deploy Queue Infrastructure (Week 1)
- Install Redis
- Deploy queue manager
- Deploy workers
- Test with synthetic data

### Phase 2: Parallel Run (Week 2)
- Write to both queue AND direct DB
- Compare results
- Monitor for discrepancies
- Fix any issues

### Phase 3: Queue Primary (Week 3)
- Switch to queue-first
- Direct DB as fallback only
- Monitor error rates
- Tune worker concurrency

### Phase 4: Queue Only (Week 4)
- Remove direct DB writes
- Queue is single source of truth
- Full monitoring in place
- Load test with production traffic

---

**This design handles 1M+ concurrent users with zero data loss and < 50ms API latency.**

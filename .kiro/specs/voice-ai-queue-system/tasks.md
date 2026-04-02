# Voice AI Queue System - Implementation Tasks

## Phase 1: Queue Infrastructure (Week 1)

### 1. Setup Redis & BullMQ Dependencies
- [x] 1.1 Install Redis dependencies
  - [x] 1.1.1 Add `bullmq`, `ioredis` to package.json
  - [x] 1.1.2 Add `@bull-board/api`, `@bull-board/express`, `@bull-board/ui` for monitoring
  - [x] 1.1.3 Run `npm install`
- [x] 1.2 Configure Redis connection
  - [x] 1.2.1 Add Redis env variables to `.env.example`
  - [x] 1.2.2 Create `backend/src/config/redis.ts` for connection config
  - [x] 1.2.3 Add Redis health check to existing health endpoint

### 2. Create Queue Manager
- [x] 2.1 Create queue manager module
  - [x] 2.1.1 Create `backend/src/queues/queueManager.ts`
  - [x] 2.1.2 Implement `QueueManager` class with initialize, getQueue, addJob, close methods
  - [x] 2.1.3 Define queue configurations (corrections, clicks, sync)
  - [x] 2.1.4 Add job options (retry, backoff, removal policies)
- [x] 2.2 Create queue types
  - [x] 2.2.1 Create `backend/src/queues/types.ts` for job data interfaces
  - [x] 2.2.2 Define `CorrectionJobData` interface
  - [x] 2.2.3 Define `ClickJobData` interface
  - [x] 2.2.4 Define `SyncJobData` interface

### 3. Create Job Processors
- [x] 3.1 Create correction processor
  - [x] 3.1.1 Create `backend/src/queues/processors/correctionProcessor.ts`
  - [x] 3.1.2 Implement `processCorrectionJob` function
  - [x] 3.1.3 Add data validation
  - [x] 3.1.4 Add error handling with classification
  - [x] 3.1.5 Add logging
- [x] 3.2 Create click processor
  - [x] 3.2.1 Create `backend/src/queues/processors/clickProcessor.ts`
  - [x] 3.2.2 Implement `processClickJob` function
  - [x] 3.2.3 Add data validation
  - [x] 3.2.4 Add error handling
  - [x] 3.2.5 Add logging
- [x] 3.3 Create sync processor
  - [x] 3.3.1 Create `backend/src/queues/processors/syncProcessor.ts`
  - [x] 3.3.2 Implement `processSyncJob` function
  - [x] 3.3.3 Add batch processing logic
  - [x] 3.3.4 Add error handling

### 4. Create Worker Manager
- [x] 4.1 Create worker manager module
  - [x] 4.1.1 Create `backend/src/queues/workerManager.ts`
  - [x] 4.1.2 Implement `WorkerManager` class
  - [x] 4.1.3 Add start/stop methods
  - [x] 4.1.4 Add worker configuration (concurrency, stalled handling)
  - [x] 4.1.5 Connect workers to processors
- [x] 4.2 Add worker lifecycle management
  - [x] 4.2.1 Add graceful shutdown handling
  - [x] 4.2.2 Add worker health monitoring
  - [x] 4.2.3 Add worker restart on crash

### 5. Update API Controllers
- [x] 5.1 Update voice controller for corrections
  - [x] 5.1.1 Modify `saveCorrection` to use queue instead of direct DB
  - [x] 5.1.2 Return 202 Accepted with jobId
  - [x] 5.1.3 Add fallback to direct DB if queue unavailable
  - [x] 5.1.4 Add request ID tracking
- [x] 5.2 Update voice controller for clicks
  - [x] 5.2.1 Modify `trackClick` to use queue
  - [x] 5.2.2 Return 202 Accepted with jobId
  - [x] 5.2.3 Add fallback logic
- [x] 5.3 Update voice controller for sync
  - [x] 5.3.1 Modify `syncUserData` to use queue
  - [x] 5.3.2 Add batch job creation for multiple corrections

### 6. Initialize Queue System in Server
- [x] 6.1 Add queue initialization to server startup
  - [x] 6.1.1 Import queueManager in `backend/src/index.ts`
  - [x] 6.1.2 Call `queueManager.initialize()` after MongoDB connection
  - [x] 6.1.3 Start workers with `workerManager.start()`
  - [x] 6.1.4 Add graceful shutdown for queues
- [x] 6.2 Add queue health to health endpoint
  - [x] 6.2.1 Update `/health` endpoint to include queue status
  - [x] 6.2.2 Add `/health/queues` dedicated endpoint

## Phase 2: Monitoring & Dashboard (Week 2)

### 7. Setup Bull Board Dashboard
- [x] 7.1 Create dashboard module
  - [x] 7.1.1 Create `backend/src/queues/dashboard.ts`
  - [x] 7.1.2 Initialize Bull Board with all queues
  - [x] 7.1.3 Configure Express adapter
  - [x] 7.1.4 Add authentication middleware
- [x] 7.2 Mount dashboard in app
  - [x] 7.2.1 Import dashboard in `backend/src/app.ts`
  - [x] 7.2.2 Mount at `/admin/queues` route
  - [x] 7.2.3 Add admin-only access control
  - [x] 7.2.4 Test dashboard access

### 8. Create Metrics Collector
- [x] 8.1 Create metrics module
  - [x] 8.1.1 Create `backend/src/queues/metrics.ts`
  - [x] 8.1.2 Implement `MetricsCollector` class
  - [x] 8.1.3 Add methods to collect queue metrics (depth, rate, latency)
  - [x] 8.1.4 Add worker metrics (active, idle, crashed)
- [x] 8.2 Create metrics endpoint
  - [x] 8.2.1 Create `/api/metrics/queues` endpoint
  - [x] 8.2.2 Return JSON metrics for monitoring tools
  - [x] 8.2.3 Add Prometheus format support (optional)

### 9. Add Logging & Observability
- [x] 9.1 Add structured logging
  - [x] 9.1.1 Add job lifecycle logs (queued, processing, completed, failed)
  - [x] 9.1.2 Add performance logs (processing time, queue depth)
  - [x] 9.1.3 Add error logs with stack traces
- [x] 9.2 Add request tracing
  - [x] 9.2.1 Pass request ID through job metadata
  - [x] 9.2.2 Log request ID in all job logs
  - [x] 9.2.3 Enable end-to-end tracing

### 10. Setup Alerts
- [x] 10.1 Create alert rules
  - [x] 10.1.1 Alert on queue depth > 10,000
  - [x] 10.1.2 Alert on success rate < 95%
  - [x] 10.1.3 Alert on no active workers
  - [x] 10.1.4 Alert on DLQ size > 1,000
- [x] 10.2 Integrate with monitoring system
  - [x] 10.2.1 Add webhook for alerts (Slack/PagerDuty)
  - [x] 10.2.2 Test alert delivery

## Phase 3: A/B Testing Hardening & Backend-Controlled Correction (Week 3)

### 11. Integrate Backend-Controlled Correction
- [ ] 11.1 Mount correction routes in app.ts
  - [ ] 11.1.1 Import voiceCorrectionRoutes in `backend/src/app.ts`
  - [ ] 11.1.2 Mount at `/api/voice` path
  - [ ] 11.1.3 Verify route is accessible
- [ ] 11.2 Build product dictionary on backend startup
  - [ ] 11.2.1 Fetch products in `backend/src/index.ts` after DB connection
  - [ ] 11.2.2 Call `correctionEngine.buildDictionary(products)` with fetched products
  - [ ] 11.2.3 Add periodic refresh (every 5 minutes)
  - [ ] 11.2.4 Add error handling for dictionary build failures
- [ ] 11.3 Update frontend to call backend correction API
  - [ ] 11.3.1 Create API client function in `apps/customer-app/src/api/voiceApi.ts`
  - [ ] 11.3.2 Add `correctVoiceQuery(query, userId)` function that calls POST `/api/voice/correct`
  - [ ] 11.3.3 Update `useVoiceSearch.ts` to call backend API instead of local `correctVoiceQuery()`
  - [ ] 11.3.4 Pass userId from auth context to correction API
  - [ ] 11.3.5 Handle API errors with fallback to original query
- [ ] 11.4 Test experiment integrity end-to-end
  - [ ] 11.4.1 Create test experiment with 2 variants (threshold 0.6 vs 0.7)
  - [ ] 11.4.2 Verify same userId gets same variant consistently
  - [ ] 11.4.3 Verify variant affects correction threshold in backend
  - [ ] 11.4.4 Verify metrics logging includes correct variant
  - [ ] 11.4.5 Verify correction behavior matches logged variant

### 12. Validate A/B Testing Hardening
- [ ] 12.1 Test SRM detection
  - [ ] 12.1.1 Create experiment with 50/50 split
  - [ ] 12.1.2 Simulate biased traffic (70/30)
  - [ ] 12.1.3 Verify `checkSRM()` detects the bias
  - [ ] 12.1.4 Verify experiment results show SRM warning
- [ ] 12.2 Test minimum sample size enforcement
  - [ ] 12.2.1 Create experiment with only 50 samples
  - [ ] 12.2.2 Call `getExperimentResults()`
  - [ ] 12.2.3 Verify returns "Not enough data" message
  - [ ] 12.2.4 Add 1000+ samples and verify results are returned
- [ ] 12.3 Test guardrail monitoring
  - [ ] 12.3.1 Create experiment with normal metrics
  - [ ] 12.3.2 Simulate latency spike (>1.2x baseline)
  - [ ] 12.3.3 Verify `checkGuardrails()` detects violation
  - [ ] 12.3.4 Verify auto-stop is triggered
- [ ] 12.4 Test statistical significance
  - [ ] 12.4.1 Create experiment with clear winner (10% improvement, 2000 samples)
  - [ ] 12.4.2 Verify `checkStatisticalSignificance()` returns p < 0.05
  - [ ] 12.4.3 Create experiment with no difference
  - [ ] 12.4.4 Verify significance check returns p > 0.05
- [ ] 12.5 Test auto-winner detection and deployment
  - [ ] 12.5.1 Create experiment with clear winner (2% improvement, 1000+ samples, p<0.05)
  - [ ] 12.5.2 Run experiment monitor job
  - [ ] 12.5.3 Verify `detectWinner()` identifies winning variant
  - [ ] 12.5.4 Verify auto-deploy updates experiment status
  - [ ] 12.5.5 Verify no auto-deploy when criteria not met

### 13. Write Unit Tests
- [ ] 13.1 Test queue manager
  - [ ] 13.1.1 Test queue initialization
  - [ ] 13.1.2 Test job addition
  - [ ] 13.1.3 Test queue closure
  - [ ] 13.1.4 Test error handling
- [ ] 13.2 Test processors
  - [ ] 13.2.1 Test correction processor with valid data
  - [ ] 13.2.2 Test correction processor with invalid data
  - [ ] 13.2.3 Test click processor
  - [ ] 13.2.4 Test retry logic
  - [ ] 13.2.5 Test DLQ movement
- [ ] 13.3 Test experiment hardening functions
  - [ ] 13.3.1 Test `checkSRM()` with various traffic splits
  - [ ] 13.3.2 Test `checkMinimumSampleSize()` with edge cases
  - [ ] 13.3.3 Test `checkGuardrails()` with metric violations
  - [ ] 13.3.4 Test `checkStatisticalSignificance()` with known datasets
  - [ ] 13.3.5 Test `detectWinner()` with various scenarios

### 14. Write Integration Tests
- [ ] 14.1 Test end-to-end flow
  - [ ] 14.1.1 Test API → Queue → Worker → DB flow
  - [ ] 14.1.2 Test job completion
  - [ ] 14.1.3 Test job failure and retry
  - [ ] 14.1.4 Test fallback to direct DB
- [ ] 14.2 Test concurrent processing
  - [ ] 14.2.1 Test multiple workers processing same queue
  - [ ] 14.2.2 Test job locking
  - [ ] 14.2.3 Test no duplicate processing
- [ ] 14.3 Test backend-controlled correction flow
  - [ ] 14.3.1 Test frontend → backend correction API → response
  - [ ] 14.3.2 Test experiment config affects correction threshold
  - [ ] 14.3.3 Test metrics logging captures variant correctly
  - [ ] 14.3.4 Test learned corrections are checked before algorithmic

### 15. Load Testing
- [ ] 15.1 Create load test scripts
  - [ ] 15.1.1 Script to generate 10,000 jobs/sec
  - [ ] 15.1.2 Script to monitor queue metrics during load
  - [ ] 15.1.3 Script to verify data integrity after load
- [ ] 15.2 Run load tests
  - [ ] 15.2.1 Test with 10,000 jobs/sec for 1 hour
  - [ ] 15.2.2 Test with 50,000 jobs/sec for 10 minutes
  - [ ] 15.2.3 Test with 100,000 jobs/sec for 1 minute
  - [ ] 15.2.4 Verify zero data loss
  - [ ] 15.2.5 Verify API latency < 50ms

### 16. Performance Optimization
- [ ] 16.1 Optimize worker concurrency
  - [ ] 16.1.1 Benchmark different concurrency levels (5, 10, 20, 50)
  - [ ] 16.1.2 Find optimal concurrency per worker
  - [ ] 16.1.3 Update default configuration
- [ ] 16.2 Implement job batching
  - [ ] 16.2.1 Add batch processor for corrections
  - [ ] 16.2.2 Process 10-50 jobs in single transaction
  - [ ] 16.2.3 Measure performance improvement
- [ ] 16.3 Add worker auto-scaling
  - [ ] 16.3.1 Implement auto-scale logic based on queue depth
  - [ ] 16.3.2 Add min/max worker limits
  - [ ] 16.3.3 Test scaling up and down

## Phase 4: Migration & Deployment (Week 4)

### 17. Parallel Run Migration
- [ ] 15.1 Deploy queue system to staging
  - [ ] 17.1.1 Deploy Redis to staging
  - [ ] 17.1.2 Deploy updated backend with queue code
  - [ ] 17.1.3 Start workers
  - [ ] 17.1.4 Verify dashboard access
- [ ] 17.2 Enable parallel writes
  - [ ] 17.2.1 Write to both queue AND direct DB
  - [ ] 17.2.2 Compare results for 24 hours
  - [ ] 17.2.3 Monitor for discrepancies
  - [ ] 17.2.4 Fix any issues found

### 18. Switch to Queue Primary
- [ ] 18.1 Update controllers to queue-first
  - [ ] 18.1.1 Make queue primary, direct DB fallback only
  - [ ] 18.1.2 Deploy to staging
  - [ ] 18.1.3 Monitor error rates for 48 hours
  - [ ] 18.1.4 Verify data integrity
- [ ] 18.2 Tune performance
  - [ ] 18.2.1 Adjust worker concurrency based on load
  - [ ] 18.2.2 Adjust queue limits
  - [ ] 18.2.3 Optimize Redis configuration

### 19. Production Deployment
- [ ] 19.1 Deploy to production
  - [ ] 19.1.1 Deploy Redis cluster (with Sentinel for HA)
  - [ ] 19.1.2 Deploy updated backend
  - [ ] 19.1.3 Start workers (5 instances initially)
  - [ ] 19.1.4 Enable monitoring and alerts
- [ ] 19.2 Monitor production
  - [ ] 19.2.1 Monitor queue metrics for 7 days
  - [ ] 19.2.2 Monitor API latency
  - [ ] 19.2.3 Monitor error rates
  - [ ] 19.2.4 Monitor worker health
- [ ] 19.3 Remove direct DB writes
  - [ ] 19.3.1 Remove fallback code after 7 days of stable operation
  - [ ] 19.3.2 Queue is now single source of truth
  - [ ] 19.3.3 Update documentation

### 20. Documentation
- [ ] 20.1 Create operational runbook
  - [ ] 20.1.1 Document queue system architecture
  - [ ] 20.1.2 Document how to add new job types
  - [ ] 20.1.3 Document how to scale workers
  - [ ] 20.1.4 Document troubleshooting steps
- [ ] 20.2 Create monitoring guide
  - [ ] 20.2.1 Document key metrics to watch
  - [ ] 20.2.2 Document alert thresholds
  - [ ] 20.2.3 Document dashboard usage
- [ ] 20.3 Update deployment guide
  - [ ] 20.3.1 Add Redis setup instructions
  - [ ] 20.3.2 Add worker deployment instructions
  - [ ] 20.3.3 Add environment variables documentation
- [ ] 20.4 Document A/B testing system
  - [ ] 20.4.1 Document how to create experiments
  - [ ] 20.4.2 Document hardening checks and auto-stop/deploy
  - [ ] 20.4.3 Document experiment monitoring and alerts
  - [ ] 20.4.4 Document backend-controlled correction architecture

## Success Criteria

- [ ] ✅ API response time < 50ms (99th percentile)
- [ ] ✅ Queue processing rate > 10,000 jobs/sec
- [ ] ✅ Zero data loss in load tests
- [ ] ✅ Worker auto-scaling functional
- [ ] ✅ Admin dashboard operational
- [ ] ✅ Monitoring and alerts configured
- [ ] ✅ Load test: 1M corrections in 1 hour (no failures)
- [ ] ✅ Production deployment successful
- [ ] ✅ 7 days of stable operation
- [ ] ✅ Backend-controlled correction integrated
- [ ] ✅ Experiment integrity validated (same variant → same behavior → same metrics)
- [ ] ✅ A/B testing hardening complete (SRM, sample size, guardrails, significance, auto-deploy)

---

**Total Estimated Time: 5 weeks**

**Priority: CRITICAL - This is the foundation for 1M+ user scale**

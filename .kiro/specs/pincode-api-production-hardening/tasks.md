# Implementation Plan: Pincode API Production Hardening

## Overview

This implementation plan converts the production hardening design into actionable coding tasks. The system currently functions well in development but requires hardening in seven critical areas: cache TTL optimization (24h → 10min), architecture compliance (remove deliverability logic from resolver), rate limiting (100 req/min per IP), database timeout protection (2s with graceful fallback), structured JSON logging, state normalization verification, and cache abstraction for future Redis migration.

The implementation follows a phased approach: Core Infrastructure → Integration → Testing. All changes maintain backward compatibility with the existing API contract.

## Tasks

- [-] 1. Create cache service abstraction
  - Create `backend/src/services/cacheService.ts` with CacheService interface
  - Implement InMemoryCacheService with 10-minute TTL
  - Implement factory function createCacheService()
  - Add cleanup interval to prevent memory leaks
  - All methods return Promises for Redis compatibility
  - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 1.1 Write property test for cache expiration
  - **Property 1: Expired cache entries are not returned**
  - **Validates: Requirements 1.2, 1.3**
  - Test that entries older than 10 minutes return null
  - Use fast-check with 100 iterations

- [ ] 1.2 Write unit tests for cache service
  - Test cache hit within TTL
  - Test cache miss after TTL expiration
  - Test cache cleanup interval
  - Test Promise-based API

- [ ] 2. Create database timeout wrapper
  - Create `backend/src/utils/dbHelpers.ts` with withTimeout function
  - Implement Promise.race pattern for 2-second timeout
  - Support generic Promise-based operations
  - Include operation name in timeout error message
  - _Requirements: 4.1, 4.2, 4.5_

- [ ] 2.1 Write property test for timeout enforcement
  - **Property 5: Database timeout enforced**
  - **Validates: Requirements 4.1**
  - Test that queries exceeding 2s are rejected
  - Use fast-check with 100 iterations

- [ ] 2.2 Write unit tests for timeout wrapper
  - Test query completes within timeout
  - Test query exceeds timeout and rejects
  - Test timeout error message format

- [ ] 3. Create structured logger utility
  - Create `backend/src/utils/structuredLogger.ts` with structuredLog function
  - Implement convenience methods: logInfo, logWarn, logError
  - Output JSON format with required fields: event, timestamp, environment, service, level
  - Use ISO 8601 format for timestamps
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [ ] 3.1 Write property test for JSON validity
  - **Property 7: Structured logs are valid JSON**
  - **Validates: Requirements 5.1**
  - Test that all log output is parseable JSON
  - Use fast-check with 100 iterations

- [ ] 3.2 Write property test for required fields
  - **Property 8: Structured logs contain required fields**
  - **Validates: Requirements 5.2**
  - Test that all logs have event, timestamp, environment, service, level
  - Use fast-check with 100 iterations

- [ ] 3.3 Write property test for timestamp format
  - **Property 9: Timestamps use ISO 8601 format**
  - **Validates: Requirements 5.3**
  - Test that timestamp matches ISO 8601 pattern
  - Use fast-check with 100 iterations

- [ ] 3.4 Write unit tests for structured logger
  - Test info level logging
  - Test warn level logging
  - Test error level logging
  - Test custom data fields are included

- [ ] 4. Create rate limiter middleware
  - Create `backend/src/middleware/rateLimiter.ts` with pincodeRateLimiter
  - Configure 100 requests per minute per IP using express-rate-limit
  - Return HTTP 429 with message "Too many requests, please try again later"
  - Include standard rate limit headers: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
  - Log rate limit violations with structured logger
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.1 Write property test for rate limit enforcement
  - **Property 3: Rate limiter enforces request limits**
  - **Validates: Requirements 3.1, 3.3**
  - Test that 101st request returns 429
  - Test that limit resets after 1 minute
  - Use fast-check with 100 iterations

- [ ] 4.2 Write property test for rate limit headers
  - **Property 4: Rate limiter includes standard headers**
  - **Validates: Requirements 3.4**
  - Test that all responses include RateLimit-* headers
  - Use fast-check with 100 iterations

- [ ] 4.3 Write unit tests for rate limiter
  - Test 100 requests succeed
  - Test 101st request returns 429
  - Test rate limit headers are present
  - Test rate limit message format

- [ ] 5. Checkpoint - Ensure all core infrastructure tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Update pincode resolver to use cache service
  - Update `backend/src/utils/pincodeResolver.ts` to import and use CacheService
  - Replace direct Map access with cacheService.get() and cacheService.set()
  - Update cache key format to "pincode:{pincode}"
  - Set cache TTL to 600 seconds (10 minutes)
  - Remove old cache Map and timestamps Map
  - Remove old cleanup interval
  - _Requirements: 1.1, 1.2, 1.3, 7.4_

- [ ] 6.1 Write property test for resolver returns location only
  - **Property 2: Resolver returns only location data**
  - **Validates: Requirements 2.1**
  - Test that resolver result has no deliverability fields
  - Use fast-check with 100 iterations

- [ ] 6.2 Write unit tests for resolver cache integration
  - Test cache hit returns cached data
  - Test cache miss queries database
  - Test cache stores result after database query
  - Test cache key format

- [ ] 7. Update pincode resolver to use timeout wrapper
  - Update `backend/src/utils/pincodeResolver.ts` to import withTimeout
  - Wrap Pincode.findOne() call with withTimeout(query, 2000, 'Pincode lookup')
  - Handle timeout errors gracefully by returning null
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7.1 Write property test for timeout returns null
  - **Property 6: Timeout errors return null**
  - **Validates: Requirements 4.3**
  - Test that timeout errors result in null return value
  - Use fast-check with 100 iterations

- [ ] 7.2 Write unit tests for resolver timeout handling
  - Test successful query within timeout
  - Test query timeout returns null
  - Test timeout error is logged

- [ ] 8. Update pincode resolver to use structured logger
  - Update `backend/src/utils/pincodeResolver.ts` to import structured logger
  - Replace all console.log calls with logInfo
  - Replace all console.error calls with logError
  - Use logWarn for pincode not found cases
  - Log events: PINCODE_CACHE_HIT, PINCODE_LOOKUP, PINCODE_NOT_FOUND, DB_TIMEOUT, PINCODE_LOOKUP_ERROR
  - _Requirements: 5.4, 5.5_

- [ ] 8.1 Write unit tests for resolver logging
  - Test cache hit logs PINCODE_CACHE_HIT
  - Test CSV lookup logs PINCODE_LOOKUP with source=CSV
  - Test MongoDB lookup logs PINCODE_LOOKUP with source=MongoDB
  - Test not found logs PINCODE_NOT_FOUND
  - Test timeout logs DB_TIMEOUT

- [ ] 9. Update pincode controller to use structured logger
  - Update `backend/src/controllers/pincodeController.ts` to import structured logger
  - Replace logger.info calls with logInfo
  - Replace logger.warn calls with logWarn
  - Replace logger.error calls with logError
  - Log events: PINCODE_CHECK, INVALID_PINCODE_FORMAT, PINCODE_NOT_FOUND, PINCODE_CHECK_ERROR
  - _Requirements: 5.4_

- [ ] 9.1 Write unit tests for controller logging
  - Test successful check logs PINCODE_CHECK
  - Test invalid format logs INVALID_PINCODE_FORMAT
  - Test not found logs PINCODE_NOT_FOUND
  - Test error logs PINCODE_CHECK_ERROR

- [ ] 10. Apply rate limiter to pincode routes
  - Update `backend/src/routes/pincodeRoutes.ts` to import pincodeRateLimiter
  - Apply pincodeRateLimiter middleware to /check/:pincode endpoint
  - _Requirements: 3.5_

- [ ] 10.1 Write integration test for rate limiting
  - Test rate limiter is applied to /check/:pincode
  - Test 100 requests succeed
  - Test 101st request returns 429
  - Test rate limit headers are present

- [ ] 11. Verify state normalization usage
  - Verify `backend/src/services/deliveryService.ts` uses normalizeState consistently
  - Verify normalizeState is used in isDeliverableState function
  - Verify normalizeState is used in checkDeliveryAvailability function
  - No code changes needed if already correct
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 11.1 Write property test for state normalization
  - **Property 10: State normalization removes whitespace and converts to lowercase**
  - **Validates: Requirements 6.1, 6.2**
  - Test that normalizeState trims and lowercases
  - Use fast-check with 100 iterations

- [ ] 11.2 Write unit tests for state normalization
  - Test "TELANGANA" → "telangana"
  - Test " Andhra Pradesh " → "andhra pradesh"
  - Test "  TeLaNgAnA  " → "telangana"

- [ ] 12. Checkpoint - Ensure all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Write property test for API response time under failure
  - **Property 12: API response time under failure**
  - **Validates: Requirements 8.4**
  - Test that API responds within 3 seconds during database timeout
  - Test that API responds within 3 seconds during connection failure
  - Use fast-check with 100 iterations

- [ ] 14. Write property test for API response format
  - **Property 13: API response format maintained**
  - **Validates: Requirements 9.1, 9.2**
  - Test that response contains all required fields
  - Test that field types are correct
  - Use fast-check with 100 iterations

- [ ] 15. Write property test for CSV parser validity
  - **Property 14: CSV parser produces valid objects**
  - **Validates: Requirements 10.1, 10.3, 10.4**
  - Test that valid CSV rows produce objects with non-empty state and district
  - Test that UTF-8 state names are preserved
  - Use fast-check with 100 iterations

- [ ] 16. Write property test for CSV parser error handling
  - **Property 15: CSV parser skips invalid rows**
  - **Validates: Requirements 10.2**
  - Test that invalid rows are skipped
  - Test that processing continues after invalid row
  - Use fast-check with 100 iterations

- [ ] 17. Write property test for cache service promises
  - **Property 11: Cache service returns promises**
  - **Validates: Requirements 7.5**
  - Test that all cache methods return Promises
  - Use fast-check with 100 iterations

- [ ] 18. Write integration test for graceful degradation
  - Test database timeout falls back to cache
  - Test database timeout with no cache returns deliverable=false
  - Test CSV fallback when MongoDB unavailable
  - Test response time < 3 seconds in all failure scenarios
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 19. Write integration test for end-to-end flow
  - Test complete flow: rate limiter → controller → resolver → cache → database → service
  - Test cache hit path
  - Test cache miss path
  - Test deliverable state returns deliverable=true
  - Test non-deliverable state returns deliverable=false
  - Test response format matches API contract
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 20. Write integration test for backward compatibility
  - Test existing query parameters still work
  - Test response format unchanged for success cases
  - Test HTTP status codes unchanged (200, 500)
  - Test new 429 status for rate limiting
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 21. Final checkpoint - Ensure all tests pass and coverage > 90%
  - Run full test suite: npm run test
  - Verify code coverage > 90%
  - Verify all 15 property tests pass
  - Verify all unit tests pass
  - Verify all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check with minimum 100 iterations
- All property tests are tagged with feature name and property number
- Checkpoints ensure incremental validation
- Implementation language: TypeScript
- Testing framework: Jest with fast-check for property tests
- Target code coverage: > 90%
- All changes maintain backward compatibility with existing API contract

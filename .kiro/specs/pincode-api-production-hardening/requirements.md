# Requirements Document

## Introduction

This document specifies the production hardening requirements for the pincode API system. The system currently functions reliably for development and small-scale usage but requires hardening to handle 10k-100k users in production. The hardening focuses on seven critical areas: cache TTL optimization, architecture compliance, rate limiting, database timeout protection, structured logging, state normalization, and cache abstraction for future scalability.

## Glossary

- **Pincode_API**: The HTTP API that provides pincode lookup and delivery availability checking
- **Pincode_Resolver**: The data layer component that retrieves pincode location data from CSV or MongoDB
- **Delivery_Service**: The business logic layer that determines delivery availability based on location data
- **Cache_Service**: The abstraction layer for caching pincode lookup results
- **Rate_Limiter**: Middleware that restricts request frequency per IP address
- **Structured_Logger**: Logging utility that outputs JSON-formatted log entries
- **State_Normalizer**: Utility function that standardizes state name formatting
- **DB_Timeout_Wrapper**: Utility that enforces query timeout limits with graceful fallback

## Requirements

### Requirement 1: Cache TTL Optimization

**User Story:** As a system administrator, I want the cache TTL to be 10 minutes instead of 24 hours, so that business logic changes (like delivery rule updates) take effect quickly without serving stale data to users.

#### Acceptance Criteria

1. THE Pincode_Resolver SHALL set cache TTL to 10 minutes (600 seconds)
2. WHEN a cached entry exceeds 10 minutes age, THE Pincode_Resolver SHALL evict it from cache
3. WHEN a pincode lookup occurs, THE Pincode_Resolver SHALL check cache timestamp before returning cached data
4. THE Pincode_Resolver SHALL log cache hit/miss events with timestamp information

### Requirement 2: Architecture Compliance - Deliverability Logic Separation

**User Story:** As a developer, I want deliverability logic removed from the resolver layer, so that the architecture maintains clean separation between data retrieval (WHERE) and business logic (WHETHER).

#### Acceptance Criteria

1. THE Pincode_Resolver SHALL return only location data (state, district, cities)
2. THE Pincode_Resolver SHALL NOT contain any deliverability determination logic
3. THE Delivery_Service SHALL be the sole component determining delivery availability
4. WHEN the Pincode_API receives a pincode check request, THE Pincode_API SHALL call Pincode_Resolver for location data and Delivery_Service for deliverability determination separately

### Requirement 3: Rate Limiting Protection

**User Story:** As a system administrator, I want rate limiting on the pincode API, so that the system is protected from DDoS attacks, bot abuse, and cost explosion from excessive requests.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL limit requests to 100 per minute per IP address
2. WHEN an IP address exceeds 100 requests in a 1-minute window, THE Rate_Limiter SHALL return HTTP 429 status with message "Too many requests, please try again later"
3. THE Rate_Limiter SHALL reset the request count after each 1-minute window expires
4. THE Rate_Limiter SHALL include standard rate limit headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset) in responses
5. THE Rate_Limiter SHALL apply to the /api/pincode/check/:pincode endpoint

### Requirement 4: Database Timeout Protection

**User Story:** As a developer, I want database queries to timeout after 2 seconds, so that slow or hanging database connections don't freeze the API and users receive timely responses.

#### Acceptance Criteria

1. THE DB_Timeout_Wrapper SHALL enforce a 2-second timeout on all MongoDB queries
2. WHEN a MongoDB query exceeds 2 seconds, THE DB_Timeout_Wrapper SHALL reject the promise with a timeout error
3. WHEN a timeout error occurs, THE Pincode_Resolver SHALL log the timeout event and return null for graceful degradation
4. WHEN a timeout error occurs, THE Pincode_API SHALL return cached data if available, otherwise return "not deliverable" response
5. THE DB_Timeout_Wrapper SHALL be reusable for any database query operation

### Requirement 5: Structured Logging

**User Story:** As a DevOps engineer, I want all logs in JSON format, so that I can easily parse, query, and aggregate logs in production monitoring tools like ELK, Datadog, or CloudWatch.

#### Acceptance Criteria

1. THE Structured_Logger SHALL output logs in JSON format
2. WHEN logging an event, THE Structured_Logger SHALL include fields: event, timestamp, environment, service, and event-specific data
3. THE Structured_Logger SHALL use ISO 8601 format for timestamps
4. THE Pincode_API SHALL use Structured_Logger for all pincode check events
5. THE Pincode_Resolver SHALL use Structured_Logger for cache hit/miss and database lookup events
6. THE Structured_Logger SHALL support log levels: info, warn, error

### Requirement 6: State Normalization Centralization

**User Story:** As a developer, I want a centralized state normalization function, so that state name comparisons are consistent across the codebase and prevent bugs from case/whitespace variations.

#### Acceptance Criteria

1. THE State_Normalizer SHALL trim whitespace from state names
2. THE State_Normalizer SHALL convert state names to lowercase
3. THE Delivery_Service SHALL use State_Normalizer for all state comparisons
4. THE Pincode_Resolver SHALL use State_Normalizer when processing state data from database or CSV
5. WHEN comparing state names, THE system SHALL always apply State_Normalizer to both operands

### Requirement 7: Cache Abstraction for Scalability

**User Story:** As a system architect, I want a cache interface abstraction, so that the system can migrate from in-memory cache to Redis in the future without changing application code.

#### Acceptance Criteria

1. THE Cache_Service SHALL define an interface with methods: get, set, delete, clear
2. THE Cache_Service SHALL provide an InMemoryCache implementation for current use
3. THE Cache_Service SHALL support TTL (time-to-live) parameter in the set method
4. THE Pincode_Resolver SHALL use Cache_Service interface instead of direct Map access
5. THE Cache_Service SHALL return Promises for all operations to support future async implementations
6. WHERE Redis is configured via environment variable, THE Cache_Service SHALL support a RedisCache implementation (interface only, implementation deferred)

### Requirement 8: Graceful Degradation on Failures

**User Story:** As a user, I want the API to respond quickly even when the database is slow or unavailable, so that I receive timely feedback about delivery availability.

#### Acceptance Criteria

1. WHEN MongoDB query times out, THE Pincode_API SHALL return cached data if available
2. WHEN MongoDB query times out and no cached data exists, THE Pincode_API SHALL return deliverable=false with message "Not deliverable to this location or pincode"
3. WHEN MongoDB connection fails, THE Pincode_Resolver SHALL fall back to CSV data source if available
4. THE Pincode_API SHALL respond within 3 seconds under all failure conditions
5. WHEN graceful degradation occurs, THE Structured_Logger SHALL log the degradation event with reason

### Requirement 9: No Breaking Changes to API Contract

**User Story:** As a frontend developer, I want the API contract to remain unchanged, so that existing client applications continue to work without modifications.

#### Acceptance Criteria

1. THE Pincode_API SHALL maintain the existing response format for /api/pincode/check/:pincode
2. THE Pincode_API SHALL return the same fields: deliverable, state, postal_district, admin_district, cities, single_city, message
3. THE Pincode_API SHALL maintain HTTP status codes: 200 for success, 429 for rate limit, 500 for server error
4. THE Pincode_API SHALL maintain backward compatibility with all existing query parameters
5. WHEN rate limiting is triggered, THE Pincode_API SHALL return a new HTTP 429 status (new behavior, not breaking existing success cases)

### Requirement 10: Parser and Serializer Round-Trip Testing

**User Story:** As a quality assurance engineer, I want round-trip property tests for CSV parsing, so that data integrity is guaranteed when reading pincode data from CSV files.

#### Acceptance Criteria

1. WHEN the CSV parser reads a valid pincode row, THE CSV_Parser SHALL produce a structured pincode object
2. WHEN the CSV parser encounters an invalid row, THE CSV_Parser SHALL skip it and log a warning
3. FOR ALL valid pincode objects parsed from CSV, THE system SHALL verify that state and district fields are non-empty
4. THE CSV_Parser SHALL handle UTF-8 encoded state names correctly (e.g., "Telangana", "Andhra Pradesh")
5. WHEN parsing completes, THE CSV_Parser SHALL log the total count of valid and invalid rows processed


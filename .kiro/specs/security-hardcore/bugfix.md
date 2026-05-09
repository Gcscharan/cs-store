# Bugfix Requirements Document

## Introduction

This bugfix addresses multiple CRITICAL security vulnerabilities that are blocking production deployment. The vulnerabilities include hardcoded secrets (15+ instances), unsafe environment variable fallbacks (50+ instances), OTP exposure in API responses, unsecured debug endpoints, and missing environment validation. These issues create severe risks including authentication bypass, unauthorized API usage, data breaches, financial fraud, and GDPR violations. The fix ensures zero hardcoded secrets, fail-fast startup validation, comprehensive secret format checking, and removal of all debug information leakage.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the application starts with missing JWT_SECRET THEN the system uses fallback value "your-secret-key" allowing attackers to forge authentication tokens

1.2 WHEN the application starts with missing RESEND_API_KEY THEN the system uses exposed hardcoded key "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx" allowing unauthorized email sending

1.3 WHEN the application starts with missing Gmail credentials THEN the system uses hardcoded credentials "gcs.charan@gmail.com" / "lnjhscqyipztkvyu" allowing full email account access

1.4 WHEN the application starts with missing Razorpay credentials THEN the system uses test fallbacks "rzp_test_key" / "rzp_test_secret" causing payment failures and webhook forgery

1.5 WHEN the application starts with missing MONGODB_URI THEN the system uses empty string "" causing silent connection failures

1.6 WHEN the application starts with missing GOOGLE_MAPS_API_KEY THEN the system uses empty string "" causing incorrect delivery fee calculations

1.7 WHEN NODE_ENV is set to "development" in production THEN the system returns OTP values in API responses exposing authentication codes

1.8 WHEN debug endpoints are accessed THEN the system exposes user PII without authentication

1.9 WHEN JWT_SECRET is less than 32 characters THEN the system accepts weak secrets vulnerable to brute force attacks

1.10 WHEN RAZORPAY_KEY_ID does not start with "rzp_" THEN the system accepts invalid credentials causing payment initialization failures

1.11 WHEN RESEND_API_KEY does not start with "re_" THEN the system accepts invalid credentials causing email delivery failures

1.12 WHEN exposed/revoked API keys are used THEN the system continues operating with compromised credentials

1.13 WHEN JWT_SECRET equals JWT_REFRESH_SECRET THEN the system uses identical secrets reducing security of token refresh mechanism

1.14 WHEN production deployment uses test Razorpay keys THEN the system processes test transactions instead of real payments

1.15 WHEN any required environment variable is missing THEN the system starts anyway and fails at runtime with unclear errors

### Expected Behavior (Correct)

2.1 WHEN the application starts with missing JWT_SECRET THEN the system SHALL fail immediately with error "JWT_SECRET is required but not set" and exit with code 1

2.2 WHEN the application starts with missing RESEND_API_KEY THEN the system SHALL fail immediately with error "RESEND_API_KEY is required but not set" and exit with code 1

2.3 WHEN the application starts with missing Gmail credentials THEN the system SHALL fail immediately with error "Gmail credentials must be set: GMAIL_USER, GMAIL_APP_PASSWORD" and exit with code 1

2.4 WHEN the application starts with missing Razorpay credentials THEN the system SHALL fail immediately with error "Razorpay credentials required: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET" and exit with code 1

2.5 WHEN the application starts with missing MONGODB_URI THEN the system SHALL fail immediately with error "MONGODB_URI is required but not set" and exit with code 1

2.6 WHEN the application starts with missing GOOGLE_MAPS_API_KEY THEN the system SHALL fail immediately with error "GOOGLE_MAPS_API_KEY is required but not set" and exit with code 1

2.7 WHEN OTP is generated in any environment THEN the system SHALL only log OTP to server logs and never include it in API responses

2.8 WHEN debug endpoints are accessed in production THEN the system SHALL return 404 or require admin authentication

2.9 WHEN JWT_SECRET is less than 32 characters THEN the system SHALL fail immediately with error "JWT_SECRET must be at least 32 characters (current: X)" and exit with code 1

2.10 WHEN RAZORPAY_KEY_ID does not start with "rzp_" THEN the system SHALL fail immediately with error "RAZORPAY_KEY_ID must start with 'rzp_'" and exit with code 1

2.11 WHEN RESEND_API_KEY does not start with "re_" THEN the system SHALL fail immediately with error "RESEND_API_KEY must start with 're_'" and exit with code 1

2.12 WHEN exposed API key "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx" is detected THEN the system SHALL fail immediately with error "RESEND_API_KEY is using EXPOSED key from code - MUST be changed immediately" and exit with code 1

2.13 WHEN exposed Gmail password "lnjhscqyipztkvyu" is detected THEN the system SHALL fail immediately with error "GMAIL_APP_PASSWORD is using EXPOSED password from code - MUST be changed immediately" and exit with code 1

2.14 WHEN JWT_SECRET equals JWT_REFRESH_SECRET THEN the system SHALL fail immediately with error "JWT_REFRESH_SECRET must be different from JWT_SECRET" and exit with code 1

2.15 WHEN production deployment uses test Razorpay keys THEN the system SHALL fail immediately with error "RAZORPAY_KEY_ID appears to be a test key but NODE_ENV is production" and exit with code 1

2.16 WHEN NODE_ENV is not one of "development", "production", or "test" THEN the system SHALL fail immediately with error "NODE_ENV must be one of: development, production, test" and exit with code 1

2.17 WHEN MONGODB_URI does not start with "mongodb://" or "mongodb+srv://" THEN the system SHALL fail immediately with error "MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'" and exit with code 1

2.18 WHEN JWT_SECRET contains "your-secret-key" or "your-super-secret-jwt-key-here" THEN the system SHALL fail immediately with error "JWT_SECRET is using default/example value - MUST be changed" and exit with code 1

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the application starts with all valid environment variables THEN the system SHALL CONTINUE TO start successfully and log "✅ Environment validation passed"

3.2 WHEN authentication requests are made with valid credentials THEN the system SHALL CONTINUE TO generate and verify JWT tokens correctly

3.3 WHEN OTP is sent via email THEN the system SHALL CONTINUE TO deliver emails using Resend or Gmail SMTP

3.4 WHEN payment intents are created THEN the system SHALL CONTINUE TO initialize Razorpay with provided credentials

3.5 WHEN delivery fees are calculated THEN the system SHALL CONTINUE TO use Google Maps Distance Matrix API

3.6 WHEN images are uploaded THEN the system SHALL CONTINUE TO store them in Cloudinary

3.7 WHEN database operations are performed THEN the system SHALL CONTINUE TO connect to MongoDB using provided URI

3.8 WHEN JWT tokens are generated THEN the system SHALL CONTINUE TO use JWT_SECRET for signing

3.9 WHEN refresh tokens are generated THEN the system SHALL CONTINUE TO use JWT_REFRESH_SECRET for signing

3.10 WHEN Razorpay webhooks are received THEN the system SHALL CONTINUE TO verify signatures using RAZORPAY_WEBHOOK_SECRET

3.11 WHEN the application runs in development mode with valid config THEN the system SHALL CONTINUE TO log debug information to server logs

3.12 WHEN CORS requests are made from allowed origins THEN the system SHALL CONTINUE TO accept them

3.13 WHEN rate limiting is applied THEN the system SHALL CONTINUE TO enforce request limits per IP

3.14 WHEN MongoDB URI contains credentials THEN the system SHALL CONTINUE TO mask passwords in logs

3.15 WHEN environment validation passes THEN the system SHALL CONTINUE TO display NODE_ENV and masked database URI in startup logs

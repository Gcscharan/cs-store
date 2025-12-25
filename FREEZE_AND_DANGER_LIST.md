# FREEZE AND DANGER LIST

## 1. FROZEN FILES AND FOLDERS

### 1.1 Authentication Module
- **File**: `backend/src/domains/identity/routes/auth.ts`
  - **Reason**: Core authentication flow with OAuth integration
  - **Status**: PERMANENTLY FROZEN
  - **Exception**: Security patches only

- **File**: `backend/src/middleware/auth.ts`
  - **Reason**: JWT verification and token blacklist logic
  - **Status**: PERMANENTLY FROZEN
  - **Exception**: Critical security fixes only

### 1.2 Payment Processing
- **File**: `backend/src/domains/finance/routes/paymentRoutes.ts`
  - **Reason**: Razorpay integration and payment verification
  - **Status**: PERMANENTLY FROZEN
  - **Exception**: Payment gateway updates only

### 1.3 Core Business Logic
- **File**: `backend/src/routes/orders.ts`
  - **Reason**: Order state management and business rules
  - **Status**: FROZEN UNTIL MIGRATION
  - **Exception**: Bug fixes with design review

- **File**: `backend/src/routes/cart.ts`
  - **Reason**: Cart state and checkout logic
  - **Status**: FROZEN UNTIL MIGRATION
  - **Exception**: Critical defects only

### 1.4 Database Models
- **Directory**: `backend/src/models/`
  - **Reason**: Schema definitions affect all modules
  - **Status**: FROZEN UNTIL SCHEMA MIGRATION PLAN
  - **Exception**: No changes permitted

## 2. LEGACY AREAS TO QUARANTINE

### 2.1 Admin Panel Routes
- **File**: `backend/src/routes/admin.ts`
  - **Issue**: Direct database operations in route handlers
  - **Risk**: Data integrity violations
  - **Action**: QUARANTINE - Wrap with service layer

### 2.2 Product Management
- **File**: `backend/src/domains/catalog/routes/products.ts`
  - **Issue**: Commented out authentication middleware
  - **Risk**: Unauthorized product creation
  - **Action**: QUARANTINE - Restore security controls

### 2.3 Frontend Routing
- **File**: `frontend/src/App.tsx`
  - **Issue**: Monolithic routing structure
  - **Risk**: Unmaintainable routing logic
  - **Action**: QUARANTINE - Plan modular migration

## 3. DEBUG/DEV BACKDOORS

### 3.1 Payment Test Endpoints
- **Endpoint**: `GET /api/payments/test`
  - **Location**: `backend/src/domains/finance/routes/paymentRoutes.ts`
  - **Danger**: Exposes system status
  - **Required Action**: IMMEDIATE REMOVAL

### 3.2 Product Debug Routes
- **Endpoint**: `GET /api/products/debug/product-images/:id`
  - **Location**: `backend/src/domains/catalog/routes/products.ts`
  - **Danger**: Exposes internal image processing
  - **Required Action**: IMMEDIATE REMOVAL

### 3.3 Notification Test Endpoints
- **Endpoint**: `POST /api/notifications/test-all-channels`
  - **Location**: `backend/src/domains/communication/routes/notifications.ts`
  - **Danger**: Allows spam testing
  - **Required Action**: IMMEDIATE REMOVAL

### 3.4 Admin Debug Tokens
- **Endpoint**: Presumed `/api/admin/dev-token`
  - **Location**: `backend/src/routes/admin.ts`
  - **Danger**: Bypasses authentication
  - **Required Action**: IMMEDIATE REMOVAL

## 4. HIGH-RISK CHANGE ZONES

### 4.1 Security Configuration
- **File**: `backend/src/middleware/auth.ts`
  - **Risk Line**: `process.env.JWT_SECRET || "your-secret-key"`
  - **Danger**: Hardcoded fallback secret
  - **Change Protocol**: CTO APPROVAL REQUIRED

### 4.2 Role-Based Access Control
- **File**: `backend/src/routes/cart.ts`
  - **Risk Line**: `customerOrAdmin = requireRole(["customer", "admin"])`
  - **Danger**: Elevated privileges for debugging
  - **Change Protocol**: SECURITY TEAM REVIEW

### 4.3 Token Revocation System
- **File**: `backend/src/middleware/auth.ts`
  - **Risk Area**: Redis blacklist try-catch block
  - **Danger**: Silent failure of token revocation
  - **Change Protocol**: ARCHITECTURE REVIEW

### 4.4 Order Tracking Mock Data
- **File**: `backend/src/routes/orders.ts`
  - **Risk Area**: Mock tracking implementation
  - **Danger**: Production system using test data
  - **Change Protocol**: BUSINESS OWNER APPROVAL

## 5. DO NOT CHANGE WITHOUT DESIGN REVIEW

### 5.1 Authentication Flow
- **Rule**: ANY changes to OAuth, JWT, or session management
- **Review Required**: Security Architecture Team
- **Documentation**: Security Impact Assessment
- **Testing**: Full penetration testing

### 5.2 Payment Processing
- **Rule**: ANY changes to payment verification or webhook handling
- **Review Required**: Finance Systems Team
- **Documentation**: Payment Compliance Report
- **Testing**: PCI DSS compliance validation

### 5.3 Database Schema
- **Rule**: ANY changes to User, Order, Product, or Cart models
- **Review Required**: Database Architecture Team
- **Documentation**: Migration Impact Analysis
- **Testing**: Full regression test suite

### 5.4 Notification System
- **Rule**: ANY changes to SMS, email, or push notification delivery
- **Review Required**: Communications Team
- **Documentation**: Notification Delivery Impact
- **Testing**: Delivery rate validation

### 5.5 Admin Operations
- **Rule**: ANY changes to user management or system administration
- **Review Required**: Operations Team
- **Documentation**: Administrative Control Impact
- **Testing**: Role-based access validation

## 6. CRITICAL INVARIANTS

### 6.1 Security Invariants
- **Invariant**: JWT secret MUST be environment variable only
- **Invariant**: Token blacklist check MUST fail secure
- **Invariant**: Role-based access MUST be enforced at route level
- **Invariant**: OAuth callbacks MUST be validated

### 6.2 Business Invariants
- **Invariant**: Order status transitions MUST follow state machine
- **Invariant**: Cart calculations MUST be atomic
- **Invariant**: Payment verification MUST be idempotent
- **Invariant**: Product inventory MUST be consistent

### 6.3 System Invariants
- **Invariant**: Database transactions MUST be used for multi-table operations
- **Invariant**: External API calls MUST have timeout and retry logic
- **Invariant**: File uploads MUST be validated and scanned
- **Invariant**: Audit logging MUST be preserved for all operations

## 7. EMERGENCY CHANGE PROTOCOL

### 7.1 Critical Security Issues
- **Definition**: Active exploitation or data breach
- **Protocol**: Immediate fix with post-implementation review
- **Approval**: CTO + Security Team Lead
- **Documentation**: Incident report + fix justification

### 7.2 Production Outages
- **Definition**: System unavailable or critical functionality broken
- **Protocol**: Minimal fix with full rollback plan
- **Approval**: Operations Lead + Engineering Manager
- **Documentation**: Root cause analysis + prevention plan

### 7.3 Data Corruption
- **Definition**: Inconsistent or lost data
- **Protocol**: Immediate data preservation + fix
- **Approval**: Database Team + Business Owner
- **Documentation**: Data impact assessment + recovery plan

## 8. COMPLIANCE REQUIREMENTS

### 8.1 Payment Card Industry (PCI)
- **Requirement**: Card data MUST NOT be stored locally
- **Requirement**: Payment flows MUST use tokenization
- **Requirement**: Access to payment systems MUST be logged
- **Requirement**: Payment errors MUST NOT expose sensitive data

### 8.2 Data Protection
- **Requirement**: Personal data MUST be encrypted at rest
- **Requirement**: User consent MUST be recorded
- **Requirement**: Data deletion requests MUST be honored
- **Requirement**: Data access MUST be auditable

### 8.3 System Security
- **Requirement**: All endpoints MUST have authentication
- **Requirement**: Debug endpoints MUST be removed in production
- **Requirement**: Error messages MUST not expose system details
- **Requirement**: Rate limiting MUST be implemented

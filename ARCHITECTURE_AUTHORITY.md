# ARCHITECTURE_AUTHORITY.md

## Current Backend Architecture (AS-IS)

### Routing Structure
- **Dual routing system**: Legacy `src/routes/` and domain `src/domains/*/routes/`
- **Inconsistent patterns**: Some modules use domain structure, others use legacy
- **Mixed authentication**: Different auth enforcement across routing systems

### Module Organization
- **Legacy modules**: Cart, Orders, Admin in `src/routes/`
- **Domain modules**: Identity, Catalog, Finance, Communication in `src/domains/`
- **Mixed responsibilities**: Business logic in both controllers and routes

### Data Layer
- **Direct model access**: Routes directly access Mongoose models
- **No repository pattern**: Database queries scattered throughout
- **Mixed data access**: Some controllers, some routes, some services

### Security Issues
- **Secret fallbacks**: `process.env.JWT_SECRET || "your-secret-key"`
- **Debug backdoors**: Admin token minting, expanded access
- **Inconsistent auth**: Different patterns across modules

## Target Backend Architecture (TO-BE)

### API Layer
- **Single routing system**: All routes under `src/api/v1/`
- **Consistent authentication**: Unified auth middleware
- **Request/response contracts**: Standardized formats
- **Forbidden**: Business logic, direct database queries, third-party SDK calls

### Domain Layer
- **Module ownership**: Each of 10 modules owns its domain
- **Business rules**: Encapsulated in domain services
- **Cross-domain communication**: Via events only
- **Structure**: One domain per module with clear boundaries

### Infrastructure Layer
- **Repository pattern**: All data access through repositories
- **External services**: Abstracted behind interfaces
- **Configuration**: Environment-specific settings
- **Forbidden**: Business rules, cross-cutting concerns without contracts

## Current Frontend Architecture (AS-IS)

### Routing Structure
- **Monolithic routing**: Single App.tsx with 40+ routes
- **Flat component structure**: 42+ components in single directory
- **Mixed concerns**: UI, business logic, and data fetching mixed

### Component Organization
- **No module boundaries**: Components organized by type, not feature
- **State management**: Redux store with mixed responsibilities
- **API coupling**: Direct API calls throughout components

## Target Frontend Architecture (TO-BE)

### Feature-Based Organization
- **Module-based features**: 10 feature slices aligned with backend modules
- **Component ownership**: Each module owns its components
- **State management**: Per-module state with shared store

### Routing Separation
- **Customer routing tree**: Public pages, authenticated customer pages
- **Admin routing tree**: Admin-only pages, admin workflows
- **Delivery routing tree**: Delivery partner pages, location-based controls

### State Rules
- **Backend-authoritative**: Cart contents, order status, payment status
- **Frontend-authoritative**: Transient UI state, non-critical preferences

## Module Ownership Boundaries

### Module 1 — Authentication
**Current Owner**: Identity domain + middleware
**Target Owner**: Authentication domain
**Responsibilities**:
- Identity verification
- Token lifecycle management
- Session management
- Role enforcement
**Provides**: User identity verification, role-based access control

### Module 2 — User System
**Current Owner**: Mixed with authentication
**Target Owner**: User domain
**Responsibilities**:
- Profile data management
- User preferences
- Role transitions
- Address management
**Provides**: User profile services, preference enforcement

### Module 3 — Product System
**Current Owner**: Catalog domain
**Target Owner**: Product domain
**Responsibilities**:
- Product catalog
- Pricing rules
- Inventory state
- Category management
**Provides**: Product information, availability status

### Module 4 — Product Image System
**Current Owner**: Part of catalog domain
**Target Owner**: Image domain
**Responsibilities**:
- Image upload pipeline
- Asset lifecycle
- Image variants
- Storage cleanup
**Provides**: Image URLs and metadata, upload/deletion services

### Module 5 — Cart System
**Current Owner**: Legacy routes
**Target Owner**: Cart domain owned by customer
**Respons Coupling**: Payment system, trends
**Responsibilities**:
- Cart state
- Pricing calculations
- Item validation
- Cart persistence
**Provides**: Cart operations, pricing totals

### Module 6 — Checkout System
**Current Owner**: Mixed with cart routes
**Target Owner**: Checkout domain
**Responsibilities**:
- Checkout orchestration
- Order intent creation
- Address validation
- Delivery fee calculation
**Provides**: Checkout workflows, order preparation

### Module 7 — Order System
**Current Owner**: Legacy routes
**Target Owner**: Order domain
**Responsibilities**:
- Order lifecycle
- State transitions
- Order history
- Tracking events
**Provides**: Order management, tracking information

### Module 8 — Admin Panel
**Current Owner**: Legacy routes
**Target Owner**: Admin domain

** ordinal:
- Admin workflows
- Audit logging
- Admin permissions
- System monitoring
**Provides**: Admin interfaces, system oversight

### Module 9 — Search System
**Current Owner**: Part of catalog domain
**Target Owner**: Search domain
**Responsibilities**:
- Search indexing
- Query processing
- Relevance tuning
- Search analytics
**Provides**: Search services, index management

### Module 10 — Notification System
**Current Owner**: Communication domain
**Target Owner**: Notification domain
**Responsibilities**:
- Notification delivery
- Channel management
- Preference enforcement
- Event processing
**Provides**: Notification services, channel abstraction

## Cross-Module Interaction Rules

### Current Issues
- **Direct model access**: Modules access each other's models
- **Mixed routing**: Some modules use legacy, some use domain
- **No event system**: No clear communication patterns

### Target Rules
- **Event-driven communication**: Modules communicate via events only
- **API contracts**: Clear interfaces between modules
- **No direct database access**: Modules access data through repositories
- **No cross-domain direct model access**: Forbidden pattern

### Interaction Patterns
- **Authentication → All modules**: Provides identity verification
- **Products → Cart, Search**: Provides product information
- **Cart → Checkout**: Provides cart state
- **Checkout → Orders, Payments**: Triggers order creation and payment
- **Orders → Notifications**: Triggers order events
- **Admin → All modules**: Governance and oversight

## Security and Data Invariants

### Authentication Invariants
- All API endpoints must authenticate except explicitly public endpoints
- Token secrets must be validated at startup
- No secret fallbacks allowed
- Consistent role enforcement across all modules

### Authorization Invariants
- Role-based access control enforced at routing layer
- Resource-based checks enforced at domain layer
- Admin actions require audit trails
- Customer data isolated by ownership

### Data Invariants
- Customer data isolated by ownership
- Admin actions logged and reversible
- Payment data immutable once confirmed
- Order state transitions must follow defined rules

### Environment Safety Rules
- Development: Debug endpoints only with explicit flags
- Production: No debug endpoints, no mock data
- All secrets validated at startup
- All security headers enforced

### Non-Negotiable Security Rules
- No debug endpoints in production
- No backdoor token creation
- No expanded access for debugging
- All admin actions audited
- No secret fallbacks
- No business logic in API layer
- No direct database access from routes

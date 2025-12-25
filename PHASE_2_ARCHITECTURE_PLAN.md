# PHASE_2_ARCHITECTURE_PLAN.md

## Phase 2 Objective
Separate business logic from legacy routing and establish clean domain boundaries without changing business behavior. Preserve all existing functionality.

## In-Scope Domains (ONLY THESE)
- User → domains/user
- Media → domains/media
- Cart → domains/cart
- Search → domains/search

## Explicitly Frozen / Out-of-Scope Modules (NO CHANGES)
- Authentication system
- Product core logic
- Checkout system
- Orders system
- Admin panel
- Payment processing
- Notifications system
- Delivery system
- Frontend
- Database schemas

## Domain Ownership & Responsibilities

### User Domain (domains/user)
- User profile CRUD
- Preferences & settings
- User data validation
- Account state management

### Media Domain (domains/media)
- Image upload & validation
- Image processing & optimization
- Cloudinary integration
- Media lifecycle management

### Cart Domain (domains/cart)
- Cart creation & persistence
- Item add/update/remove
- Cart validation & calculations
- Cart cleanup

### Search Domain (domains/search)
- Search indexing
- Query processing
- Ranking & filtering
- Search analytics

## Canonical Folder Structure
Each domain MUST follow:
domains/{domain}/
- controllers/
- services/
- repositories/
- types/
- utils/

## Service Layer Rules
- Business logic ONLY in services
- No HTTP logic
- No database access
- No cross-domain calls
- No auth logic

## Repository Rules
- Read/write ONLY existing schemas
- No schema changes
- No new fields
- No migrations
- No index changes

## Legacy Route Rules
- Routes remain unchanged
- Controllers delegate to services
- No API contract changes
- Responses must remain identical

## Dependency Rules

ALLOWED:
- Controller → Service
- Service → Repository
- Shared utilities

FORBIDDEN:
- Cross-domain services
- Direct DB access in controllers
- Dependencies on frozen modules

## Validation & Exit Criteria
- All business logic moved to services
- Legacy routes untouched
- No cross-domain coupling
- Tests passing
- Architecture approved

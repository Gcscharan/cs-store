# PHASE_2_EXECUTION_LOCK.md

## Phase 2 Scope Lock
ONLY these domains may be modified:
- domains/user
- domains/media
- domains/cart
- domains/search

## Frozen Modules (ABSOLUTE NO-TOUCH)
- Authentication
- Product core
- Checkout
- Orders
- Admin
- Payments
- Notifications
- Delivery
- Frontend
- Database schemas

## Approved Change Types
- Service extraction
- Repository creation
- Controller thinning
- Internal delegation

## Explicitly Forbidden Changes
- Auth changes
- Schema changes
- API contract changes
- New endpoints
- New dependencies
- Frontend edits

## File Creation Rules
- New files ONLY inside allowed domains
- No file moves outside domains
- Legacy routes must remain

## Execution Order
1. User
2. Media
3. Cart
4. Search

## Commit Discipline
- One domain per branch
- One logical change per commit
- Revert-only rollback

## Completion Criteria
- Business logic fully in services
- Routes unchanged
- No cross-domain dependencies
- Architecture compliance verified

## Phase 3 Gate
Phase 3 is FORBIDDEN until Phase 2 is formally closed.

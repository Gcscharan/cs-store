# PHASE 2 — MEDIA DOMAIN (PRODUCT IMAGE SYSTEM) LOCK

Status: LOCKED
Scope: Media/Image Logic Centralization ONLY
Date: 2025-12-22

## In-Scope (Implemented in Phase 2)
- Image normalization logic
- Cloudinary upload helpers (buffer and remote URL)
- Variant and modern format URL generation
- Remote image import helpers
- Media-related types (re-export only)

## Explicitly Out of Scope (Frozen — Unchanged)
- Product schema (models/Product.ts)
- Any database queries or mutations
- API routes or response formats
- Catalog domain ownership (controllers remain in place)
- Uploads route behavior (multer config unchanged)
- Search, Cart, Checkout, Orders, Payments
- Any schema, index, or migration changes

## Domain Structure (Created)
backend/src/domains/media/
- providers/CloudinaryProvider.ts
- services/MediaImageService.ts
- types/MediaImageTypes.ts (re-export)

Delegations (no API changes):
- catalog/controllers/productController.ts → delegates image normalization and uploads to MediaImageService
- domains/uploads/controllers/uploadController.ts → delegates upload to MediaImageService (preserves { full, thumb } shape)
- catalog/controllers/debugController.ts → uses normalizeProductImages which now delegates to MediaImageService

## STEP E — Verification (HARD GATES)

1) Controller Verification — PASS
- No Cloudinary SDK calls: OK
- No image normalization logic inline: OK
- No sharp/base64 logic in controllers: OK
- Delegation to MediaImageService only: OK

2) Service Verification — PASS
- No Express objects: OK
- No DB access: OK
- No Product model imports: OK
- Encapsulates normalization, variants/formats, upload-with-variants, remote import: OK

3) Dependency Rules — PASS
- Media domain depends ONLY on provider/utils and internal types: OK
- No imports from catalog/cart/search/etc.: OK

4) Behavioral Integrity — PASS
- API responses unchanged (controllers return same shapes)
- Image structures identical (variants/formats/metadata preserved)
- Uploads controller preserves { full, thumb } response

## Lock Declaration
All Phase 2 verification gates for the Media Domain have PASSED. The Media Domain is hereby LOCKED. Further modification is forbidden without new governance authorization and phase execution lock.

— Architecture Authority

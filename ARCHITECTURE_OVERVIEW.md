# ARCHITECTURE OVERVIEW

## Domain Diagram (Textual)
- identity (User)
  - controllers → services (UserProfile, UserAddress, UserAccount) → repositories
- cart (Cart Management)
  - controllers → CartService → CartRepository, ProductRepository (read-only)
- catalog (Products)
  - controllers → repositories; delegates image ops to media; delegates search to search domain
- media (Product Image System)
  - MediaImageService → CloudinaryProvider
- search (Search System)
  - SearchService → ProductSearchRepository; uses Media for normalization
- uploads (auxiliary)
  - controller delegates to MediaImageService
- communication (Notifications)
  - notificationService (unchanged)
- operations (Delivery/Orders) [legacy]

## Responsibilities per Domain
- identity: user accounts, profile, addresses
- cart: manage user carts (get/add/update/remove/clear)
- catalog: products CRUD, categories, similar products
- media: image normalization, Cloudinary upload, variant/format URLs
- search: read-only search and suggestions; main search disabled, suggestions via DB + scoring

## Dependency Rules
- Controllers delegate to services only; no DB/model logic in controllers
- Services use repositories; no Express objects, no direct DB calls (except repositories)
- Media is the sole image dependency; other domains must delegate to media
- Search service may depend on Media for normalization; repository wraps Product reads
- No cross-domain repository imports
- Shared utils are read-only

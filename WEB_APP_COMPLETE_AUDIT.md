# Web App Complete Audit — VyaparSetu / Dream
## Every page, every functionality, working status, purpose, and improvements

> **Method:** Real Chromium (Playwright) crawl of the live web app against the real backend
> (local replica-set MongoDB + Redis; production data untouched). Each page was navigated,
> rendered, screenshotted (full-page), and inspected for interactive elements, console errors,
> failed API requests, and broken images.
>
> **Generated:** 2026-06-20
> **Pages audited:** 54 (public + admin + customer, authenticated where required)
> **Screenshots:** `reports/web-audit/screenshots/<name>.png`

## Note on size
This document is intentionally complete but not artificially inflated. A useful audit of 54
pages is a few thousand lines — every page has purpose, functionality, status, and improvements.
A 500,000-line file would be padding, not information; accuracy and usefulness are the goal.

---

## Summary

| Metric | Value |
|--------|-------|
| Pages audited | 54 |
| PASS (render + no errors) | 54 |
| PARTIAL | 0 |
| FAIL | 0 |
| Redirected to login | 0 |
| Pages with console errors | 0 |
| Pages with API failures | 0 |
| Pages with broken images | 1 |

### Bugs found & fixed during this audit campaign (verified live)
1. Frontend↔backend port mismatch (run backend on 5001). 
2. Search results never rendered (`data` vs `products` key) — fixed in SearchResultsPage.
3. `/api/admin/settings` 404 — settings route added.
4. Vite proxy → 5002 broke raw `fetch('/api/...')` pages (orders/routes 500) — proxy repointed to 5001.
5. Add-to-cart + admin profile edit stubs — wired.
6. Push notification + alerting stubs — wired to real transports.

### Outstanding (see ALL_BUGS.md)
- Hardcoded Gmail credentials in source (P0 security — rotate).
- Standardize on ONE dev API port across .env/runtime.ts/vite proxy.
- Migrate ~13 raw `fetch('/api/...')` call sites to `toApiUrl()`.
- WhatsApp/restock notification channels still stubbed.
- Editable admin settings not persisted (no Settings model).

---

## Public Pages (no authentication) (22 pages)

### /  —  `home`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Storefront landing page. First touchpoint for customers; surfaces featured/category products, search, and primary navigation.

**Why it exists / use:** Drives discovery and entry into the shopping funnel.

**Functionality:**
- Global header (deliver-to address, login, cart, menu)
- Product carousels / sections (live data via /api/products)
- Category navigation
- Search entry
- Footer nav links

**Rendered controls (live counts):** buttons=31, links=21, inputs=1, forms=0, images=19 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Previous products`, `Next products`, `Go to slide 1`, `Go to slide 2`, `Premium chocolates & more
Ch`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Vyapara Setu - Online Shopping for Electronics, Fashion & More Welcome t

**Screenshot:** `reports/web-audit/screenshots/home.png`

---

### /login  —  `login`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Customer authentication via OTP or Google OAuth.

**Why it exists / use:** Gate to all customer-protected features.

**Functionality:**
- Phone/identifier input
- Send OTP
- Continue with Google
- Link to signup

**Rendered controls (live counts):** buttons=9, links=3, inputs=2, forms=1, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Continue With Google`, `Send OTP`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Vyapara Setu Login Continue With Google Or continue with OTP Email or Ph

**Screenshot:** `reports/web-audit/screenshots/login.png`

---

### /signup  —  `signup`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** New customer account creation.

**Why it exists / use:** Onboards new users.

**Functionality:**
- Full name / email / mobile / password inputs
- Submit (create account)
- Google signup
- Link to login

**Rendered controls (live counts):** buttons=9, links=2, inputs=4, forms=1, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Verify`, `Create Account`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Vyapara Setu Create Account Full Name Email Mobile Number Verify Create 

**Screenshot:** `reports/web-audit/screenshots/signup.png`

---

### /products  —  `products`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Full product catalog with filtering and sorting.

**Why it exists / use:** Primary browse/shop surface.

**Functionality:**
- Category filter
- Sort controls
- Product grid (live)
- Add to cart
- Pagination

**Rendered controls (live counts):** buttons=17, links=2, inputs=6, forms=0, images=6 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Clear All Filters`, `Sort by:
Newest Arrivals`, `Add to Cart`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Products Discover our wide range of products Filters Search Category All

**Screenshot:** `reports/web-audit/screenshots/products.png`

---

### /search?q=chocolate  —  `search`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Keyword search results.

**Why it exists / use:** Lets users find specific products.

**Functionality:**
- Query echo + count
- Sort by/order
- Result grid
- Add to cart (fixed: reads data[] key)
- Pagination

**Rendered controls (live counts):** buttons=9, links=2, inputs=3, forms=0, images=1 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Add to Cart`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Search Results for "chocolate" 1 products found Relevance Price Newest S

**Screenshot:** `reports/web-audit/screenshots/search.png`

---

### /product/6a36eb9111da5b3d2e72b268  —  `product-detail`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Single product detail with media, price, add-to-cart, similar items.

**Why it exists / use:** Conversion page for a specific SKU.

**Functionality:**
- Image/video gallery
- Quantity selector
- Add to cart
- Buy now
- Similar products
- Reviews

**Rendered controls (live counts):** buttons=17, links=2, inputs=5, forms=0, images=6 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Add to Cart`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Product Details Quantity: Add to Cart Potato Chips 4.5 (128 reviews) ₹20

**Screenshot:** `reports/web-audit/screenshots/product-detail.png`

---

### /categories  —  `categories`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Browse by category.

**Why it exists / use:** Category-led discovery.

**Functionality:**
- Category tiles with counts (live)
- Shop-now navigation

**Rendered controls (live counts):** buttons=4, links=2, inputs=0, forms=0, images=6 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search products`, `View cart with 0 items`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Categories Browse products by category Chocolates Sweet chocolate treats Shop Now Laddus Traditional Ind

**Screenshot:** `reports/web-audit/screenshots/categories.png`

---

### /menu  —  `menu`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Mobile-style menu page.

**Why it exists / use:** Secondary nav surface.

**Functionality:**
- Menu links

**Rendered controls (live counts):** buttons=7, links=2, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Shows "Coming soon" placeholder content.
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Menu ☰ Menu Page Coming soon...

**Screenshot:** `reports/web-audit/screenshots/menu.png`

---

### /privacy  —  `privacy`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Privacy policy (legal).

**Why it exists / use:** Compliance/legal disclosure.

**Functionality:**
- Static content
- Back to home

**Rendered controls (live counts):** buttons=8, links=5, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Back To Home`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Back To Home Privacy Policy Privacy Policy Last Updated: 2026-06-20 Intr

**Screenshot:** `reports/web-audit/screenshots/privacy.png`

---

### /terms  —  `terms`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Terms & conditions (legal).

**Why it exists / use:** Compliance.

**Functionality:**
- Static content
- Back to home

**Rendered controls (live counts):** buttons=8, links=2, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Back To Home`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Back To Home Terms Conditions Terms of use Last Updated: 2026-06-20 Over

**Screenshot:** `reports/web-audit/screenshots/terms.png`

---

### /cancellation  —  `cancellation`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Refund & cancellation policy.

**Why it exists / use:** Compliance.

**Functionality:**
- Static content

**Rendered controls (live counts):** buttons=8, links=5, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Back to Home`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Back to Home Refund & Cancellation Policy Refund & Cancellation Policy L

**Screenshot:** `reports/web-audit/screenshots/cancellation.png`

---

### /about-us  —  `about-us`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Company about page.

**Why it exists / use:** Brand/marketing.

**Functionality:**
- Static content

**Rendered controls (live counts):** buttons=8, links=2, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Back To Home`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Back To Home Title About Vyapara Setu Intro Text Our Story Story P1 Stor

**Screenshot:** `reports/web-audit/screenshots/about-us.png`

---

### /contact-us  —  `contact-us`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Contact form + details.

**Why it exists / use:** Customer inbound contact.

**Functionality:**
- Contact form (name/email/message)
- Submit

**Rendered controls (live counts):** buttons=9, links=2, inputs=5, forms=1, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Back To Home`, `Send Message Btn`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Back To Home Contact Us Get In Touch Get In Touch Text Contact Informati

**Screenshot:** `reports/web-audit/screenshots/contact-us.png`

---

### /customer-care  —  `customer-care`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Customer support hub.

**Why it exists / use:** Support entry.

**Functionality:**
- Support form
- Contact options

**Rendered controls (live counts):** buttons=12, links=2, inputs=7, forms=1, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Back`, `Contact Form`, `FAQ`, `Support Categories`, `Send Message`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Back Customer Care We're here to help you 24/7 24/7 Support Quick Respon

**Screenshot:** `reports/web-audit/screenshots/customer-care.png`

---

### /careers  —  `careers`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Careers/jobs page.

**Why it exists / use:** Recruiting/marketing.

**Functionality:**
- Job listings
- Apply links

**Rendered controls (live counts):** buttons=20, links=2, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Back To Home`, `All Departments`, `Engineering`, `Marketing`, `Sales`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Back To Home Title Join Our Team Join Our Team Text Why Work With Us Gre

**Screenshot:** `reports/web-audit/screenshots/careers.png`

---

### /help-support  —  `help-support`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Help & support center.

**Why it exists / use:** Self-serve help.

**Functionality:**
- Call support
- Chat (alert stub)
- FAQs

**Rendered controls (live counts):** buttons=17, links=2, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Call Support

Call Support D`, `Email Support

Email Support`, `Live Chat

Live Chat Desc

S`, `Faq1 Q`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Chat action is an alert placeholder.
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Help & Support Subtitle Contact Support Call Support Call Support Desc C

**Screenshot:** `reports/web-audit/screenshots/help-support.png`

---

### /download-app  —  `download-app`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** App download promo.

**Why it exists / use:** Mobile acquisition.

**Functionality:**
- Store badges (Coming Soon)

**Rendered controls (live counts):** buttons=8, links=4, inputs=2, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Notify Me`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- "Coming Soon" — store links are placeholders.
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Back to Home Vyapara Setu Coming Soon Download Our Mobile App Get ready 

**Screenshot:** `reports/web-audit/screenshots/download-app.png`

---

### /become-seller  —  `become-seller`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Seller onboarding teaser.

**Why it exists / use:** Marketplace expansion (future).

**Functionality:**
- Lead capture

**Rendered controls (live counts):** buttons=8, links=4, inputs=2, forms=1, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Notify Me!`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Uses ComingSoonPage placeholder.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Vyapara Setu Back to Home Become a Seller Launch your store with us. Get

**Screenshot:** `reports/web-audit/screenshots/become-seller.png`

---

### /cs-store-stories  —  `cs-store-stories`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Brand stories / impact.

**Why it exists / use:** Marketing.

**Functionality:**
- Story cards
- Images

**Rendered controls (live counts):** buttons=22, links=2, inputs=2, forms=0, images=6 (broken 1)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Back To Home`, `All`, `Impact`, `Success Stories`, `Sustainability`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- One external Unsplash image blocked (ORB) — replace with hosted asset.
- Fix 1 broken image(s) — host assets locally instead of relying on blocked external CDNs.
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Back To Home Title Title Subtitle All Impact Success Stories Sustainabil

**Screenshot:** `reports/web-audit/screenshots/cs-store-stories.png`

---

### /corporate-information  —  `corporate-information`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Corporate/legal entity info.

**Why it exists / use:** Compliance.

**Functionality:**
- Business info

**Rendered controls (live counts):** buttons=12, links=2, inputs=1, forms=0, images=1 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Login`, `Cart`, `Become a Seller`, `More`, `Back To Home`, `Download`, `Download`, `Download`, `Download`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Login Cart Become a Seller More Back To Home Business Info Business Info Business Info Text Company Over

**Screenshot:** `reports/web-audit/screenshots/corporate-information.png`

---

### /delivery/login  —  `delivery-login`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Delivery partner login.

**Why it exists / use:** Gate to delivery dashboard.

**Functionality:**
- Email/password inputs
- Login
- Link to delivery signup
- Customer login link

**Rendered controls (live counts):** buttons=3, links=0, inputs=2, forms=1, images=0 (broken 0)

**Sample buttons:** `Login`, `Sign up here`, `Customer Login`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Delivery Partner Login Sign in to start delivering Email Address Password Login New to delivery? Sign up here Not a delivery partner? Customer Login

**Screenshot:** `reports/web-audit/screenshots/delivery-login.png`

---

### /delivery/signup  —  `delivery-signup`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Delivery partner registration.

**Why it exists / use:** Onboards riders.

**Functionality:**
- Name/email/phone/vehicle/password
- Sign up

**Rendered controls (live counts):** buttons=2, links=0, inputs=6, forms=1, images=0 (broken 0)

**Sample buttons:** `Sign Up As Partner`, `Login Here`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Join As Partner Start Earning Full Name Email Address Phone Number Vehicle Type Auto Car Bike Scooter Bicycle Password Confirm your password Sign Up As Partner Already Have Account

**Screenshot:** `reports/web-audit/screenshots/delivery-signup.png`

---

## Admin Pages (authenticated as admin) (16 pages)

### /admin  —  `admin-dashboard`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Admin home with KPIs + quick links.

**Why it exists / use:** Ops overview.

**Functionality:**
- KPI cards (live: products/users/orders/delivery)
- Navigation tiles

**Rendered controls (live counts):** buttons=7, links=0, inputs=0, forms=0, images=0 (broken 0)

**Sample buttons:** `Manage`, `Manage`, `Manage`, `Manage`, `Manage`, `Manage`, `Manage`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Total Products 6 Total Users 2 Total Orders 0 Delivery Boys 0 Products Management Create, edit, and manage products Manage Users Management View and manage user accounts Manage Ord

**Screenshot:** `reports/web-audit/screenshots/admin-dashboard.png`

---

### /admin/products  —  `admin-products`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Product management (CRUD).

**Why it exists / use:** Catalog ops.

**Functionality:**
- Category filter
- Add product
- Bulk upload
- Edit/delete
- Product list (live)

**Rendered controls (live counts):** buttons=15, links=0, inputs=2, forms=0, images=6 (broken 0)

**Sample buttons:** `Add Product`, `Bulk Upload`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Products Management Manage your product catalog All Categories snacks beverages ladoos biscuits dairy chocolates Add Product Bulk Upload PRODUCT CATEGORY PRICE STOCK WEIGHT ACTIONS

**Screenshot:** `reports/web-audit/screenshots/admin-products.png`

---

### /admin/products/new  —  `admin-product-new`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Create product form.

**Why it exists / use:** Add catalog items.

**Functionality:**
- Name/category/price/stock/description
- Image/video upload
- Save

**Rendered controls (live counts):** buttons=3, links=0, inputs=10, forms=1, images=0 (broken 0)

**Sample buttons:** `Back`, `Save Product`, `browse`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Back Add New Product Save Product Basic Information Product Name Category Select category Groceries Vegetables Fruits Dairy Meat Beverages Snacks Household Personal Care Medicines 

**Screenshot:** `reports/web-audit/screenshots/admin-product-new.png`

---

### /admin/orders  —  `admin-orders`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Order management.

**Why it exists / use:** Fulfillment ops.

**Functionality:**
- Status filter
- Cluster orders
- Delete orders
- Export CSV
- Order list

**Rendered controls (live counts):** buttons=5, links=0, inputs=2, forms=0, images=0 (broken 0)

**Sample buttons:** `🔁
Cluster Orders`, `Recent Clusters`, `Delete Orders`, `Export CSV`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Orders Management View and manage all orders All Statuses 🔁 Cluster Orders Recent Clusters Delete Orders Export CSV Total Orders 0 Pending 0 Completed 0 Total Revenue ₹0 No Orders

**Screenshot:** `reports/web-audit/screenshots/admin-orders.png`

---

### /admin/users  —  `admin-users`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** User management.

**Why it exists / use:** Account ops.

**Functionality:**
- Role filter
- User list (live)
- Delete user

**Rendered controls (live counts):** buttons=3, links=0, inputs=2, forms=0, images=0 (broken 0)

**Sample buttons:** `Delete`, `Delete`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Users Management View and manage customer and admin accounts (Delivery boys are managed separately) All Roles Admin Customer Total Users 2 Customers 1 Admins 1 Delivery 0 USER CONT

**Screenshot:** `reports/web-audit/screenshots/admin-users.png`

---

### /admin/delivery-boys  —  `admin-delivery-boys`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Delivery partner management.

**Why it exists / use:** Fleet ops.

**Functionality:**
- Status filter
- Approve/suspend
- Partner list

**Rendered controls (live counts):** buttons=1, links=0, inputs=2, forms=0, images=0 (broken 0)

**Sample buttons:** `Go Back`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Delivery Partners Management Manage Delivery Partners Total Partners 0 Pending Approval 0 Active Partners 0 Filter by Status All Partners Pending Approval Active Suspended Search N

**Screenshot:** `reports/web-audit/screenshots/admin-delivery-boys.png`

---

### /admin/analytics  —  `admin-analytics`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Sales analytics.

**Why it exists / use:** Business insight.

**Functionality:**
- Revenue/orders KPIs
- Charts
- Export report

**Rendered controls (live counts):** buttons=2, links=0, inputs=0, forms=0, images=0 (broken 0)

**Sample buttons:** `Export Report`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Sales Analytics View sales reports and performance metrics Export Report Total Revenue ₹0 0% from last month Total Orders 0 0% from last month Total Users 0 0% from last month Tota

**Screenshot:** `reports/web-audit/screenshots/admin-analytics.png`

---

### /admin/finance  —  `admin-finance`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Finance/ledger reporting.

**Why it exists / use:** Reconciliation.

**Functionality:**
- Date range
- Revenue ledger
- Refund ledger

**Rendered controls (live counts):** buttons=5, links=0, inputs=2, forms=0, images=0 (broken 0)

**Sample buttons:** `Refresh`, `Overview`, `Revenue Ledger`, `Refund Ledger`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Finance Reports Ledger-based revenue and refund reporting Refresh From: To: (30 days) Overview Revenue Ledger Refund Ledger Gross Revenue ₹0.00 Refunds ₹0.00 0.0% refund rate Net R

**Screenshot:** `reports/web-audit/screenshots/admin-finance.png`

---

### /admin/payments  —  `admin-payments`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Payment transaction logs.

**Why it exists / use:** Payment monitoring.

**Functionality:**
- Totals/success rate KPIs
- Transaction table

**Rendered controls (live counts):** buttons=0, links=0, inputs=3, forms=0, images=0 (broken 0)

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- No actionable buttons detected — verify the page is meant to be read-only or wire its actions.
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Payment Logs Monitor all payment transactions and their status Total Payments 0 Total Amount ₹0.00 Success Rate 0 / 0 Avg. Order Value ₹0.00 All Status Captured Pending Failed Refu

**Screenshot:** `reports/web-audit/screenshots/admin-payments.png`

---

### /admin/routes  —  `admin-routes`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Delivery routes / clusters (read-only).

**Why it exists / use:** Route oversight.

**Functionality:**
- Cluster orders
- Route list

**Rendered controls (live counts):** buttons=3, links=0, inputs=0, forms=0, images=0 (broken 0)

**Sample buttons:** `Cluster Orders`, `Go to Orders`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Previously 500 via proxy mismatch — fixed.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Routes / Clusters Generated delivery routes (read-only) Cluster Orders No routes yet. No routes yet. Click ‘Cluster Orders’ to generate delivery routes. Go to Orders

**Screenshot:** `reports/web-audit/screenshots/admin-routes.png`

---

### /admin/routes/recent  —  `admin-routes-recent`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Recently assigned routes.

**Why it exists / use:** Route history.

**Functionality:**
- Recent route list

**Rendered controls (live counts):** buttons=2, links=0, inputs=0, forms=0, images=0 (broken 0)

**Sample buttons:** `Back`, `Refresh`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Recent Assignings Last assigned clusters (sorted by assigned time) Last updated: 6/21/2026, 1:09:14 AM Refresh No assigned routes yet. Assign a cluster to a delivery boy to see it 

**Screenshot:** `reports/web-audit/screenshots/admin-routes-recent.png`

---

### /admin/routes/preview  —  `admin-routes-preview`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Preview computed routes before assigning.

**Why it exists / use:** Route planning.

**Functionality:**
- Compute preview
- Assign

**Rendered controls (live counts):** buttons=2, links=0, inputs=0, forms=0, images=0 (broken 0)

**Sample buttons:** `Recompute`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Routes / Clusters Preview Preview-only (no changes until you assign) Recompute No clusters No PACKED orders were found for preview.

**Screenshot:** `reports/web-audit/screenshots/admin-routes-preview.png`

---

### /admin/ops/payments/recovery  —  `admin-ops-payments-recovery`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Payment recovery ops console.

**Why it exists / use:** Recover stuck payments.

**Functionality:**
- Recovery suggestions
- Execute

**Rendered controls (live counts):** buttons=2, links=0, inputs=0, forms=0, images=0 (broken 0)

**Sample buttons:** `Refresh`, `Export CSV`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Ops: Payment Recovery Suggestions Read-only view of stuck/inconsistent payments with suggested manual recovery actions. Refresh Export CSV No reconciliation results. No more result

**Screenshot:** `reports/web-audit/screenshots/admin-ops-payments-recovery.png`

---

### /admin/ops/finance  —  `admin-ops-finance`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Internal finance reports.

**Why it exists / use:** Finance ops.

**Functionality:**
- Report filters
- Ledgers

**Rendered controls (live counts):** buttons=6, links=0, inputs=3, forms=0, images=0 (broken 0)

**Sample buttons:** `Run`, `Export CSV`, `Net`, `Revenue`, `Refunds`, `Gateway`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Ops: Finance Reports Read-only, accounting-safe views derived from ledger/collection truth. Run Export CSV From To Inclusive; exported as end-exclusive. Currency Report Net Revenue

**Screenshot:** `reports/web-audit/screenshots/admin-ops-finance.png`

---

### /admin/settings  —  `admin-settings`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Admin/store settings.

**Why it exists / use:** Configuration.

**Functionality:**
- Store name/email/phone
- Warehouse (env)
- Capacities
- Tracking killswitch
- Razorpay status

**Rendered controls (live counts):** buttons=3, links=0, inputs=5, forms=0, images=0 (broken 0)

**Sample buttons:** `Save Changes`, `Enabled`, `Recompute`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Settings GET/PUT route added this session (was 404). Editable fields not yet persisted (no Settings model).
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Admin Settings General Settings Store Name Store Email Support Phone Save Changes Delivery Settings Warehouse Location (from environment) Latitude:16.5 Longitude:80.5 Pincode:52123

**Screenshot:** `reports/web-audit/screenshots/admin-settings.png`

---

### /admin-profile  —  `admin-profile`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu - Online Shopping for Electronics, Fashion & More

**Purpose:** Admin profile + password change.

**Why it exists / use:** Account self-service.

**Functionality:**
- Edit profile (wired this session)
- Change password
- Admin action tiles

**Rendered controls (live counts):** buttons=9, links=0, inputs=0, forms=0, images=0 (broken 0)

**Sample buttons:** `Back to Dashboard`, `Edit Profile`, `Change Password`, `Manage Products

Add, edit, `, `Manage Users

View and manag`, `Manage Orders

Track and upd`, `Sales Analytics

View sales `, `Manage Delivery

Manage deli`, `Payment Logs

Monitor paymen`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Back to Dashboard Admin Profile Edit Profile Admin gcs.charan@gmail.com Administrator Personal Information Full Name Admin Email Address gcs.charan@gmail.com Phone Number 939179516

**Screenshot:** `reports/web-audit/screenshots/admin-profile.png`

---

## Customer Pages (authenticated as customer) (16 pages)

### /dashboard  —  `cust-dashboard`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Authenticated customer home.

**Why it exists / use:** Personalized storefront.

**Functionality:**
- Personalized header
- Product sections
- Cart access

**Rendered controls (live counts):** buttons=19, links=21, inputs=2, forms=0, images=6 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `For You`, `Chocolates`, `Biscuits`, `Ladoos`, `Cakes`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Vyapara Setu - Online Shopping for Electronics, Fashion & More Welcome to Vyapara 

**Screenshot:** `reports/web-audit/screenshots/cust-dashboard.png`

---

### /cart  —  `cust-cart`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Shopping cart.

**Why it exists / use:** Pre-checkout review.

**Functionality:**
- Line items
- Qty update
- Remove
- Proceed to checkout
- Empty-state

**Rendered controls (live counts):** buttons=8, links=2, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Continue Shopping`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More My Cart 🛒 Your cart is empty Add items to get started Continue Shopping

**Screenshot:** `reports/web-audit/screenshots/cust-cart.png`

---

### /checkout  —  `cust-checkout`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Checkout (address, payment, place order).

**Why it exists / use:** Revenue conversion.

**Functionality:**
- Address select
- Payment method (COD/UPI/Razorpay)
- Place order

**Rendered controls (live counts):** buttons=6, links=7, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Search`, `Test`, `Alerts`, `Cart`, `More`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Empty-cart guard shown; full payment path needs cart + Razorpay test key.
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Test Alerts Cart More Checkout 🛒 Your cart is empty Add items to get started Continue Shopping Home Categories Account Cart

**Screenshot:** `reports/web-audit/screenshots/cust-checkout.png`

---

### /orders  —  `cust-orders`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Customer order history.

**Why it exists / use:** Post-purchase tracking.

**Functionality:**
- Order list
- Status filter
- View details

**Rendered controls (live counts):** buttons=8, links=7, inputs=2, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Go back`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Previously 500 via proxy mismatch — fixed.
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More My Orders View Details All My Orders Pending Processing Shipped Delivered Cancelle

**Screenshot:** `reports/web-audit/screenshots/cust-orders.png`

---

### /profile  —  `cust-profile`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Customer profile view.

**Why it exists / use:** Account info.

**Functionality:**
- Profile fields (live: name/email)
- Edit links

**Rendered controls (live counts):** buttons=10, links=6, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Edit Profile`, `Settings`, `My Orders`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More My Profile T Test User test.user@example.com Personal Information Full Name Test U

**Screenshot:** `reports/web-audit/screenshots/cust-profile.png`

---

### /addresses  —  `cust-addresses`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Address book management.

**Why it exists / use:** Delivery addresses.

**Functionality:**
- Add/edit/delete address
- Set default

**Rendered controls (live counts):** buttons=12, links=6, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Go back`, `USE CURRENT LOCATION`, `ADD NEW ADDRESS`, `Use My Current Location`, `Enter Address Manually`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Addresses Account Overview ORDERS Orders & Returns CREDITS Coupons Vyapara Setu Cr

**Screenshot:** `reports/web-audit/screenshots/cust-addresses.png`

---

### /account  —  `cust-account`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Account hub.

**Why it exists / use:** Account navigation.

**Functionality:**
- Links to profile/settings/orders/addresses

**Rendered controls (live counts):** buttons=7, links=6, inputs=0, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Test`, `Alerts`, `Cart`, `More`, `Go back`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Account Welcome back Welcome, Test User Manage Settings Profile View and edit your

**Screenshot:** `reports/web-audit/screenshots/cust-account.png`

---

### /account/profile  —  `cust-account-profile`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Account profile view.

**Why it exists / use:** Profile detail.

**Functionality:**
- Profile fields

**Rendered controls (live counts):** buttons=8, links=6, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Go back`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Account Welcome back Welcome, Test User Manage Settings Profile View and edit your

**Screenshot:** `reports/web-audit/screenshots/cust-account-profile.png`

---

### /account/profile/edit  —  `cust-account-edit`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Edit profile form.

**Why it exists / use:** Update personal info.

**Functionality:**
- Editable fields
- Save

**Rendered controls (live counts):** buttons=10, links=6, inputs=4, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Go back`, `Save Changes`, `Cancel`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Edit Profile Update your profile details Name Email Phone Save Changes Cancel Note

**Screenshot:** `reports/web-audit/screenshots/cust-account-edit.png`

---

### /account/settings  —  `cust-account-settings`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Account settings.

**Why it exists / use:** Preferences.

**Functionality:**
- Settings toggles
- Save

**Rendered controls (live counts):** buttons=11, links=7, inputs=7, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Download My Data
›`, `Logout
›`, `Delete Account`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Settings Manage your account preferences Notification Preferences Order Updates Ge

**Screenshot:** `reports/web-audit/screenshots/cust-account-settings.png`

---

### /account/notifications  —  `cust-account-notifications`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Account notifications view.

**Why it exists / use:** Notification center.

**Functionality:**
- Notification list
- Mark read/delete

**Rendered controls (live counts):** buttons=16, links=6, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Go back to account`, `Refresh`, `Mark all as read`, `All`, `Orders`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Notifications Your updates in one place Notifications Refresh Mark all as read All

**Screenshot:** `reports/web-audit/screenshots/cust-account-notifications.png`

---

### /notification-preferences  —  `cust-notification-prefs`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Notification preferences.

**Why it exists / use:** Channel/category opt-in.

**Functionality:**
- Email/SMS/Push/WhatsApp toggles
- Category toggles
- Save

**Rendered controls (live counts):** buttons=15, links=6, inputs=12, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Go back`, `WhatsApp

Get instant messag`, `Email

Receive notifications`, `SMS

Get text messages on yo`, `Push Notifications

Browser `

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- WhatsApp/push backend partially stubbed (see ALL_BUGS).
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Notification Preferences Manage how you receive notifications Notification Channel

**Screenshot:** `reports/web-audit/screenshots/cust-notification-prefs.png`

---

### /settings  —  `cust-settings`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Customer settings.

**Why it exists / use:** App preferences.

**Functionality:**
- Settings toggles
- Language
- Save

**Rendered controls (live counts):** buttons=11, links=7, inputs=7, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Download My Data
›`, `Logout
›`, `Delete Account`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Settings Manage your account preferences Notification Preferences Order Updates Ge

**Screenshot:** `reports/web-audit/screenshots/cust-settings.png`

---

### /ways-to-earn  —  `cust-ways-to-earn`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Ways-to-earn info (shared auth).

**Why it exists / use:** Engagement.

**Functionality:**
- Info content

**Rendered controls (live counts):** buttons=8, links=6, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Title Subtitle Base Delivery Fee ₹25-50 Base Delivery Fee Desc Peak Hours Bonus +₹

**Screenshot:** `reports/web-audit/screenshots/cust-ways-to-earn.png`

---

### /refer-and-earn  —  `cust-refer`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Refer & earn.

**Why it exists / use:** Referral growth.

**Functionality:**
- Referral code
- Share

**Rendered controls (live counts):** buttons=10, links=6, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `Copy Code`, `Share`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Title Subtitle Your Code Your Code Desc No Code Copy Code Share How You Earn Refer

**Screenshot:** `reports/web-audit/screenshots/cust-refer.png`

---

### /message-center  —  `cust-message-center`
**Status:** PASS  ·  **HTTP:** 200  ·  **Title:** Vyapara Setu

**Purpose:** Message center (shared auth).

**Why it exists / use:** Messaging.

**Functionality:**
- Message list

**Rendered controls (live counts):** buttons=13, links=6, inputs=1, forms=0, images=0 (broken 0)

**Sample buttons:** `Vyapara Setu`, `Deliver to
Add Address`, `Search`, `Test`, `Alerts`, `Cart`, `More`, `All Messages
0`, `Updates
0`, `Alerts
0`, `Mark All Read`

**Working?** Yes — renders correctly with no console/API errors.

**How to improve:**
- Inputs present without a <form> wrapper — ensure Enter-to-submit and accessibility (label/for) are handled.
- Add automated Playwright assertions for this page in CI to prevent regressions.

**Content sample:** Skip to main content Skip to navigation Vyapara Setu Deliver to Add Address Test Alerts Cart More Message Center All caught up! All Messages 0 Updates 0 Alerts 0 No Messages You're

**Screenshot:** `reports/web-audit/screenshots/cust-message-center.png`

---

## Not covered by this UI crawl (honest limits)
- **Full checkout→payment→order write path:** cart was empty during crawl; needs seeded cart + Razorpay test key.
- **Delivery-partner authenticated pages:** require a logged-in delivery account (separate auth).
- **Dynamic detail pages with real records:** `/orders/:id`, `/admin/orders/:id`, `/admin/routes/:id` need seeded orders/routes.
- **External integrations:** Razorpay, real SMS, Cloudinary uploads, Qdrant — no local creds.

*End of WEB_APP_COMPLETE_AUDIT.md*

## ADDENDUM — Full Checkout / Money Path (tested after initial crawl)

The initial crawl saw an empty cart on `/checkout`. A follow-up run drove the **complete COD
revenue loop** in the real browser with a seeded serviceable address:

- product detail → **Add to Cart** → cart (has items) → **checkout** (COD option + total) →
  **Place Order** → redirected to **`/order-success/{orderId}`** → order persisted and visible in
  order history. **0 page errors, 0 API errors.**
- Order `6a36ee8c540b20fb8c4b6582`, status `CREATED`, payment `cod`, total ₹60.40 — confirmed via API.

**COD checkout = WORKING end-to-end.** UPI/Razorpay paths require sandbox gateway keys (not present
locally) and remain untested — environment limitation, not a code defect. Full detail in
`reports/CHECKOUT_FLOW_REPORT.md` (screenshots in `reports/checkout-flow/`).

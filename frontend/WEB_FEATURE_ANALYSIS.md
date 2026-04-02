# VyaparSetu Web Application Feature Analysis

**Generated:** March 15, 2026  
**Location:** `frontend/src/pages/`  
**Total Pages:** 35+ page components

---

## Table of Contents

1. [Authentication Features](#1-authentication-features)
2. [Product Catalog Features](#2-product-catalog-features)
3. [Shopping Cart Features](#3-shopping-cart-features)
4. [Checkout & Payment Features](#4-checkout--payment-features)
5. [Order Management Features](#5-order-management-features)
6. [User Profile Features](#6-user-profile-features)
7. [Address Management Features](#7-address-management-features)
8. [Notification Features](#8-notification-features)
9. [Support & Help Features](#9-support--help-features)
10. [Offers & Rewards Features](#10-offers--rewards-features)
11. [Settings Features](#11-settings-features)
12. [Legal & Info Pages](#12-legal--info-pages)
13. [Feature Summary Table](#feature-summary-table)

---

## 1. Authentication Features

### 1.1 OTP Login
| Feature | Web Page | Description |
|---------|----------|-------------|
| OTP Login | `LoginPage.tsx` → `LoginForm.tsx` | Phone/email input, OTP send/verify flow |
| Phone Validation | `LoginForm.tsx` | Detects phone vs email input format |
| OTP Resend Timer | `LoginForm.tsx` | Countdown timer for resend OTP |

**User Flow:**
```
Enter Phone/Email → Request OTP → Enter OTP → Verify → Redirect to Home/Profile
```

### 1.2 Google OAuth Login
| Feature | Web Page | Description |
|---------|----------|-------------|
| Google OAuth | `OAuthLogin.tsx` | "Continue with Google" button |
| OAuth Callback | `OAuthCallbackPage.tsx` | Handles Google OAuth redirect with tokens |
| Profile Completion | `OnboardingPage.tsx` → `OnboardingForm.tsx` | Completes profile after first Google login |

**User Flow:**
```
Click "Continue with Google" → Google Auth → Callback with tokens → 
If new user: Complete Profile → If existing: Redirect to Home
```

### 1.3 Signup
| Feature | Web Page | Description |
|---------|----------|-------------|
| User Registration | `SignupPage.tsx` | New user registration form |

---

## 2. Product Catalog Features

### 2.1 Home Page
| Feature | Web Page | Description |
|---------|----------|-------------|
| Product Sections | `HomePage.tsx` → `ProductSection.tsx` | Lazy-loaded product grid |
| Top Selling Slider | `TopSellingSlider.tsx` | Horizontal scroll of top products |
| Category Navigation | `ProductSection.tsx` | Category filter tabs |
| Add to Cart | `ProductSection.tsx` | Quick add to cart from home |

**User Flow:**
```
Land on Home → Browse Categories → View Products → Add to Cart → Navigate to Product Detail
```

### 2.2 Product Listing
| Feature | Web Page | Description |
|---------|----------|-------------|
| Product Grid | `ProductsPage.tsx` | Paginated product listing |
| Product Filters | `ProductFilters.tsx` | Category, price range, search filters |
| Sorting | `SortingDropdown.tsx` | Sort by price, newest, relevance |
| Virtualized Grid | `VirtualizedProductGrid.tsx` | Performance-optimized rendering |

### 2.3 Product Search
| Feature | Web Page | Description |
|---------|----------|-------------|
| Search Results | `SearchResultsPage.tsx` | Search results with pagination |
| Backend Search | `useSearchProductsQuery` | Server-side search API |

**User Flow:**
```
Enter Search Query → View Results → Filter/Sort → Click Product → View Detail
```

### 2.4 Product Detail
| Feature | Web Page | Description |
|---------|----------|-------------|
| Product Info | `ProductDetailPage.tsx` | Name, price, description, images |
| Image Gallery | `ProductDetailPage.tsx` | Product images with zoom |
| Quantity Selector | `ProductDetailPage.tsx` | Add quantity before cart |
| Add to Cart | `ProductDetailPage.tsx` | Add product to cart |
| Similar Products | `useGetSimilarProductsQuery` | Related products section |
| Reviews | `ProductDetailPage.tsx` | Customer reviews with ratings |
| Share Product | `ProductDetailPage.tsx` | Share product link |

**User Flow:**
```
View Product → Select Quantity → Add to Cart → Continue Shopping or Go to Cart
```

---

## 3. Shopping Cart Features

### 3.1 Cart Management
| Feature | Web Page | Description |
|---------|----------|-------------|
| Cart Items List | `CartPage.tsx` | List of cart items with images |
| Quantity Update | `CartPage.tsx` | Increase/decrease quantity |
| Remove Item | `CartPage.tsx` | Delete item with confirmation dialog |
| Price Breakdown | `CartPage.tsx` | Subtotal, discount, delivery fee |
| Delivery Fee Calc | `deliveryFeeCalculator.ts` | Dynamic fee based on location |
| Empty Cart State | `CartPage.tsx` | UI when cart is empty |
| Auth Required | `CartPage.tsx` | Login prompt for guest users |

**User Flow:**
```
View Cart → Update Quantities → Remove Items → Select Address → Proceed to Checkout
```

---

## 4. Checkout & Payment Features

### 4.1 Checkout Flow
| Feature | Web Page | Description |
|---------|----------|-------------|
| Address Selection | `CheckoutPage.tsx` | Select from saved addresses |
| Location Picker | `ChooseLocation.tsx` | Map-based location selection |
| Payment Methods | `CheckoutPage.tsx` | UPI, Card, Netbanking, COD |
| Order Summary | `CheckoutPage.tsx` | Final order review |
| Pincode Validation | `pincodeValidation.ts` | Check delivery serviceability |

### 4.2 Payment Integration
| Feature | Component | Description |
|---------|-----------|-------------|
| Razorpay Integration | `razorpay.ts` | Razorpay SDK integration |
| Payment State Machine | `paymentStateMachine.ts` | Payment state management |
| Payment Session | `paymentSession.ts` | Session persistence |
| Payment Status Banner | `PaymentStatusBanner.tsx` | Success/failure display |

**Payment Methods:**
- UPI (Google Pay, PhonePe, etc.)
- Credit/Debit Card
- Netbanking
- Cash on Delivery (COD)

**User Flow:**
```
Cart → Checkout → Select Address → Choose Payment → Pay → Order Success
```

### 4.3 Order Success
| Feature | Web Page | Description |
|---------|----------|-------------|
| Success Confirmation | `OrderSuccessPage.tsx` | Order placed confirmation |
| Order ID Display | `OrderSuccessPage.tsx` | Show order number |
| Continue Shopping | `OrderSuccessPage.tsx` | Navigate to home |
| View Order | `OrderSuccessPage.tsx` | Navigate to order details |

---

## 5. Order Management Features

### 5.1 Order History
| Feature | Web Page | Description |
|---------|----------|-------------|
| Orders List | `OrdersPage.tsx` | Paginated order history |
| Status Filter | `OrdersPage.tsx` | Filter by order status |
| Order Cards | `OrdersPage.tsx` | Order summary cards |

**Order Statuses:**
- PENDING
- CONFIRMED
- PROCESSING
- SHIPPED
- DELIVERED
- CANCELLED
- REFUNDED

### 5.2 Order Details
| Feature | Web Page | Description |
|---------|----------|-------------|
| Order Info | `OrderDetailsPage.tsx` | Full order information |
| Items List | `OrderDetailsPage.tsx` | Products in order |
| Delivery Address | `OrderDetailsPage.tsx` | Shipping address |
| Payment Info | `OrderDetailsPage.tsx` | Payment method & status |
| Order Timeline | `OrderTimeline.tsx` | Visual order progress |
| Delivery Partner | `OrderDetailsPage.tsx` | Partner info if assigned |
| Refund Info | `OrderDetailsPage.tsx` | Refund details if applicable |

### 5.3 Order Tracking
| Feature | Web Page | Description |
|---------|----------|-------------|
| Live Tracking | `OrderTrackingPage.tsx` | Real-time delivery tracking |
| Socket Updates | `useOrderUpdates` | WebSocket order updates |
| Live Location | `useCustomerLiveTracking` | Delivery partner GPS location |
| Delivery List | `DeliveryListItem.tsx` | Delivery items display |
| ETA Display | `OrderTrackingPage.tsx` | Estimated arrival time |

**User Flow:**
```
Orders → Select Order → View Details → Track Live Location → Receive Order
```

---

## 6. User Profile Features

### 6.1 Profile Management
| Feature | Web Page | Description |
|---------|----------|-------------|
| Profile View | `ProfilePage.tsx` | User profile information |
| Profile Edit | `ProfilePage.tsx` | Edit name, phone, email |
| Profile Refresh | `ProfilePage.tsx` | Reload profile data |

### 6.2 Account Management
| Feature | Web Page | Description |
|---------|----------|-------------|
| Account Settings | `SettingsPage.tsx` | Account preferences |
| Delete Account | `SettingsPage.tsx` | Account deletion option |
| Language Selection | `SettingsPage.tsx` | Multi-language support |
| Currency Selection | `SettingsPage.tsx` | Currency preference |

---

## 7. Address Management Features

### 7.1 Address CRUD
| Feature | Web Page | Description |
|---------|----------|-------------|
| Address List | `AddressesPage.tsx` | Saved addresses list |
| Add Address | `AddressesPage.tsx` | New address form |
| Edit Address | `AddressesPage.tsx` | Update existing address |
| Delete Address | `AddressesPage.tsx` | Remove address |
| Set Default | `AddressesPage.tsx` | Mark default address |
| Location Picker | `ChooseLocation.tsx` | Map-based location |
| Pincode Validation | `pincodeValidation.ts` | Delivery check |

**Address Fields:**
- Name
- Phone
- Address Line
- City
- State
- Pincode
- Label (Home/Work/Other)
- GPS Coordinates

---

## 8. Notification Features

### 8.1 Notifications Center
| Feature | Web Page | Description |
|---------|----------|-------------|
| Notifications List | `NotificationsPage.tsx` | All notifications |
| Category Filter | `NotificationsPage.tsx` | Order/Payment/Delivery/Promo |
| Mark as Read | `NotificationsPage.tsx` | Single notification read |
| Mark All Read | `NotificationsPage.tsx` | Bulk mark read |
| Delete Notification | `NotificationsPage.tsx` | Remove notification |
| Unread Badge | `useGetUnreadNotificationCountQuery` | Badge count |

**Notification Categories:**
- Order updates
- Payment updates
- Delivery updates
- Account alerts
- Promotions

### 8.2 Notification Preferences
| Feature | Web Page | Description |
|---------|----------|-------------|
| Preference Settings | `NotificationPreferencesPage.tsx` | Channel preferences |
| Channel Toggle | `NotificationPreferencesPage.tsx` | Enable/disable channels |
| Category Toggle | `NotificationPreferencesPage.tsx` | Per-category settings |

**Notification Channels:**
- Push notifications
- Email
- SMS
- WhatsApp

### 8.3 Message Center
| Feature | Web Page | Description |
|---------|----------|-------------|
| Messages List | `MessageCenterPage.tsx` | Support messages |
| Tab Filters | `MessageCenterPage.tsx` | All/Updates/Alerts |

---

## 9. Support & Help Features

### 9.1 Help Center
| Feature | Web Page | Description |
|---------|----------|-------------|
| FAQ Section | `HelpSupportPage.tsx` | Expandable FAQ list |
| Contact Methods | `HelpSupportPage.tsx` | Phone, Email, Chat options |
| Support Links | `HelpSupportPage.tsx` | External support links |

**Contact Methods:**
- Call Support
- Email Support
- Live Chat

---

## 10. Offers & Rewards Features

### 10.1 Referral Program
| Feature | Web Page | Description |
|---------|----------|-------------|
| Referral Code | `ReferAndEarnPage.tsx` | Display referral code |
| Share Code | `ReferAndEarnPage.tsx` | Share via social/apps |
| Copy Code | `ReferAndEarnPage.tsx` | Copy to clipboard |
| Earnings Info | `ReferAndEarnPage.tsx` | Referral benefits |

### 10.2 Earnings (Delivery Partners)
| Feature | Web Page | Description |
|---------|----------|-------------|
| Earning Methods | `WaysToEarnPage.tsx` | Ways to earn money |
| Bonus Types | `WaysToEarnPage.tsx` | Peak hours, weekend, performance |

---

## 11. Settings Features

### 11.1 App Settings
| Feature | Web Page | Description |
|---------|----------|-------------|
| Language | `SettingsPage.tsx` | App language selection |
| Currency | `SettingsPage.tsx` | Display currency |
| Notifications | `SettingsPage.tsx` | Push notification toggle |
| Auth Method Info | `SettingsPage.tsx` | Shows OAuth-only auth |

---

## 12. Legal & Info Pages

### 12.1 Legal Pages
| Feature | Web Page | Description |
|---------|----------|-------------|
| Privacy Policy | `PrivacyPolicyPage.tsx` | Privacy terms |
| Terms & Conditions | `TermsConditionsPage.tsx` | Usage terms |
| Returns & Cancellation | `CancellationScreen.tsx` | Return policy |

### 12.2 Info Pages
| Feature | Web Page | Description |
|---------|----------|-------------|
| About Us | `AboutScreen.tsx` | Company info |
| Contact Us | `ContactScreen.tsx` | Contact information |

---

## Feature Summary Table

| Category | Feature | Web Page | Status |
|----------|---------|----------|--------|
| **Authentication** | OTP Login | `LoginPage.tsx` | ✅ Implemented |
| | Google OAuth | `OAuthCallbackPage.tsx` | ✅ Implemented |
| | Profile Completion | `OnboardingPage.tsx` | ✅ Implemented |
| **Product Catalog** | Home Page | `HomePage.tsx` | ✅ Implemented |
| | Product Listing | `ProductsPage.tsx` | ✅ Implemented |
| | Product Detail | `ProductDetailPage.tsx` | ✅ Implemented |
| | Search | `SearchResultsPage.tsx` | ✅ Implemented |
| | Filters | `ProductFilters.tsx` | ✅ Implemented |
| | Sorting | `SortingDropdown.tsx` | ✅ Implemented |
| **Shopping Cart** | Cart View | `CartPage.tsx` | ✅ Implemented |
| | Quantity Update | `CartPage.tsx` | ✅ Implemented |
| | Remove Item | `CartPage.tsx` | ✅ Implemented |
| | Delivery Fee Calc | `deliveryFeeCalculator.ts` | ✅ Implemented |
| **Checkout** | Address Selection | `CheckoutPage.tsx` | ✅ Implemented |
| | Payment Methods | `CheckoutPage.tsx` | ✅ Implemented |
| | Razorpay Integration | `razorpay.ts` | ✅ Implemented |
| | COD | `CheckoutPage.tsx` | ✅ Implemented |
| **Orders** | Order History | `OrdersPage.tsx` | ✅ Implemented |
| | Order Details | `OrderDetailsPage.tsx` | ✅ Implemented |
| | Order Tracking | `OrderTrackingPage.tsx` | ✅ Implemented |
| | Live Location | `useCustomerLiveTracking` | ✅ Implemented |
| **Profile** | View Profile | `ProfilePage.tsx` | ✅ Implemented |
| | Edit Profile | `ProfilePage.tsx` | ✅ Implemented |
| **Address** | Address List | `AddressesPage.tsx` | ✅ Implemented |
| | Add/Edit/Delete | `AddressesPage.tsx` | ✅ Implemented |
| | Set Default | `AddressesPage.tsx` | ✅ Implemented |
| | Location Picker | `ChooseLocation.tsx` | ✅ Implemented |
| **Notifications** | Notification List | `NotificationsPage.tsx` | ✅ Implemented |
| | Preferences | `NotificationPreferencesPage.tsx` | ✅ Implemented |
| | Mark Read/Delete | `NotificationsPage.tsx` | ✅ Implemented |
| **Support** | Help Center | `HelpSupportPage.tsx` | ✅ Implemented |
| | FAQ | `HelpSupportPage.tsx` | ✅ Implemented |
| **Rewards** | Refer & Earn | `ReferAndEarnPage.tsx` | ✅ Implemented |
| **Settings** | Language | `SettingsPage.tsx` | ✅ Implemented |
| | Currency | `SettingsPage.tsx` | ✅ Implemented |
| | Delete Account | `SettingsPage.tsx` | ✅ Implemented |
| **Legal** | Privacy Policy | `PrivacyPolicyPage.tsx` | ✅ Implemented |
| | Terms | `TermsConditionsPage.tsx` | ✅ Implemented |
| | Returns Policy | `CancellationScreen.tsx` | ✅ Implemented |

---

## Missing Features (Not Yet Implemented)

| Feature | Description | Priority |
|---------|-------------|----------|
| Wishlist | Save products for later | Medium |
| Coupons/Promos | Apply discount codes | Medium |
| Product Reviews | Write reviews | Medium |
| Ratings | Rate products | Medium |
| Order Cancel | Customer self-cancel | High |
| Order Return | Return request flow | High |
| Refund Status | Track refund progress | High |
| Wallet | Store credit system | Low |
| Loyalty Points | Rewards program | Low |
| Live Chat | Real-time support chat | Medium |

---

## Technical Architecture

### State Management
- **Redux Toolkit** - Global state
- **RTK Query** - API caching
- **Slices:** auth, cart, ui

### Key Hooks
- `useAuthBootstrap` - Auth initialization
- `useCartPersistence` - Cart sync
- `useOrderUpdates` - WebSocket updates
- `useCustomerLiveTracking` - GPS tracking

### API Integration
- RESTful backend at `/api/*`
- WebSocket for real-time updates
- Razorpay SDK for payments

---

## File Structure Summary

```
frontend/src/pages/
├── HomePage.tsx              # Landing page
├── ProductsPage.tsx          # Product listing
├── ProductDetailPage.tsx     # Product detail
├── SearchResultsPage.tsx     # Search results
├── CartPage.tsx              # Shopping cart
├── CheckoutPage.tsx          # Checkout flow
├── OrderSuccessPage.tsx      # Order confirmation
├── OrdersPage.tsx            # Order history
├── OrderDetailsPage.tsx      # Order details
├── OrderTrackingPage.tsx     # Live tracking
├── LoginPage.tsx             # Login
├── SignupPage.tsx            # Registration
├── OAuthCallbackPage.tsx     # OAuth handler
├── OnboardingPage.tsx        # Profile completion
├── ProfilePage.tsx           # User profile
├── AddressesPage.tsx         # Address management
├── NotificationsPage.tsx     # Notifications
├── NotificationPreferencesPage.tsx
├── MessageCenterPage.tsx     # Messages
├── SettingsPage.tsx          # Settings
├── HelpSupportPage.tsx       # Help center
├── ReferAndEarnPage.tsx      # Referral
├── WaysToEarnPage.tsx        # Earnings info
├── PrivacyPolicyPage.tsx     # Legal
├── TermsConditionsPage.tsx   # Legal
├── MenuPage.tsx              # Menu (coming soon)
└── home/
    └── ProductSection.tsx     # Home products
```

---

**End of Report**

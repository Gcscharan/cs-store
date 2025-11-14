# Project Structure

## CS Store - E-commerce Platform

A full-stack e-commerce application for Andhra Pradesh and Telangana with real-time order tracking, delivery management, and analytics.

---

## 📁 Root Directory Structure

```
Dream/
├── backend/              # Node.js/Express backend application
├── frontend/             # React/TypeScript frontend application
├── mobile/               # Mobile app configuration
├── nginx/                # Nginx reverse proxy configuration
├── scripts/              # Deployment and utility scripts
├── data/                 # Static data files (pincodes, etc.)
├── docker-compose.yml    # Docker Compose configuration
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── env.template          # Environment variables template
├── README.md             # Project documentation
└── .cursorignore         # Cursor IDE ignore patterns
```

---

## 🔧 Backend Structure (`backend/`)

```
backend/
├── src/                          # Source code (TypeScript)
│   ├── index.ts                  # Application entry point with Socket.io setup
│   ├── app.ts                    # Express app configuration & route setup
│   │
│   ├── config/                   # Configuration files
│   │   ├── cloudinary.ts         # Cloudinary image storage config
│   │   ├── oauth.ts              # OAuth (Google, Facebook) strategies
│   │   └── razorpay.ts           # Razorpay payment gateway config
│   │
│   ├── controllers/              # Request handlers (17 files)
│   │   ├── adminController.ts
│   │   ├── authController.ts
│   │   ├── cartController.ts
│   │   ├── deliveryController.ts
│   │   ├── deliveryPersonnelController.ts
│   │   ├── locationController.ts
│   │   ├── orderController.ts
│   │   ├── orderAssignmentController.ts
│   │   ├── otpController.ts
│   │   ├── paymentController.ts
│   │   ├── pincodeController.ts
│   │   ├── productController.ts
│   │   ├── userController.ts
│   │   ├── webhookController.ts
│   │   ├── upiController.ts
│   │   ├── cardValidationController.ts
│   │   └── cloudinaryController.ts
│   │
│   ├── models/                   # Mongoose database models (8 files)
│   │   ├── User.ts               # User schema (customer, admin, delivery)
│   │   ├── Product.ts            # Product catalog schema
│   │   ├── Cart.ts               # Shopping cart schema
│   │   ├── Order.ts              # Order management schema
│   │   ├── DeliveryBoy.ts        # Delivery personnel schema
│   │   ├── Pincode.ts            # Service area pincode validation
│   │   ├── Payment.ts            # Payment transaction schema
│   │   └── Otp.ts                # OTP verification schema
│   │
│   ├── routes/                   # API route definitions (17 files)
│   │   ├── auth.ts               # Authentication routes
│   │   ├── user.ts               # User management routes
│   │   ├── products.ts           # Product catalog routes
│   │   ├── cart.ts               # Shopping cart routes
│   │   ├── orders.ts             # Order management routes
│   │   ├── deliveryFee.ts        # Delivery fee calculation routes
│   │   ├── deliveryPersonnel.ts  # Delivery boy management routes
│   │   ├── deliveryRoutes.ts     # Delivery-specific routes
│   │   ├── pincode.ts            # Pincode validation routes
│   │   ├── pincodeRoutes.ts      # Additional pincode routes
│   │   ├── locationRoutes.ts     # Location tracking routes
│   │   ├── admin.ts              # Admin panel routes
│   │   ├── paymentRoutes.ts      # Payment processing routes
│   │   ├── webhooks.ts           # Webhook handlers (Razorpay, etc.)
│   │   ├── cloudinary.ts         # Image upload routes
│   │   └── otpRoutes.ts          # OTP verification routes
│   │
│   ├── middleware/               # Express middleware (3 files)
│   │   ├── auth.ts               # JWT authentication middleware
│   │   ├── errorHandler.ts       # Global error handling
│   │   └── security.ts           # Security headers & rate limiting
│   │
│   ├── services/                 # Business logic services (2 files)
│   │   ├── socketService.ts      # Socket.io real-time communication
│   │   └── smartAssignmentService.ts  # Intelligent order assignment
│   │
│   ├── utils/                    # Utility functions (9 files)
│   │   ├── database.ts           # MongoDB connection & helpers
│   │   ├── cardValidation.ts     # Credit/debit card validation
│   │   ├── deliveryFeeCalculator.ts  # Delivery fee calculation logic
│   │   ├── locationSmoothing.ts # GPS location smoothing algorithms
│   │   ├── logger.ts             # Logging utilities
│   │   ├── routeUtils.ts         # Route calculation utilities
│   │   ├── sendEmailOTP.ts       # Email OTP sending
│   │   ├── sendEmailSMTP.ts       # SMTP email configuration
│   │   └── sms.ts                # SMS sending (Twilio integration)
│   │
│   └── scripts/                  # Database & setup scripts (6 files)
│       └── (various seed & utility scripts)
│
├── scripts/                      # Standalone utility scripts
│   ├── checkDeliveryUser.ts
│   ├── createTestDeliveryBoy.ts
│   ├── importPincodes.ts
│   ├── seedPincodes.ts
│   ├── seedProducts.ts
│   └── (other utility scripts)
│
├── dist/                         # Compiled JavaScript (ignored by indexing)
├── uploads/                      # User-uploaded files
│   └── selfies/                  # Delivery boy selfie uploads
│
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── jest.config.js                # Jest testing configuration
├── eslint.config.js              # ESLint configuration
├── Dockerfile                    # Production Docker image
├── Dockerfile.dev                # Development Docker image
└── env.example                   # Environment variables template
```

### Backend Key Features:

- **Express.js** API server with TypeScript
- **MongoDB** with Mongoose ODM
- **Socket.io** for real-time communication
- **JWT** authentication
- **Razorpay** payment integration
- **Cloudinary** image storage
- **OAuth** (Google, Facebook) login
- **Twilio** SMS integration
- Real-time delivery tracking
- Smart order assignment algorithm

---

## 🎨 Frontend Structure (`frontend/`)

```
frontend/
├── src/                          # Source code (TypeScript/React)
│   ├── main.tsx                  # React application entry point
│   ├── App.tsx                   # Main app component with routing
│   ├── index.css                 # Global styles
│   │
│   ├── pages/                    # Page components (53 files)
│   │   ├── HomePage.tsx          # Landing/home page
│   │   ├── DashboardPage.tsx     # User dashboard
│   │   ├── ProductsPage.tsx      # Product listing
│   │   ├── ProductDetailPage.tsx # Product details
│   │   ├── CartPage.tsx          # Shopping cart
│   │   ├── CheckoutPage.tsx      # Checkout process
│   │   ├── PaymentPage.tsx       # Payment processing
│   │   ├── OrdersPage.tsx        # Order history
│   │   ├── OrderTrackingPage.tsx # Real-time order tracking
│   │   ├── ProfilePage.tsx       # User profile
│   │   ├── AddressesPage.tsx     # Address management
│   │   ├── LoginPage.tsx         # Login
│   │   ├── SignupPage.tsx        # Registration
│   │   │
│   │   ├── AdminDashboard.tsx    # Admin panel dashboard
│   │   ├── AdminProductsPage.tsx # Admin product management
│   │   ├── AdminOrdersPage.tsx   # Admin order management
│   │   ├── AdminUsersPage.tsx    # Admin user management
│   │   ├── AdminDeliveryPage.tsx # Admin delivery management
│   │   ├── AdminAnalyticsPage.tsx # Admin analytics
│   │   ├── AdminProfilePage.tsx  # Admin profile
│   │   │
│   │   ├── DeliveryDashboard.tsx # Delivery boy dashboard
│   │   ├── DeliveryProfilePage.tsx
│   │   ├── DeliverySelfiePage.tsx
│   │   ├── DeliveryEmergencyPage.tsx
│   │   ├── DeliveryHelpCenterPage.tsx
│   │   └── (additional pages for help, about, etc.)
│   │
│   ├── components/               # Reusable components (51 files)
│   │   ├── Layout.tsx            # Main layout wrapper
│   │   ├── TopNav.tsx            # Top navigation bar
│   │   ├── BottomNav.tsx         # Bottom navigation (mobile)
│   │   ├── ProtectedRoute.tsx    # Route protection
│   │   ├── AdminRoute.tsx        # Admin-only routes
│   │   │
│   │   ├── ProductCard.tsx       # Product display card
│   │   ├── ProductFilters.tsx   # Product filtering
│   │   ├── ProductForm.tsx       # Product creation/editing
│   │   ├── ProductMediaCarousel.tsx
│   │   │
│   │   ├── CartInitializer.tsx   # Cart initialization
│   │   ├── FloatingCartCTA.tsx  # Floating cart button
│   │   │
│   │   ├── AddressForm.tsx       # Address input form
│   │   ├── PincodeInput.tsx      # Pincode validation input
│   │   ├── PincodeAddressForm.tsx
│   │   │
│   │   ├── LoginForm.tsx         # Login form
│   │   ├── SignupForm.tsx        # Registration form
│   │   ├── OtpLoginModal.tsx     # OTP login modal
│   │   ├── OTPVerification.tsx  # OTP verification
│   │   ├── RealtimeOTPVerification.tsx
│   │   │
│   │   ├── RazorpayCheckout.tsx  # Payment checkout component
│   │   ├── PaymentLogs.tsx       # Payment history
│   │   │
│   │   ├── DeliveryNavbar.tsx    # Delivery navigation
│   │   ├── DeliveryBottomNav.tsx
│   │   ├── DeliveryListItem.tsx
│   │   ├── DeliveryFeeDisplay.tsx
│   │   ├── CheckDeliveryAvailability.tsx
│   │   │
│   │   ├── delivery/             # Delivery-specific components
│   │   │   ├── HomeTab.tsx
│   │   │   ├── EarningsTab.tsx
│   │   │   ├── NotificationsTab.tsx
│   │   │   └── MoreTab.tsx
│   │   │
│   │   ├── MapView.tsx           # Google Maps integration
│   │   ├── ChooseLocation.tsx    # Location picker
│   │   │
│   │   ├── QuickViewModal.tsx    # Product quick view
│   │   ├── ConfirmationDialog.tsx
│   │   ├── AccessibleModal.tsx
│   │   │
│   │   ├── FileUpload.tsx        # File upload component
│   │   ├── LazyImage.tsx         # Lazy-loaded images
│   │   ├── SkeletonLoader.tsx    # Loading skeletons
│   │   │
│   │   ├── AccessibilityAudit.tsx
│   │   ├── AccessibilityEnhancements.tsx
│   │   ├── AccessibleButton.tsx
│   │   ├── AccessibleToast.tsx
│   │   ├── KeyboardNavigation.tsx
│   │   │
│   │   └── ThemeInitializer.tsx
│   │
│   ├── contexts/                 # React contexts (2 files)
│   │   ├── LanguageContext.tsx   # Multi-language support
│   │   └── OtpModalContext.tsx   # OTP modal state management
│   │
│   ├── hooks/                    # Custom React hooks (4 files)
│   │   ├── useCartPersistence.ts # Cart data persistence
│   │   ├── usePincodeValidation.ts # Pincode validation logic
│   │   ├── useSocket.ts          # Socket.io connection hook
│   │   └── useTokenRefresh.ts    # JWT token refresh
│   │
│   ├── store/                    # Redux Toolkit state management
│   │   ├── index.ts              # Store configuration
│   │   ├── api.ts                # RTK Query API setup
│   │   └── slices/               # Redux slices (3 files)
│   │       ├── authSlice.ts      # Authentication state
│   │       ├── cartSlice.ts      # Shopping cart state
│   │       └── uiSlice.ts        # UI state (modals, themes)
│   │
│   ├── utils/                    # Utility functions (15 files)
│   │   ├── addressManager.ts     # Address management utilities
│   │   ├── cartPersistence.ts    # LocalStorage cart persistence
│   │   ├── cloudinary.ts         # Cloudinary image helpers
│   │   ├── deliveryFeeCalculation.ts # Delivery fee calculation
│   │   ├── deliveryFeeCalculator.ts
│   │   ├── geolocation.ts         # Geolocation utilities
│   │   ├── pincodeValidation.ts  # Pincode validation
│   │   ├── pincodeValidator.ts
│   │   ├── priceCalculator.ts    # Price calculation utilities
│   │   ├── productImageMapper.ts # Product image mapping
│   │   ├── razorpay.ts           # Razorpay payment utilities
│   │   ├── sentry.ts             # Error tracking (Sentry)
│   │   ├── cardValidation.ts     # Card validation
│   │   ├── nameUtils.ts          # Name formatting utilities
│   │   └── mockImages.ts         # Mock image data
│   │
│   └── types/                    # TypeScript type definitions
│
├── public/                       # Static assets
│   ├── favicon.ico
│   ├── manifest.json
│   ├── robots.txt
│   └── sitemap.xml
│
├── tests/                        # Test files
│   ├── e2e/
│   │   └── user-journey.spec.ts  # End-to-end tests
│   ├── global-setup.ts
│   └── global-teardown.ts
│
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.node.json            # Node-specific TS config
├── vite.config.ts                # Vite build configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS configuration
├── eslint.config.js              # ESLint configuration
├── playwright.config.ts          # Playwright E2E test config
├── nginx.conf                    # Nginx configuration
├── Dockerfile                    # Production Docker image
├── Dockerfile.dev                # Development Docker image
└── env.template                  # Environment variables template
```

### Frontend Key Features:

- **React 18** with TypeScript
- **Vite** for fast development & building
- **Tailwind CSS** for styling
- **Redux Toolkit** for state management
- **RTK Query** for API calls
- **React Router** for navigation
- **Socket.io Client** for real-time updates
- **Google Maps API** for location services
- **Razorpay** payment integration
- **Framer Motion** for animations
- Accessibility features (WCAG compliant)
- Responsive design (mobile-first)

---

## 🔄 API Routes Overview

### Backend API Endpoints (`/api/*`)

```
/api/auth          - Authentication (login, signup, OAuth)
/api/user          - User management
/api/products      - Product catalog
/api/cart          - Shopping cart operations
/api/orders        - Order management
/api/delivery-fee  - Delivery fee calculation
/api/delivery      - Delivery personnel & tracking
/api/pincode       - Pincode validation
/api/location      - Location tracking
/api/admin         - Admin panel operations
/api/payment       - Payment processing (Razorpay)
/api/webhooks      - Webhook handlers
/api/cloudinary    - Image uploads
/api/otp           - OTP verification
```

---

## 🗄️ Database Models

### MongoDB Collections:

1. **Users** - Customers, Admins, Delivery Boys
2. **Products** - Product catalog with categories
3. **Carts** - Shopping cart items
4. **Orders** - Order management with status tracking
5. **DeliveryBoys** - Delivery personnel profiles
6. **Pincodes** - Service area validation
7. **Payments** - Payment transaction records
8. **Otps** - OTP verification records

---

## 🛠️ Technology Stack

### Backend:

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **Authentication**: JWT, Passport.js, OAuth
- **Payment**: Razorpay
- **Storage**: Cloudinary
- **SMS**: Twilio
- **Email**: Nodemailer
- **Queue**: Bull (Redis)

### Frontend:

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Redux Toolkit
- **Routing**: React Router v6
- **Real-time**: Socket.io Client
- **Maps**: Google Maps API
- **Payment**: Razorpay
- **Testing**: Playwright (E2E)
- **Error Tracking**: Sentry

### DevOps:

- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Nginx
- **CI/CD**: GitHub Actions

---

## 📦 Key Dependencies

### Backend:

- `express` - Web framework
- `mongoose` - MongoDB ODM
- `socket.io` - Real-time communication
- `jsonwebtoken` - JWT authentication
- `razorpay` - Payment gateway
- `cloudinary` - Image storage
- `passport` - Authentication strategies
- `bcryptjs` - Password hashing
- `twilio` - SMS service
- `bull` - Job queue (Redis)

### Frontend:

- `react` & `react-dom` - UI library
- `@reduxjs/toolkit` - State management
- `react-router-dom` - Routing
- `socket.io-client` - Real-time client
- `razorpay` - Payment integration
- `@googlemaps/js-api-loader` - Maps integration
- `framer-motion` - Animations
- `react-hot-toast` - Notifications

---

## 🚀 Development Workflow

1. **Backend Development**:

   ```bash
   cd backend
   npm run dev          # Start with nodemon (watch mode)
   npm run build        # Compile TypeScript
   npm test            # Run tests
   ```

2. **Frontend Development**:

   ```bash
   cd frontend
   npm run dev          # Start Vite dev server
   npm run build        # Production build
   npm test            # E2E tests with Playwright
   ```

3. **Docker Development**:
   ```bash
   docker-compose up -d  # Start all services
   docker-compose logs -f  # View logs
   ```

---

## 📝 Important Files

- **`.cursorignore`** - Files/directories ignored by Cursor IDE indexing
- **`docker-compose.yml`** - Main Docker Compose configuration
- **`env.template`** - Environment variables template
- **`README.md`** - Project documentation
- **`TESTING_GUIDE.md`** - Testing documentation
- **`DEPLOYMENT.md`** - Deployment guide

---

## 🔍 Indexing Configuration

The workspace is configured to index only source code:

- ✅ `backend/src/` - Backend source code
- ✅ `frontend/src/` - Frontend source code
- ❌ `dist/` - Compiled outputs (ignored)
- ❌ `node_modules/` - Dependencies (ignored)

This ensures faster indexing and better code search performance.

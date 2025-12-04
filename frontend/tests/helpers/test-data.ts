// Test data fixtures for frontend E2E tests
export const TEST_USERS = {
  CUSTOMER: {
    email: "customer@test.com",
    password: "password123",
    phone: "919876543210",
    name: "Test Customer",
  },
  ADMIN: {
    email: "admin@test.com", 
    password: "admin123",
    phone: "919999999999",
    name: "Test Admin",
  },
  DELIVERY: {
    email: "delivery@test.com",
    password: "delivery123", 
    phone: "918888888888",
    name: "Test Delivery",
  },
};

export const TEST_PRODUCTS = {
  LAPTOP: {
    name: "Test Laptop",
    price: 50000,
    category: "electronics",
    stock: 10,
  },
  PHONE: {
    name: "Test Smartphone", 
    price: 25000,
    category: "electronics",
    stock: 20,
  },
  HEADPHONES: {
    name: "Test Headphones",
    price: 2000,
    category: "accessories", 
    stock: 50,
  },
};

export const TEST_ADDRESSES = {
  HYDERABAD: {
    street: "123 Test Street",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500001",
    phone: "919876543210",
  },
  BANGALORE: {
    street: "456 Test Avenue", 
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560001",
    phone: "919876543210",
  },
};

export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    VERIFY_OTP: "/api/auth/verify-otp",
    SEND_OTP: "/api/auth/send-otp",
  },
  USER: {
    PROFILE: "/api/user/profile",
    ADDRESSES: "/api/user/addresses",
  },
  PRODUCTS: {
    LIST: "/api/products",
    DETAIL: "/api/products/:id",
    SEARCH: "/api/products/search",
  },
  CART: {
    GET: "/api/cart",
    ADD: "/api/cart/add",
    UPDATE: "/api/cart/update", 
    REMOVE: "/api/cart/remove",
    CLEAR: "/api/cart/clear",
  },
  ORDERS: {
    LIST: "/api/orders",
    CREATE: "/api/orders",
    DETAIL: "/api/orders/:id",
  },
};

export const SELECTORS = {
  // Navigation
  NAV_BAR: "[data-testid='nav-bar']",
  LOGOUT_BTN: "[data-testid='logout-btn']",
  
  // Auth
  LOGIN_FORM: "[data-testid='login-form']",
  REGISTER_FORM: "[data-testid='register-form']",
  EMAIL_INPUT: "[data-testid='email-input']",
  PASSWORD_INPUT: "[data-testid='password-input']",
  PHONE_INPUT: "[data-testid='phone-input']",
  OTP_INPUT: "[data-testid='otp-input']",
  
  // Products
  PRODUCT_LIST: "[data-testid='product-list']",
  PRODUCT_CARD: "[data-testid='product-card']",
  PRODUCT_NAME: "[data-testid='product-name']",
  PRODUCT_PRICE: "[data-testid='product-price']",
  ADD_TO_CART_BTN: "[data-testid='add-to-cart-btn']",
  
  // Cart
  CART_ICON: "[data-testid='cart-icon']",
  CART_DRAWER: "[data-testid='cart-drawer']",
  CART_ITEMS: "[data-testid='cart-items']",
  CART_TOTAL: "[data-testid='cart-total']",
  CHECKOUT_BTN: "[data-testid='checkout-btn']",
  
  // Checkout
  CHECKOUT_FORM: "[data-testid='checkout-form']",
  ADDRESS_FORM: "[data-testid='address-form']",
  PAYMENT_FORM: "[data-testid='payment-form']",
  PLACE_ORDER_BTN: "[data-testid='place-order-btn']",
  
  // Orders
  ORDER_LIST: "[data-testid='order-list']",
  ORDER_CARD: "[data-testid='order-card']",
  ORDER_STATUS: "[data-testid='order-status']",
  
  // Loading & Error states
  LOADING_SPINNER: "[data-testid='loading-spinner']",
  ERROR_MESSAGE: "[data-testid='error-message']",
  SUCCESS_MESSAGE: "[data-testid='success-message']",
};

export const MOCK_RESPONSES = {
  AUTH: {
    LOGIN_SUCCESS: {
      success: true,
      user: TEST_USERS.CUSTOMER,
      token: "mock-jwt-token",
    },
    REGISTER_SUCCESS: {
      success: true,
      message: "User registered successfully",
      user: TEST_USERS.CUSTOMER,
    },
  },
  PRODUCTS: {
    LIST_SUCCESS: {
      success: true,
      products: Object.values(TEST_PRODUCTS),
      pagination: {
        page: 1,
        limit: 10,
        total: 3,
      },
    },
  },
  CART: {
    GET_SUCCESS: {
      success: true,
      cart: {
        items: [],
        totalAmount: 0,
        itemCount: 0,
      },
    },
  },
};

import { test as base, expect, type Page } from "@playwright/test";

// Define test fixtures
export const test = base.extend({
  // Authenticated user page
  customerPage: async ({ page }: { page: Page }, use) => {
    // Login as test customer
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "password123");
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard");
    await use(page);
  },
  
  // Admin page
  adminPage: async ({ page }: { page: Page }, use) => {
    // Login as admin
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "admin@cpsstore.com");
    await page.fill('[data-testid="password-input"]', "admin123");
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect to admin dashboard
    await page.waitForURL("**/admin");
    await use(page);
  },
  
  // Delivery partner page
  deliveryPage: async ({ page }: { page: Page }, use) => {
    // Login as delivery partner
    await page.goto("/delivery/login");
    await page.fill('[data-testid="phone-input"]', "9876543212");
    await page.fill('[data-testid="password-input"]', "driver123");
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect to delivery dashboard
    await page.waitForURL("**/delivery/dashboard");
    await use(page);
  },
});

// Re-export expect
export { expect };

// Helper functions
export async function signupUser(page: Page, userData: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  await page.goto("/signup");
  await page.fill('[data-testid="name-input"]', userData.name);
  await page.fill('[data-testid="email-input"]', userData.email);
  await page.fill('[data-testid="phone-input"]', userData.phone);
  await page.fill('[data-testid="password-input"]', userData.password);
  await page.fill('[data-testid="confirm-password-input"]', userData.password);
  await page.click('[data-testid="signup-button"]');
  
  // Wait for OTP verification
  await page.waitForSelector('[data-testid="otp-input"]');
  
  // In mock mode, OTP is "123456"
  await page.fill('[data-testid="otp-input"]', "123456");
  await page.click('[data-testid="verify-otp-button"]');
  
  // Wait for successful signup
  await page.waitForURL("**/dashboard");
}

export async function loginUser(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  
  // Wait for redirect based on user role
  await page.waitForURL("**/dashboard");
}

export async function addProductToCart(page: Page, productName?: string) {
  await page.goto("/products");
  
  // Find a product and add to cart
  const productCard = page.locator('[data-testid="product-card"]').first();
  await productCard.locator('[data-testid="add-to-cart-button"]').click();
  
  // Wait for cart update
  await expect(page.locator('[data-testid="cart-count"]')).toContainText("1");
}

export async function proceedToCheckout(page: Page) {
  // Go to cart
  await page.goto("/cart");
  
  // Proceed to checkout
  await page.click('[data-testid="checkout-button"]');
  
  // Wait for checkout page
  await page.waitForURL("**/checkout");
}

export async function fillCheckoutForm(page: Page, addressData: {
  street: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}) {
  // Fill delivery address
  await page.fill('[data-testid="street-input"]', addressData.street);
  await page.fill('[data-testid="city-input"]', addressData.city);
  await page.fill('[data-testid="state-input"]', addressData.state);
  await page.fill('[data-testid="pincode-input"]', addressData.pincode);
  await page.fill('[data-testid="phone-input"]', addressData.phone);
  
  // Select payment method (COD for simplicity)
  await page.click('[data-testid="payment-method-cod"]');
  
  // Place order
  await page.click('[data-testid="place-order-button"]');
  
  // Wait for order confirmation
  await page.waitForSelector('[data-testid="order-success"]');
}

export async function createAdminProduct(page: Page, productData: {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
}) {
  await page.goto("/admin/products");
  await page.click('[data-testid="add-product-button"]');
  
  // Fill product form
  await page.fill('[data-testid="product-name"]', productData.name);
  await page.fill('[data-testid="product-description"]', productData.description);
  await page.fill('[data-testid="product-price"]', productData.price.toString());
  await page.fill('[data-testid="product-category"]', productData.category);
  await page.fill('[data-testid="product-stock"]', productData.stock.toString());
  
  // Submit form
  await page.click('[data-testid="save-product-button"]');
  
  // Wait for success message
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
}

export async function verifyOTP(page: Page, otp: string = "123456") {
  await page.fill('[data-testid="otp-input"]', otp);
  await page.click('[data-testid="verify-otp-button"]');
  
  // Wait for OTP verification
  await page.waitForSelector('[data-testid="otp-success"]', { timeout: 10000 });
}

export async function waitForToast(page: Page, message: string) {
  await expect(page.locator(`[data-testid="toast"]:has-text("${message}")`)).toBeVisible();
}

export async function mockRazorpay(page: Page) {
  // Mock Razorpay checkout
  await page.addInitScript(() => {
    (window as any).Razorpay = function(options: any) {
      return {
        open: () => {
          // Simulate successful payment
          if (options.handler) {
            options.handler({
              razorpay_payment_id: "pay_test123",
              razorpay_order_id: "order_test123",
              razorpay_signature: "test_signature",
            });
          }
        },
        close: () => {},
        on: () => {},
      };
    };
  });
}

export async function mockGoogleMaps(page: Page) {
  // Mock Google Maps API
  await page.addInitScript(() => {
    (window as any).google = {
      maps: {
        Map: class Map {},
        Marker: class Marker {},
        Geocoder: class Geocoder {
          geocode(request: any, callback: any) {
            // Mock geocoding response
            callback([{ geometry: { location: { lat: () => 17.385, lng: () => 78.4867 } } }], "OK");
          }
        },
        places: {
          Autocomplete: class Autocomplete {
            addListener() {}
          },
        },
      },
    };
  });
}

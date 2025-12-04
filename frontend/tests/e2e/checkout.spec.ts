import { test, expect, addProductToCart, proceedToCheckout, fillCheckoutForm, mockRazorpay, type Page } from "../helpers/auth";

test.describe("Checkout Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock APIs
    await page.addInitScript(() => {
      const originalFetch = window.fetch;
      (window as any).fetch = function(url: string, options?: any) {
        if (url.includes("/api/products")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              products: [
                {
                  _id: "product1",
                  name: "Test Product",
                  price: 100,
                  stock: 10,
                  images: ["test.jpg"],
                  category: "electronics",
                },
              ],
              pagination: { page: 1, limit: 10, total: 1 },
            }),
          });
        }
        if (url.includes("/api/pincodes")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              deliveryAvailable: true,
              deliveryCharge: 40,
              estimatedDays: 2,
            }),
          });
        }
        if (url.includes("/api/orders/create")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              message: "Order created successfully",
              order: {
                _id: "order123",
                totalAmount: 140,
                status: "pending",
                paymentMethod: "cod",
              },
            }),
          });
        }
        return originalFetch.call(this, ...arguments as any);
      };
    });
  });

  test("should complete checkout with COD", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Fill checkout form
    await fillCheckoutForm(customerPage, {
      street: "123 Test Street",
      city: "Test City",
      state: "TS",
      pincode: "500001",
      phone: "9876543210",
    });

    // Should show order success
    await expect(customerPage.locator('[data-testid="order-success"]')).toBeVisible();
    await expect(customerPage.locator('[data-testid="order-id"]')).toContainText("order123");
  });

  test("should complete checkout with online payment", async ({ customerPage }) => {
    // Mock Razorpay
    await mockRazorpay(customerPage);

    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Fill checkout form with online payment
    await customerPage.fill('[data-testid="street-input"]', "123 Test Street");
    await customerPage.fill('[data-testid="city-input"]', "Test City");
    await customerPage.fill('[data-testid="state-input"]', "TS");
    await customerPage.fill('[data-testid="pincode-input"]', "500001");
    await customerPage.fill('[data-testid="phone-input"]', "9876543210');

    // Select online payment
    await customerPage.click('[data-testid="payment-method-online"]');

    // Place order
    await customerPage.click('[data-testid="place-order-button"]');

    // Should show Razorpay payment (mocked)
    await expect(customerPage.locator('[data-testid="order-success"]')).toBeVisible();
  });

  test("should validate delivery address", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Try to submit empty form
    await customerPage.click('[data-testid="place-order-button"]');

    // Should show validation errors
    await expect(customerPage.locator('[data-testid="street-error"]')).toBeVisible();
    await expect(customerPage.locator('[data-testid="city-error"]')).toBeVisible();
    await expect(customerPage.locator('[data-testid="pincode-error"]')).toBeVisible();
  });

  test("should check pincode serviceability", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Enter non-serviceable pincode
    await customerPage.fill('[data-testid="pincode-input"]', "999999");
    await customerPage.blur('[data-testid="pincode-input"]');

    // Should show non-serviceable message
    await expect(customerPage.locator('[data-testid="non-serviceable-error"]')).toBeVisible();
  });

  test("should show order summary correctly", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Should show order summary
    await expect(customerPage.locator('[data-testid="order-summary"]')).toBeVisible();
    await expect(customerPage.locator('[data-testid="summary-items"]')).toContainText("Test Product");
    await expect(customerPage.locator('[data-testid="summary-subtotal"]')).toContainText("100");
    await expect(customerPage.locator('[data-testid="summary-delivery"]')).toContainText("40");
    await expect(customerPage.locator('[data-testid="summary-total"]')).toContainText("140");
  });

  test("should handle multiple items in checkout", async ({ customerPage }) => {
    // Add multiple products
    await customerPage.goto("/products");
    await customerPage.locator('[data-testid="product-card"]').nth(0).hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').nth(0).click();
    await customerPage.locator('[data-testid="product-card"]').nth(1).hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').nth(1).click();

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Should show multiple items in summary
    await expect(customerPage.locator('[data-testid="summary-item"]')).toHaveCount(2);
  });

  test("should use saved address", async ({ customerPage }) => {
    // Mock saved addresses
    await customerPage.addInitScript(() => {
      const originalFetch = window.fetch;
      (window as any).fetch = function(url: string, options?: any) {
        if (url.includes("/api/addresses")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              addresses: [
                {
                  _id: "address1",
                  street: "456 Saved Street",
                  city: "Saved City",
                  state: "TS",
                  pincode: "500001",
                  phone: "9876543210",
                  isDefault: true,
                },
              ],
            }),
          });
        }
        return originalFetch.call(this, ...arguments as any);
      };
    });

    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Should show saved addresses
    await expect(customerPage.locator('[data-testid="saved-address"]')).toBeVisible();

    // Select saved address
    await customerPage.click('[data-testid="select-saved-address"]');

    // Should auto-fill form
    await expect(customerPage.locator('[data-testid="street-input"]')).toHaveValue("456 Saved Street");
    await expect(customerPage.locator('[data-testid="city-input"]')).toHaveValue("Saved City");
  });

  test("should add new address during checkout", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Click add new address
    await customerPage.click('[data-testid="add-new-address"]');

    // Fill new address form
    await customerPage.fill('[data-testid="new-street-input"]', "789 New Street");
    await customerPage.fill('[data-testid="new-city-input"]', "New City");
    await customerPage.fill('[data-testid="new-state-input"]', "TS");
    await customerPage.fill('[data-testid="new-pincode-input"]', "500001");
    await customerPage.fill('[data-testid="new-phone-input"]', "9876543210");

    // Save address
    await customerPage.click('[data-testid="save-new-address"]');

    // Should use new address
    await expect(customerPage.locator('[data-testid="street-input"]')).toHaveValue("789 New Street");
  });

  test("should handle payment method selection", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Should default to COD
    await expect(customerPage.locator('[data-testid="payment-method-cod"]')).toBeChecked();

    // Switch to online payment
    await customerPage.click('[data-testid="payment-method-online"]');
    await expect(customerPage.locator('[data-testid="payment-method-online"]')).toBeChecked();

    // Should show payment details
    await expect(customerPage.locator('[data-testid="payment-details"]')).toBeVisible();
  });

  test("should show order confirmation with details", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Fill and submit form
    await fillCheckoutForm(customerPage, {
      street: "123 Test Street",
      city: "Test City",
      state: "TS",
      pincode: "500001",
      phone: "9876543210",
    });

    // Should show order confirmation
    await expect(customerPage.locator('[data-testid="order-confirmation"]')).toBeVisible();
    await expect(customerPage.locator('[data-testid="order-id"]')).toBeVisible();
    await expect(customerPage.locator('[data-testid="order-status"]')).toContainText("pending");
    await expect(customerPage.locator('[data-testid="delivery-address"]')).toContainText("123 Test Street");
  });

  test("should handle checkout with empty cart", async ({ customerPage }) => {
    // Try to go to checkout with empty cart
    await customerPage.goto("/checkout");

    // Should redirect to cart
    await expect(customerPage).toHaveURL("**/cart");
    await expect(customerPage.locator('[data-testid="empty-cart-message"]')).toBeVisible();
  });

  test("should handle checkout for guest user", async ({ page }) => {
    // Add product as guest
    await page.goto("/products");
    await page.locator('[data-testid="product-card"]').first().hover();
    await page.locator('[data-testid="add-to-cart-button"]').first().click();

    // Try to checkout
    await page.goto("/checkout");

    // Should redirect to login
    await expect(page).toHaveURL("**/login");
  });

  test("should handle order creation failure", async ({ customerPage }) => {
    // Mock order creation failure
    await customerPage.addInitScript(() => {
      const originalFetch = window.fetch;
      (window as any).fetch = function(url: string, options?: any) {
        if (url.includes("/api/orders/create")) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ message: "Failed to create order" }),
          });
        }
        return originalFetch.call(this, ...arguments as any);
      };
    });

    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Fill and submit form
    await fillCheckoutForm(customerPage, {
      street: "123 Test Street",
      city: "Test City",
      state: "TS",
      pincode: "500001",
      phone: "9876543210",
    });

    // Should show error message
    await expect(customerPage.locator('[data-testid="order-error"]')).toBeVisible();
  });

  test("should show estimated delivery date", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Enter serviceable pincode
    await customerPage.fill('[data-testid="pincode-input"]', "500001");
    await customerPage.blur('[data-testid="pincode-input"]');

    // Should show estimated delivery
    await expect(customerPage.locator('[data-testid="estimated-delivery"]')).toBeVisible();
  });

  test("should handle checkout with discount code", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Proceed to checkout
    await proceedToCheckout(customerPage);

    // Apply discount code
    await customerPage.click('[data-testid="apply-discount"]');
    await customerPage.fill('[data-testid="discount-code"]', "SAVE10");
    await customerPage.click('[data-testid="apply-button"]');

    // Should show discount applied
    await expect(customerPage.locator('[data-testid="discount-applied"]')).toBeVisible();
    await expect(customerPage.locator('[data-testid="discount-amount"]')).toBeVisible();
  });
});

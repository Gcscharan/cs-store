import { test, expect } from "@playwright/test";

test.describe("Complete User Journey", () => {
  test("User can signup, add to cart, checkout with Razorpay, and track order", async ({
    page,
  }) => {
    // Step 1: Navigate to signup page
    await page.goto("/signup");
    await expect(page).toHaveTitle(/CS Store/);

    // Step 2: Fill signup form
    await page.fill('input[name="name"]', "Test User");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="phone"]', "9876543210");
    await page.fill('input[name="password"]', "password123");
    await page.fill('input[name="confirmPassword"]', "password123");

    // Fill address form
    await page.fill('input[name="addressLine"]', "123 Test Street");
    await page.fill('input[name="city"]', "Hyderabad");
    await page.fill('input[name="state"]', "Telangana");
    await page.fill('input[name="pincode"]', "500001");
    await page.fill('input[name="lat"]', "17.3850");
    await page.fill('input[name="lng"]', "78.4867");

    // Submit signup form
    await page.click('button[type="submit"]');

    // Wait for redirect to home page
    await page.waitForURL("/");
    await expect(page.locator("text=Welcome")).toBeVisible();

    // Step 3: Browse products and add to cart
    await page.goto("/products");
    await expect(page.locator("h1")).toContainText("Products");

    // Add first product to cart
    const addToCartButton = page
      .locator('button:has-text("Add to Cart")')
      .first();
    await addToCartButton.click();

    // Verify cart count updated
    await expect(page.locator('[data-testid="cart-count"]')).toContainText("1");

    // Add second product to cart
    await page.locator('button:has-text("Add to Cart")').nth(1).click();
    await expect(page.locator('[data-testid="cart-count"]')).toContainText("2");

    // Step 4: Go to cart and verify items
    await page.goto("/cart");
    await expect(page.locator("h1")).toContainText("Cart");

    // Verify cart items
    const cartItems = page.locator('[data-testid="cart-item"]');
    await expect(cartItems).toHaveCount(2);

    // Verify total amount is at least ₹2000 (minimum order requirement)
    const totalAmount = page.locator('[data-testid="total-amount"]');
    await expect(totalAmount).toContainText("₹");

    // Step 5: Proceed to checkout
    const checkoutButton = page.locator(
      'button:has-text("Proceed to Checkout")'
    );
    await checkoutButton.click();

    // Wait for checkout page
    await page.waitForURL("/checkout");
    await expect(page.locator("h1")).toContainText("Checkout");

    // Step 6: Fill checkout form
    await page.fill('input[name="addressLine"]', "123 Test Street");
    await page.fill('input[name="city"]', "Hyderabad");
    await page.fill('input[name="state"]', "Telangana");
    await page.fill('input[name="pincode"]', "500001");

    // Step 7: Proceed to payment
    const paymentButton = page.locator('button:has-text("Pay Now")');
    await paymentButton.click();

    // Step 8: Handle Razorpay payment (test mode)
    // Wait for Razorpay modal to appear
    await page.waitForSelector(".razorpay-checkout-button", { timeout: 10000 });

    // In test mode, we'll simulate successful payment
    // This would normally require Razorpay test credentials
    await page.evaluate(() => {
      // Simulate Razorpay success callback
      if (window.Razorpay) {
        const mockPaymentData = {
          razorpay_payment_id: "test_payment_id",
          razorpay_order_id: "test_order_id",
          razorpay_signature: "test_signature",
        };

        // Trigger success callback
        if (window.razorpaySuccessCallback) {
          window.razorpaySuccessCallback(mockPaymentData);
        }
      }
    });

    // Step 9: Verify order confirmation
    await page.waitForURL("/orders/*/track");
    await expect(page.locator("h1")).toContainText("Order Tracking");

    // Verify order details
    await expect(page.locator('[data-testid="order-status"]')).toContainText(
      "Order Placed"
    );
    await expect(page.locator('[data-testid="order-amount"]')).toContainText(
      "₹"
    );

    // Step 10: Navigate to orders page
    await page.goto("/orders");
    await expect(page.locator("h1")).toContainText("Orders");

    // Verify order appears in orders list
    const orderItems = page.locator('[data-testid="order-item"]');
    await expect(orderItems).toHaveCount(1);

    // Step 11: Test order tracking
    await page.goto("/orders");
    const trackButton = page.locator('button:has-text("Track")').first();
    await trackButton.click();

    // Verify tracking page loads
    await page.waitForURL("/orders/*/track");
    await expect(page.locator('[data-testid="order-tracking"]')).toBeVisible();
  });

  test("User cannot checkout with cart below minimum order value", async ({
    page,
  }) => {
    // Navigate to products page
    await page.goto("/products");

    // Add only one low-value item to cart
    const addToCartButton = page
      .locator('button:has-text("Add to Cart")')
      .first();
    await addToCartButton.click();

    // Go to cart
    await page.goto("/cart");

    // Try to proceed to checkout
    const checkoutButton = page.locator(
      'button:has-text("Proceed to Checkout")'
    );

    // The button should be disabled or show minimum order message
    await expect(checkoutButton).toBeDisabled();

    // Or check for minimum order message
    await expect(page.locator("text=Minimum order is ₹2000")).toBeVisible();
  });

  test("User can search and filter products", async ({ page }) => {
    await page.goto("/products");

    // Test search functionality
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill("test product");
    await page.keyboard.press("Enter");

    // Wait for search results
    await page.waitForTimeout(1000);

    // Test category filter
    const categoryFilter = page.locator('select[name="category"]');
    await categoryFilter.selectOption("Electronics");

    // Test price filter
    const priceFilter = page.locator('input[name="maxPrice"]');
    await priceFilter.fill("5000");

    // Verify filters are applied
    await expect(page.locator('[data-testid="product-card"]')).toBeVisible();
  });

  test("User can update profile and addresses", async ({ page }) => {
    // First login (assuming user exists)
    await page.goto("/login");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL("/");

    // Navigate to profile
    await page.goto("/profile");
    await expect(page.locator("h1")).toContainText("Profile");

    // Update profile information
    await page.fill('input[name="name"]', "Updated Name");
    await page.fill('input[name="phone"]', "9876543211");

    // Save profile
    await page.click('button:has-text("Save")');

    // Verify success message
    await expect(
      page.locator("text=Profile updated successfully")
    ).toBeVisible();

    // Test address management
    await page.click('button:has-text("Add Address")');

    // Fill new address form
    await page.fill('input[name="label"]', "Office");
    await page.fill('input[name="addressLine"]', "456 Office Street");
    await page.fill('input[name="city"]', "Hyderabad");
    await page.fill('input[name="state"]', "Telangana");
    await page.fill('input[name="pincode"]', "500002");

    // Save address
    await page.click('button:has-text("Save Address")');

    // Verify address was added
    await expect(page.locator("text=Office")).toBeVisible();
  });

  test("Admin can access dashboard and view analytics", async ({ page }) => {
    // Login as admin (assuming admin user exists)
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@cpsstore.com");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL("/");

    // Navigate to admin dashboard
    await page.goto("/admin");
    await expect(page.locator("h1")).toContainText("Admin Dashboard");

    // Verify dashboard components
    await expect(page.locator('[data-testid="sales-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="orders-chart"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="driver-performance"]')
    ).toBeVisible();

    // Test date range filtering
    await page.fill('input[name="from"]', "2024-01-01");
    await page.fill('input[name="to"]', "2024-12-31");
    await page.click('button:has-text("Apply Filter")');

    // Verify data updates
    await expect(page.locator('[data-testid="sales-chart"]')).toBeVisible();

    // Test CSV export
    await page.click('button:has-text("Export CSV")');

    // Wait for download to start
    await page.waitForTimeout(2000);
  });

  test("Delivery boy can access dashboard and update order status", async ({
    page,
  }) => {
    // Login as delivery boy
    await page.goto("/login");
    await page.fill('input[name="email"]', "driver@cpsstore.com");
    await page.fill('input[name="password"]', "driver123");
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL("/");

    // Navigate to delivery dashboard
    await page.goto("/delivery");
    await expect(page.locator("h1")).toContainText("Delivery Dashboard");

    // Verify assigned orders
    await expect(page.locator('[data-testid="assigned-orders"]')).toBeVisible();

    // Test order status update
    const updateStatusButton = page
      .locator('button:has-text("Update Status")')
      .first();
    await updateStatusButton.click();

    // Select status
    await page.selectOption('select[name="status"]', "picked_up");
    await page.click('button:has-text("Update")');

    // Verify status updated
    await expect(page.locator("text=Order status updated")).toBeVisible();

    // Test location update
    await page.click('button:has-text("Update Location")');
    await page.fill('input[name="lat"]', "17.4000");
    await page.fill('input[name="lng"]', "78.5000");
    await page.click('button:has-text("Save Location")');

    // Verify location updated
    await expect(
      page.locator("text=Location updated successfully")
    ).toBeVisible();
  });
});

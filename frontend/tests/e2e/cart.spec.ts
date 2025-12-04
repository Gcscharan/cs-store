import { test, expect, addProductToCart, type Page } from "../helpers/auth";

test.describe("Shopping Cart", () => {
  test.beforeEach(async ({ page }) => {
    // Mock product API
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
                {
                  _id: "product2",
                  name: "Another Product",
                  price: 200,
                  stock: 5,
                  images: ["test2.jpg"],
                  category: "clothing",
                },
              ],
              pagination: { page: 1, limit: 10, total: 2 },
            }),
          });
        }
        return originalFetch.call(this, ...arguments as any);
      };
    });
  });

  test("should add product to cart", async ({ customerPage }) => {
    await customerPage.goto("/products");

    // Find and click add to cart button
    await customerPage.locator('[data-testid="product-card"]').first().hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').first().click();

    // Should show success message
    await expect(customerPage.locator('[data-testid="cart-success-toast"]')).toBeVisible();

    // Cart count should update
    await expect(customerPage.locator('[data-testid="cart-count"]')).toContainText("1");
  });

  test("should add multiple products to cart", async ({ customerPage }) => {
    await customerPage.goto("/products");

    // Add first product
    await customerPage.locator('[data-testid="product-card"]').nth(0).hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').nth(0).click();

    // Add second product
    await customerPage.locator('[data-testid="product-card"]').nth(1).hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').nth(1).click();

    // Cart count should be 2
    await expect(customerPage.locator('[data-testid="cart-count"]')).toContainText("2");
  });

  test("should view cart contents", async ({ customerPage }) => {
    // Add product to cart first
    await addProductToCart(customerPage);

    // Go to cart page
    await customerPage.goto("/cart");

    // Should show cart items
    await expect(customerPage.locator('[data-testid="cart-item"]')).toHaveCount(1);
    await expect(customerPage.locator('[data-testid="cart-total"]')).toContainText("100");
  });

  test("should update item quantity in cart", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Go to cart
    await customerPage.goto("/cart");

    // Update quantity
    await customerPage.locator('[data-testid="quantity-increase"]').click();

    // Should update total
    await expect(customerPage.locator('[data-testid="cart-total"]')).toContainText("200");
    await expect(customerPage.locator('[data-testid="item-quantity"]')).toContainText("2");
  });

  test("should decrease item quantity", async ({ customerPage }) => {
    // Add product to cart with quantity 2
    await customerPage.goto("/products");
    await customerPage.locator('[data-testid="product-card"]').first().hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').first().click();
    await customerPage.goto("/cart");
    await customerPage.locator('[data-testid="quantity-increase"]').click();

    // Decrease quantity
    await customerPage.locator('[data-testid="quantity-decrease"]').click();

    // Should update total
    await expect(customerPage.locator('[data-testid="cart-total"]')).toContainText("100");
    await expect(customerPage.locator('[data-testid="item-quantity"]')).toContainText("1");
  });

  test("should remove item from cart", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Go to cart
    await customerPage.goto("/cart");

    // Remove item
    await customerPage.locator('[data-testid="remove-item"]').click();

    // Confirm removal
    await customerPage.locator('[data-testid="confirm-remove"]').click();

    // Cart should be empty
    await expect(customerPage.locator('[data-testid="empty-cart"]')).toBeVisible();
    await expect(customerPage.locator('[data-testid="cart-count"]')).toContainText("0");
  });

  test("should clear entire cart", async ({ customerPage }) => {
    // Add multiple products
    await customerPage.goto("/products");
    await customerPage.locator('[data-testid="product-card"]').nth(0).hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').nth(0).click();
    await customerPage.locator('[data-testid="product-card"]').nth(1).hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').nth(1).click();

    // Go to cart
    await customerPage.goto("/cart");

    // Clear cart
    await customerPage.locator('[data-testid="clear-cart"]').click();

    // Confirm clear
    await customerPage.locator('[data-testid="confirm-clear"]').click();

    // Cart should be empty
    await expect(customerPage.locator('[data-testid="empty-cart"]')).toBeVisible();
  });

  test("should not allow quantity beyond stock", async ({ customerPage }) => {
    // Mock product with limited stock
    await customerPage.addInitScript(() => {
      const originalFetch = window.fetch;
      (window as any).fetch = function(url: string, options?: any) {
        if (url.includes("/api/products")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              products: [
                {
                  _id: "product1",
                  name: "Limited Stock Product",
                  price: 100,
                  stock: 2,
                  images: ["test.jpg"],
                  category: "electronics",
                },
              ],
              pagination: { page: 1, limit: 10, total: 1 },
            }),
          });
        }
        return originalFetch.call(this, ...arguments as any);
      };
    });

    // Add product and increase quantity beyond stock
    await customerPage.goto("/products");
    await customerPage.locator('[data-testid="product-card"]').first().hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').first().click();
    await customerPage.goto("/cart");

    // Try to increase quantity beyond stock
    await customerPage.locator('[data-testid="quantity-increase"]').click(); // 2
    await customerPage.locator('[data-testid="quantity-increase"]').click(); // Should fail at 3

    // Should show error
    await expect(customerPage.locator('[data-testid="stock-error"]')).toBeVisible();
    await expect(customerPage.locator('[data-testid="item-quantity"]')).toContainText("2");
  });

  test("should show cart persistence across page reloads", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Reload page
    await customerPage.reload();

    // Cart should still have the item
    await expect(customerPage.locator('[data-testid="cart-count"]')).toContainText("1");

    // Go to cart
    await customerPage.goto("/cart");
    await expect(customerPage.locator('[data-testid="cart-item"]')).toHaveCount(1);
  });

  test("should handle cart for guest users", async ({ page }) => {
    await page.goto("/products");

    // Add product as guest
    await page.locator('[data-testid="product-card"]').first().hover();
    await page.locator('[data-testid="add-to-cart-button"]').first().click();

    // Should show item in cart
    await page.goto("/cart");
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);

    // Should prompt login when trying to checkout
    await page.locator('[data-testid="checkout-button"]').click();
    await expect(page).toHaveURL("**/login");
  });

  test("should merge guest cart with user cart on login", async ({ page }) => {
    // Add items as guest
    await page.goto("/products");
    await page.locator('[data-testid="product-card"]').nth(0).hover();
    await page.locator('[data-testid="add-to-cart-button"]').nth(0).click();
    await page.locator('[data-testid="product-card"]').nth(1).hover();
    await page.locator('[data-testid="add-to-cart-button"]').nth(1).click();

    // Login
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "password123");
    await page.click('[data-testid="login-button"]');

    // Should have merged cart
    await page.goto("/cart");
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(2);
  });

  test("should show out of stock products as disabled", async ({ page }) => {
    // Mock out of stock product
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
                  name: "Out of Stock Product",
                  price: 100,
                  stock: 0,
                  images: ["test.jpg"],
                  category: "electronics",
                },
              ],
              pagination: { page: 1, limit: 10, total: 1 },
            }),
          });
        }
        return originalFetch.call(this, ...arguments as any);
      };
    });

    await page.goto("/products");

    // Should show out of stock badge
    await expect(page.locator('[data-testid="out-of-stock-badge"]')).toBeVisible();

    // Add to cart should be disabled
    const addToCartButton = page.locator('[data-testid="add-to-cart-button"]').first();
    await expect(addToCartButton).toBeDisabled();
  });

  test("should calculate cart totals correctly", async ({ customerPage }) => {
    // Add multiple products with different prices
    await customerPage.goto("/products");
    await customerPage.locator('[data-testid="product-card"]').nth(0).hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').nth(0).click();
    await customerPage.locator('[data-testid="product-card"]').nth(1).hover();
    await customerPage.locator('[data-testid="add-to-cart-button"]').nth(1).click();

    // Go to cart and check totals
    await customerPage.goto("/cart");

    // Should show correct subtotal (100 + 200 = 300)
    await expect(customerPage.locator('[data-testid="cart-subtotal"]')).toContainText("300");

    // Should show delivery charges
    await expect(customerPage.locator('[data-testid="delivery-charge"]')).toBeVisible();

    // Should show total
    await expect(customerPage.locator('[data-testid="cart-total"]')).toBeVisible();
  });
});

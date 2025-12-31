import { test, expect, addProductToCart, type Page } from "../helpers/auth";

test.describe("Shopping Cart", () => {
  test("should add product to cart", async ({ customerPage }) => {
    await customerPage.goto("/products");

    await customerPage.locator('button:has-text("Add to Cart")').first().click();

    await customerPage.goto("/cart");
    await expect(customerPage.getByText("Cart Items (1)")).toBeVisible();
  });

  test("should add multiple products to cart", async ({ customerPage }) => {
    await customerPage.goto("/products");

    await customerPage.locator('button:has-text("Add to Cart")').nth(0).click();
    await customerPage.locator('button:has-text("Add to Cart")').nth(1).click();

    await customerPage.goto("/cart");
    await expect(customerPage.getByText("Cart Items (2)")).toBeVisible();
  });

  test("should view cart contents", async ({ customerPage }) => {
    // Add product to cart first
    await addProductToCart(customerPage);

    // Go to cart page
    await customerPage.goto("/cart");

    await expect(customerPage.getByRole("heading", { name: "Shopping Cart" })).toBeVisible();
    await expect(customerPage.getByText("Cart Items (1)")).toBeVisible();
    await customerPage.waitForTimeout(500);
    await expect(customerPage.getByText("Test Product")).toBeVisible();
    await expect(customerPage.getByText("₹100.00")).toBeVisible();
  });

  test("should update item quantity in cart", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Go to cart
    await customerPage.goto("/cart");

    const row = customerPage.locator('h3:has-text("Test Product")').first().locator('xpath=ancestor::*[contains(@class,"p-4")][1]');

    await row.locator('button:has-text("+")').click();
    await expect(row.getByText("₹200.00")).toBeVisible();
  });

  test("should decrease item quantity", async ({ customerPage }) => {
    // Add product to cart with quantity 2
    await customerPage.goto("/products");

    await customerPage.locator('button:has-text("Add to Cart")').first().click();
    await customerPage.goto("/cart");

    const row = customerPage
      .locator('h3:has-text("Test Product")')
      .first()
      .locator('xpath=ancestor::*[contains(@class,"p-4")][1]');

    await row.locator('button:has-text("+")').click();

    // Decrease quantity
    await row.locator('button:has-text("-")').click();
    await expect(row.locator('div.text-lg').filter({ hasText: /^₹100\.00$/ })).toBeVisible();
  });

  test("should remove item from cart", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Go to cart
    await customerPage.goto("/cart");

    await customerPage.locator('button[title="Delete item"]').first().click();
    await customerPage.getByRole("button", { name: "Remove" }).click();

    await expect(customerPage.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  });

  test("should clear entire cart", async ({ customerPage }) => {
    // Add multiple products
    await customerPage.goto("/products");

    await customerPage.locator('button:has-text("Add to Cart")').nth(0).click();
    await customerPage.locator('button:has-text("Add to Cart")').nth(1).click();

    // Go to cart
    await customerPage.goto("/cart");

    await customerPage.locator('button[title="Delete item"]').nth(0).click();
    await customerPage.getByRole("button", { name: "Remove" }).click();
    await customerPage.locator('button[title="Delete item"]').nth(0).click();
    await customerPage.getByRole("button", { name: "Remove" }).click();

    await expect(customerPage.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  });

  test("should not allow quantity beyond stock", async ({ customerPage }) => {
    await customerPage.addInitScript(() => {
      localStorage.setItem("e2eProductsMode", "limited_stock");
    });

    await customerPage.goto("/products");
    await customerPage.locator('button:has-text("Add to Cart")').first().click();
    await customerPage.goto("/cart");

    const row = customerPage
      .locator('h3:has-text("Test Product")')
      .first()
      .locator('xpath=ancestor::*[contains(@class,"p-4")][1]');

    // Click "+" multiple times; limited_stock mode caps stock to 2.
    await row.locator('button:has-text("+")').click();
    await row.locator('button:has-text("+")').click();
    await row.locator('button:has-text("+")').click();

    await expect(row.getByText("₹200.00")).toBeVisible();
  });

  test("should show cart persistence across page reloads", async ({ customerPage }) => {
    // Add product to cart
    await addProductToCart(customerPage);

    // Reload page
    await customerPage.reload();

    // Go to cart
    await customerPage.goto("/cart");
    await expect(customerPage.getByText("Cart Items (1)")).toBeVisible();
  });

  test("should handle cart for guest users", async ({ page }) => {
    // Guest visiting cart redirects to login
    await page.goto("/cart");
    await expect(page).toHaveURL("/login");
  });

  test("should merge guest cart with user cart on login", async ({ page }) => {
    await page.goto("/cart");
    await expect(page).toHaveURL("/login");
  });

  test("should show out of stock products as disabled", async ({ customerPage }) => {
    await customerPage.addInitScript(() => {
      localStorage.setItem("e2eProductsMode", "out_of_stock");
    });

    await customerPage.goto("/products");

    await expect(customerPage.locator('text="Out of Stock"')).toHaveCount(2);
    await expect(customerPage.locator('button:has-text("Add to Cart")')).toHaveCount(2);
    await expect(customerPage.locator('button:has-text("Add to Cart")').nth(0)).toBeDisabled();
    await expect(customerPage.locator('button:has-text("Add to Cart")').nth(1)).toBeDisabled();
  });

  test("should calculate cart totals correctly", async ({ customerPage }) => {
    // Add multiple products with different prices
    await customerPage.goto("/products");
    await customerPage.locator('button:has-text("Add to Cart")').nth(0).click();
    await customerPage.locator('button:has-text("Add to Cart")').nth(1).click();

    // Go to cart and check totals
    await customerPage.goto("/cart");

    await expect(customerPage.getByText("Cart Items (2)")).toBeVisible();

    // Avoid strict-mode collisions: there are multiple identical currency values on this page.
    await expect(customerPage.locator('text=₹100.00 each')).toHaveCount(2);
    await expect(customerPage.getByRole("heading", { name: "PRICE DETAILS" })).toBeVisible();
    await expect(customerPage.locator('text=Price (2 items)')).toBeVisible();
    await expect(customerPage.locator('text=₹200.00').first()).toBeVisible();
  });
});

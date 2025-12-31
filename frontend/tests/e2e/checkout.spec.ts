import { test, expect, addProductToCart, proceedToCheckout } from "../helpers/auth";

test.describe("Checkout Flow", () => {
  test("should complete checkout with COD", async ({ customerPage }) => {
    await addProductToCart(customerPage);
    await proceedToCheckout(customerPage);

    await customerPage.locator('[data-testid="payment-method-cod"]').check();
    await customerPage.locator('[data-testid="cod-place-order-button"]').click();

    await expect(customerPage).toHaveURL(/\/orders/);
    await expect(customerPage.getByRole("heading", { name: "My Orders" })).toBeVisible();
  });

  test("should complete checkout with UPI collect flow", async ({ customerPage }) => {
    await addProductToCart(customerPage);
    await proceedToCheckout(customerPage);

    await customerPage.locator('[data-testid="payment-method-upi"]').check();
    await customerPage.locator('[data-testid="upi-id-input"]').fill("test@upi");
    await customerPage.locator('[data-testid="upi-create-order-button"]').click();

    await expect(customerPage.locator('[data-testid="upi-confirm-button"]')).toBeVisible();
    await customerPage.locator('[data-testid="upi-confirm-button"]').click();

    await expect(customerPage).toHaveURL(/\/orders\//);
  });

  test("should validate UPI ID (VPA) before creating UPI order", async ({ customerPage }) => {
    await addProductToCart(customerPage);
    await proceedToCheckout(customerPage);

    await customerPage.locator('[data-testid="payment-method-upi"]').check();
    await customerPage.locator('[data-testid="upi-id-input"]').fill("invalid");
    await customerPage.locator('[data-testid="upi-create-order-button"]').click();

    // If validation fails, we should not transition into the confirm state
    await expect(customerPage.locator('[data-testid="upi-confirm-button"]')).toHaveCount(0);
  });

  test("should redirect guest user to login when visiting checkout", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should handle order creation failure", async ({ customerPage }) => {
    await customerPage.addInitScript(() => {
      localStorage.setItem("e2eOrdersFail", "true");
    });

    await addProductToCart(customerPage);
    await proceedToCheckout(customerPage);

    await customerPage.locator('[data-testid="payment-method-cod"]').check();
    await customerPage.locator('[data-testid="cod-place-order-button"]').click();

    await expect(customerPage).toHaveURL(/\/checkout/);
  });

  test("should prevent checkout when address has invalid coordinates", async ({ customerPage }) => {
    await customerPage.addInitScript(() => {
      localStorage.setItem("e2eInvalidCoords", "true");
    });

    await addProductToCart(customerPage);

    // With invalid coordinates the app blocks placing an order from the cart itself.
    await customerPage.goto("/cart");
    await expect(
      customerPage.getByRole("button", {
        name: /cannot place order - invalid address/i,
      })
    ).toBeDisabled();
  });

  test("should prevent checkout when pincode is not serviceable", async ({ customerPage }) => {
    await customerPage.addInitScript(() => {
      localStorage.setItem("e2ePincodeDeliverable", "false");
    });

    await addProductToCart(customerPage);
    await proceedToCheckout(customerPage);

    await customerPage.locator('[data-testid="payment-method-cod"]').check();
    await expect(customerPage.locator('[data-testid="cod-place-order-button"]')).toBeDisabled();
  });

  test("should show order summary", async ({ customerPage }) => {
    await addProductToCart(customerPage);
    await proceedToCheckout(customerPage);
    await expect(customerPage.locator('[data-testid="order-summary"]')).toBeVisible();
  });
});

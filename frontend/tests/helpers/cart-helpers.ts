import { Page, expect } from "@playwright/test";
import { TEST_PRODUCTS, SELECTORS, API_ENDPOINTS, MOCK_RESPONSES } from "./test-data";

export class CartHelpers {
  constructor(private page: Page) {}

  async openCart() {
    await this.page.click(SELECTORS.CART_ICON);
    await expect(this.page.locator(SELECTORS.CART_DRAWER)).toBeVisible();
  }

  async closeCart() {
    await this.page.click("[data-testid='close-cart-btn']");
    await expect(this.page.locator(SELECTORS.CART_DRAWER)).not.toBeVisible();
  }

  async addToCart(productName: string) {
    await this.page.click(`[data-testid='add-to-cart-${productName}']`);
    await expect(this.page.locator(SELECTORS.SUCCESS_MESSAGE)).toBeVisible();
  }

  async removeFromCart(productName: string) {
    await this.openCart();
    await this.page.click(`[data-testid='remove-from-cart-${productName}']`);
    await expect(this.page.locator(SELECTORS.SUCCESS_MESSAGE)).toBeVisible();
  }

  async updateQuantity(productName: string, quantity: number) {
    await this.openCart();
    await this.page.fill(`[data-testid='quantity-${productName}']`, quantity.toString());
    await this.page.press(`[data-testid='quantity-${productName}']`, "Enter");
    
    // Wait for update
    await this.page.waitForTimeout(1000);
  }

  async increaseQuantity(productName: string) {
    await this.openCart();
    await this.page.click(`[data-testid='increase-quantity-${productName}']`);
    await this.page.waitForTimeout(1000);
  }

  async decreaseQuantity(productName: string) {
    await this.openCart();
    await this.page.click(`[data-testid='decrease-quantity-${productName}']`);
    await this.page.waitForTimeout(1000);
  }

  async clearCart() {
    await this.openCart();
    await this.page.click("[data-testid='clear-cart-btn']");
    await this.page.click("[data-testid='confirm-clear-cart']");
    await expect(this.page.locator(SELECTORS.SUCCESS_MESSAGE)).toBeVisible();
  }

  async proceedToCheckout() {
    await this.openCart();
    await this.page.click(SELECTORS.CHECKOUT_BTN);
    await expect(this.page.locator(SELECTORS.CHECKOUT_FORM)).toBeVisible();
  }

  async verifyCartItemCount(count: number) {
    const itemCount = this.page.locator("[data-testid='cart-item-count']");
    await expect(itemCount).toHaveText(count.toString());
  }

  async verifyCartTotal(total: number) {
    const cartTotal = this.page.locator(SELECTORS.CART_TOTAL);
    await expect(cartTotal).toContainText(total.toString());
  }

  async verifyItemInCart(productName: string) {
    await this.openCart();
    await expect(this.page.locator(`[data-testid='cart-item-${productName}']`)).toBeVisible();
  }

  async verifyItemNotInCart(productName: string) {
    await this.openCart();
    await expect(this.page.locator(`[data-testid='cart-item-${productName}']`)).not.toBeVisible();
  }

  async verifyCartIsEmpty() {
    await this.openCart();
    await expect(this.page.locator("[data-testid='empty-cart']")).toBeVisible();
  }

  async verifyItemQuantity(productName: string, quantity: number) {
    await this.openCart();
    const quantityElement = this.page.locator(`[data-testid='quantity-${productName}']`);
    await expect(quantityElement).toHaveValue(quantity.toString());
  }

  async verifyItemPrice(productName: string, price: number) {
    await this.openCart();
    const priceElement = this.page.locator(`[data-testid='item-price-${productName}']`);
    await expect(priceElement).toContainText(price.toString());
  }

  async verifyItemSubtotal(productName: string, subtotal: number) {
    await this.openCart();
    const subtotalElement = this.page.locator(`[data-testid='item-subtotal-${productName}']`);
    await expect(subtotalElement).toContainText(subtotal.toString());
  }

  async waitForCartUpdate() {
    await this.page.waitForSelector("[data-testid='cart-updated']", { timeout: 5000 });
  }

  // Mock API responses for cart
  async mockCartAPIs() {
    await this.page.route(API_ENDPOINTS.CART.GET, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESPONSES.CART.GET_SUCCESS),
      });
    });

    await this.page.route(API_ENDPOINTS.CART.ADD, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Item added to cart",
          cart: {
            items: [
              {
                productId: "1",
                name: TEST_PRODUCTS.LAPTOP.name,
                price: TEST_PRODUCTS.LAPTOP.price,
                quantity: 1,
                image: "test-image.jpg",
              },
            ],
            totalAmount: TEST_PRODUCTS.LAPTOP.price,
            itemCount: 1,
          },
        }),
      });
    });

    await this.page.route(API_ENDPOINTS.CART.UPDATE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Cart updated",
          cart: {
            items: [
              {
                productId: "1",
                name: TEST_PRODUCTS.LAPTOP.name,
                price: TEST_PRODUCTS.LAPTOP.price,
                quantity: 2,
                image: "test-image.jpg",
              },
            ],
            totalAmount: TEST_PRODUCTS.LAPTOP.price * 2,
            itemCount: 1,
          },
        }),
      });
    });

    await this.page.route(API_ENDPOINTS.CART.REMOVE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Item removed from cart",
          cart: {
            items: [],
            totalAmount: 0,
            itemCount: 0,
          },
        }),
      });
    });

    await this.page.route(API_ENDPOINTS.CART.CLEAR, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Cart cleared",
          cart: {
            items: [],
            totalAmount: 0,
            itemCount: 0,
          },
        }),
      });
    });
  }

  async mockCartAPIError() {
    await this.page.route(API_ENDPOINTS.CART.GET, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Failed to fetch cart",
        }),
      });
    });
  }

  async verifyCartLoading() {
    await expect(this.page.locator(SELECTORS.LOADING_SPINNER)).toBeVisible();
  }

  async verifyCartError() {
    await expect(this.page.locator(SELECTORS.ERROR_MESSAGE)).toBeVisible();
  }
}

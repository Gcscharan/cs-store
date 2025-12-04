import { Page, expect } from "@playwright/test";
import { TEST_PRODUCTS, SELECTORS, API_ENDPOINTS, MOCK_RESPONSES } from "./test-data";

export class ProductHelpers {
  constructor(private page: Page) {}

  async navigateToProducts() {
    await this.page.goto("/products");
    await expect(this.page.locator(SELECTORS.PRODUCT_LIST)).toBeVisible();
  }

  async searchProducts(query: string) {
    await this.page.fill("[data-testid='search-input']", query);
    await this.page.press("[data-testid='search-input']", "Enter");
    
    // Wait for search results
    await expect(this.page.locator(SELECTORS.PRODUCT_LIST)).toBeVisible();
  }

  async filterByCategory(category: string) {
    await this.page.click(`[data-testid='category-${category}']`);
    await expect(this.page.locator(SELECTORS.PRODUCT_LIST)).toBeVisible();
  }

  async sortByPrice(order: "asc" | "desc") {
    await this.page.click("[data-testid='sort-dropdown']");
    await this.page.click(`[data-testid='sort-price-${order}']`);
    
    // Wait for sorting to apply
    await expect(this.page.locator(SELECTORS.PRODUCT_LIST)).toBeVisible();
  }

  async viewProductDetails(productName: string) {
    await this.page.click(`[data-testid='product-${productName}']`);
    await expect(this.page.locator("[data-testid='product-detail']")).toBeVisible();
  }

  async addToCart(productName: string) {
    await this.page.click(`[data-testid='add-to-cart-${productName}']`);
    
    // Wait for success message or cart update
    await expect(this.page.locator(SELECTORS.SUCCESS_MESSAGE)).toBeVisible();
  }

  async verifyProductVisible(productName: string) {
    await expect(this.page.locator(`[data-testid='product-${productName}']`)).toBeVisible();
  }

  async verifyProductNotVisible(productName: string) {
    await expect(this.page.locator(`[data-testid='product-${productName}']`)).not.toBeVisible();
  }

  async verifyProductDetails(product: typeof TEST_PRODUCTS.LAPTOP) {
    await expect(this.page.locator("[data-testid='product-name']")).toHaveText(product.name);
    await expect(this.page.locator("[data-testid='product-price']")).toContainText(product.price.toString());
    await expect(this.page.locator("[data-testid='product-category']")).toHaveText(product.category);
    await expect(this.page.locator("[data-testid='product-stock']")).toContainText(product.stock.toString());
  }

  async verifyProductCount(count: number) {
    const productCards = this.page.locator(SELECTORS.PRODUCT_CARD);
    await expect(productCards).toHaveCount(count);
  }

  async verifyLoadingState() {
    await expect(this.page.locator(SELECTORS.LOADING_SPINNER)).toBeVisible();
  }

  async verifyErrorState() {
    await expect(this.page.locator(SELECTORS.ERROR_MESSAGE)).toBeVisible();
  }

  // Mock API responses for products
  async mockProductAPIs() {
    await this.page.route(API_ENDPOINTS.PRODUCTS.LIST, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESPONSES.PRODUCTS.LIST_SUCCESS),
      });
    });

    await this.page.route(API_ENDPOINTS.PRODUCTS.SEARCH, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          products: [TEST_PRODUCTS.LAPTOP],
          pagination: { page: 1, limit: 10, total: 1 },
        }),
      });
    });

    await this.page.route(new RegExp(API_ENDPOINTS.PRODUCTS.DETAIL.replace(":id", "\\d+")), async (route) => {
      const productId = route.request().url().split("/").pop();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          product: { ...TEST_PRODUCTS.LAPTOP, _id: productId },
        }),
      });
    });
  }

  async mockProductAPIError() {
    await this.page.route(API_ENDPOINTS.PRODUCTS.LIST, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Failed to fetch products",
        }),
      });
    });
  }

  async waitForProductLoad() {
    await this.page.waitForSelector(SELECTORS.PRODUCT_LIST, { timeout: 10000 });
  }

  async scrollProducts() {
    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
  }

  async clickProductImage(productName: string) {
    await this.page.click(`[data-testid='product-image-${productName}']`);
  }

  async verifyProductImage(productName: string) {
    const imageElement = this.page.locator(`[data-testid='product-image-${productName}']`);
    await expect(imageElement).toBeVisible();
    
    // Verify image has loaded
    const isLoaded = await imageElement.evaluate((img: HTMLImageElement) => img.complete && img.naturalHeight !== 0);
    expect(isLoaded).toBe(true);
  }
}

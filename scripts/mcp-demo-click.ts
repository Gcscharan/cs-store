import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  console.log("Taking screenshot of homepage...");
  await page.screenshot({ path: "mcp-screenshots/demo-homepage.png", fullPage: true });

  // Try to click "Products" link
  const productsLink = page.locator('a[href="/products"]').first();
  const isVisible = await productsLink.isVisible().catch(() => false);
  if (isVisible) {
    console.log("Clicking Products link...");
    await productsLink.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "mcp-screenshots/demo-products.png", fullPage: true });
    console.log("Products page loaded and screenshot saved.");
  } else {
    console.log("Products link not visible, trying text match...");
    const textLink = page.getByText(/Products/i).first();
    if (await textLink.isVisible().catch(() => false)) {
      await textLink.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "mcp-screenshots/demo-products.png", fullPage: true });
    }
  }

  // Click a product card if available
  const productCard = page.locator('[data-testid="product-card"], .product-card, a[href^="/product/"]').first();
  if (await productCard.isVisible().catch(() => false)) {
    console.log("Clicking first product card...");
    await productCard.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "mcp-screenshots/demo-product-detail.png", fullPage: true });
    console.log("Product detail page loaded and screenshot saved.");
  }

  console.log("Done. Closing browser...");
  await browser.close();
})();

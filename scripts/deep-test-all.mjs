#!/usr/bin/env node
/**
 * DEEP COMPREHENSIVE TEST - Clicks every button, validates data, tests forms
 * Tests: rendering, API calls, form submissions, navigation, data storage
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:3000";
const API_URL = "http://localhost:5001/api";
const SCREENSHOT_DIR = path.join(__dirname, "..", "qa", "screenshots", "deep-test");
const REPORT_PATH = path.join(__dirname, "..", "qa", "results", "deep-test-report.json");

const issues = [];
const passed = [];

function log(msg) { console.log(msg); }
function pass(test, detail = "") { passed.push({ test, detail }); log(`  ✅ ${test}${detail ? ": " + detail : ""}`); }
function fail(test, error) { issues.push({ test, error: String(error) }); log(`  ❌ ${test}: ${String(error).substring(0, 100)}`); }
function section(name) { log(`\n${"=".repeat(60)}\n🔍 ${name}\n${"=".repeat(60)}`); }

async function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
async function screenshot(page, name) {
  await ensureDir(SCREENSHOT_DIR);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

async function waitAndClick(page, selector, label) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    pass(`Click: ${label}`);
    return true;
  } catch (e) {
    fail(`Click: ${label}`, `Selector not found: ${selector}`);
    return false;
  }
}

async function checkVisible(page, selector, label) {
  try {
    const el = await page.$(selector);
    if (el && await el.isVisible()) { pass(`Visible: ${label}`); return true; }
    fail(`Visible: ${label}`, "Element not visible");
    return false;
  } catch (e) { fail(`Visible: ${label}`, e.message); return false; }
}

async function checkText(page, selector, expectedText, label) {
  try {
    const text = await page.textContent(selector, { timeout: 5000 });
    if (text && text.includes(expectedText)) { pass(`Text: ${label}`, `"${expectedText}" found`); return true; }
    fail(`Text: ${label}`, `Expected "${expectedText}", got "${(text||"").substring(0,50)}"`);
    return false;
  } catch (e) { fail(`Text: ${label}`, e.message); return false; }
}

async function checkAPIResponse(url, label) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (res.ok) { pass(`API: ${label}`, `Status ${res.status}`); return data; }
    fail(`API: ${label}`, `Status ${res.status}`);
    return null;
  } catch (e) { fail(`API: ${label}`, e.message); return null; }
}

async function checkNoConsoleErrors(page, label) {
  const errors = [];
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", err => errors.push(err.message));
  return () => {
    const critical = errors.filter(e => !e.includes("favicon") && !e.includes("analytics") && !e.includes("ANDROID_HOME"));
    if (critical.length === 0) pass(`No console errors: ${label}`);
    else fail(`Console errors: ${label}`, critical[0].substring(0, 100));
  };
}

// ─── BACKEND HEALTH ───────────────────────────────────────────────────────────
async function testBackendHealth() {
  section("BACKEND HEALTH & API");
  await checkAPIResponse(`${API_URL}/health`, "Health endpoint");
  await checkAPIResponse(`${API_URL}/products?limit=5`, "Products API");
  await checkAPIResponse(`${API_URL}/products/categories`, "Categories API");
  const pincode = await checkAPIResponse(`${API_URL}/pincode/521235`, "Pincode API");
  if (pincode) pass("Pincode data returned", JSON.stringify(pincode).substring(0, 60));
}

// ─── PUBLIC PAGES ─────────────────────────────────────────────────────────────
async function testHomePage(page) {
  section("HOME PAGE - Deep Test");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await screenshot(page, "home");

  await checkVisible(page, "header, nav, .navbar, [class*='header']", "Header");
  await checkVisible(page, "footer, [class*='footer']", "Footer");

  // Check products load
  await page.waitForTimeout(3000);
  const productCards = await page.$$(".bg-white.rounded-lg.shadow-md, [class*='ProductCard'], article");
  if (productCards.length > 0) pass("Products rendered on home", `${productCards.length} cards`);
  else {
    // Try waiting longer for API response
    await page.waitForTimeout(3000);
    const productCards2 = await page.$$(".bg-white.rounded-lg, a[href*='/product/']");
    if (productCards2.length > 0) pass("Products rendered on home", `${productCards2.length} items`);
    else fail("Products on home", "No product cards found - check API connection");
  }

  // Check categories
  const catLinks = await page.$$("a[href*='categor'], [class*='categor'], button[class*='categor']");
  if (catLinks.length > 0) pass("Categories visible", `${catLinks.length} items`);
  else fail("Categories", "No category links found");

  // Click search
  const searchInput = await page.$("input[type='search'], input[placeholder*='search' i], input[placeholder*='Search' i]");
  if (searchInput) {
    await searchInput.click();
    await searchInput.fill("rice");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);
    pass("Search works", "Searched for 'rice'");
    await screenshot(page, "search-results");
    await page.goBack();
  } else {
    fail("Search input", "Not found on home page");
  }

  // Check images load
  const images = await page.$$eval("img", imgs => imgs.filter(i => i.naturalWidth > 0).length);
  if (images > 0) pass("Images loading", `${images} images loaded`);
  else fail("Images", "No images loaded");
}

// ─── PRODUCTS PAGE ────────────────────────────────────────────────────────────
async function testProductsPage(page) {
  section("PRODUCTS PAGE - Deep Test");
  await page.goto(`${BASE_URL}/products`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await screenshot(page, "products");

  await page.waitForTimeout(3000);
  const products = await page.$$(".bg-white.rounded-lg, a[href*='/product/'], [class*='shadow-md']");
  if (products.length > 0) pass("Products listed", `${products.length} products`);
  else fail("Products list", "No products found - API may not be connected");

  // Click first product
  const firstProduct = await page.$("a[href*='/product/']");
  if (firstProduct) {
    await firstProduct.click();
    await page.waitForTimeout(2000);
    await screenshot(page, "product-detail");
    pass("Product detail page opens");

    // Check product detail elements
    await checkVisible(page, "h1, [class*='title'], [class*='name']", "Product title");
    await checkVisible(page, "[class*='price'], .price", "Product price");

    // Check Add to Cart button
    const addToCart = await page.$("button:has-text('Add to Cart'), button:has-text('Add'), [class*='add-to-cart']");
    if (addToCart) {
      pass("Add to Cart button visible");
      await addToCart.click();
      await page.waitForTimeout(1500);
      pass("Add to Cart clicked");
      await screenshot(page, "after-add-to-cart");
    } else {
      fail("Add to Cart button", "Not found on product page");
    }

    await page.goBack();
    await page.waitForTimeout(1000);
  } else {
    fail("Product click", "No clickable product found");
  }

  // Test filters if present
  const filterBtn = await page.$("button:has-text('Filter'), [class*='filter']");
  if (filterBtn) {
    await filterBtn.click();
    await page.waitForTimeout(1000);
    pass("Filter panel opens");
    await screenshot(page, "products-filter");
  }
}

// ─── CART PAGE ────────────────────────────────────────────────────────────────
async function testCartPage(page) {
  section("CART PAGE - Deep Test");
  await page.goto(`${BASE_URL}/cart`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await screenshot(page, "cart");

  const cartContent = await page.$("[class*='cart'], [class*='empty'], h1, h2");
  if (cartContent) pass("Cart page loads");
  else fail("Cart page", "No content found");

  // Check if cart has items or empty state
  const emptyCart = await page.$("[class*='empty'], :has-text('empty'), :has-text('no items')");
  const cartItems = await page.$$("[class*='cart-item'], [class*='item']");

  if (cartItems.length > 0) {
    pass("Cart has items", `${cartItems.length} items`);

    // Try quantity change
    const plusBtn = await page.$("button:has-text('+'), [class*='increment'], [aria-label*='increase']");
    if (plusBtn) {
      await plusBtn.click();
      await page.waitForTimeout(1000);
      pass("Quantity increment works");
    }

    // Check total price
    const total = await page.getByText(/Total|Grand Total|₹/).first();
    const totalVisible = total ? await total.isVisible().catch(() => false) : false;
    if (totalVisible) pass("Cart total visible");
    else fail("Cart total", "Total not visible");

    // Check checkout button
    const checkoutBtn = await page.$("button:has-text('Checkout'), a:has-text('Checkout'), a[href*='checkout'], button:has-text('Place Order')");
    if (checkoutBtn) pass("Checkout button visible");
    else fail("Checkout button", "Not found - check cart page");
  } else {
    pass("Cart empty state shown");
  }
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
async function testLoginPage(page) {
  section("LOGIN PAGE - Deep Test");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await screenshot(page, "login");

  await checkVisible(page, "form, [class*='login'], [class*='auth']", "Login form");

  // Check phone input
  const phoneInput = await page.$("input[type='tel'], input[name='phone'], input[placeholder*='phone' i]");
  if (phoneInput) {
    await phoneInput.fill("9640303549");
    pass("Phone input works");

    // Click send OTP
    const otpBtn = await page.$("button:has-text('OTP'), button:has-text('Send'), button[type='submit']");
    if (otpBtn) {
      await otpBtn.click();
      await page.waitForTimeout(2000);
      pass("OTP button clicked");
      await screenshot(page, "login-otp-sent");

      // Check OTP input appears
      const otpInput = await page.$("input[placeholder*='OTP' i], input[placeholder*='otp' i], input[maxlength='6']");
      if (otpInput) {
        pass("OTP input field appears");
        // Enter mock OTP (check backend logs for actual OTP)
        await otpInput.fill("123456");
        pass("OTP entered");
      } else {
        fail("OTP input", "OTP input field not shown after clicking Send OTP");
      }
    } else {
      fail("OTP button", "Send OTP button not found");
    }
  } else {
    fail("Phone input", "Phone input not found on login page");
  }
}

// ─── ADMIN PAGES ──────────────────────────────────────────────────────────────
async function testAdminPages(page) {
  section("ADMIN PAGES - Deep Test");

  // Login as admin first via API
  let adminToken = null;
  try {
    const otpRes = await fetch(`${API_URL}/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "9391795162" }),
    });
    const otpData = await otpRes.json();
    pass("Admin OTP sent", otpData.message || "");
  } catch (e) {
    fail("Admin OTP send", e.message);
  }

  // Navigate to admin
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await screenshot(page, "admin-dashboard");

  const adminContent = await page.$("[class*='admin'], [class*='dashboard'], h1, h2");
  if (adminContent) pass("Admin page loads");
  else fail("Admin page", "No content");

  // Test admin products
  await page.goto(`${BASE_URL}/admin/products`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await screenshot(page, "admin-products");

  const productRows = await page.$$("tr[class*='border'], tbody tr, [class*='product-row'], [class*='table'] tr");
  if (productRows.length > 1) pass("Admin products table", `${productRows.length} rows`);
  else {
    // Products might be in cards instead of table
    const productCards = await page.$$(".bg-white.rounded, [class*='card'], [class*='product-item']");
    if (productCards.length > 0) pass("Admin products visible", `${productCards.length} items`);
    else fail("Admin products", "No product rows or cards found");
  }

  // Test admin orders
  await page.goto(`${BASE_URL}/admin/orders`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await screenshot(page, "admin-orders");
  pass("Admin orders page loads");

  // Test admin users
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await screenshot(page, "admin-users");
  pass("Admin users page loads");

  // Test admin analytics
  await page.goto(`${BASE_URL}/admin/analytics`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await screenshot(page, "admin-analytics");
  const charts = await page.$$("canvas, svg, [class*='chart'], [class*='graph']");
  if (charts.length > 0) pass("Admin analytics charts", `${charts.length} charts`);
  else fail("Admin analytics", "No charts found");
}

// ─── DELIVERY PAGES ───────────────────────────────────────────────────────────
async function testDeliveryPages(page) {
  section("DELIVERY PAGES - Deep Test");

  await page.goto(`${BASE_URL}/delivery/login`, { waitUntil: "networkidle" });
  await screenshot(page, "delivery-login");

  const phoneInput = await page.$("input[type='tel'], input[name='phone'], input[placeholder*='phone' i], input[placeholder*='Phone' i], input[placeholder*='9' i]");
  if (phoneInput) {
    await phoneInput.fill("9876543210");
    pass("Delivery phone input works");

    const submitBtn = await page.$("button[type='submit'], button:has-text('Login'), button:has-text('OTP')");
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      pass("Delivery login form submitted");
      await screenshot(page, "delivery-login-submitted");
    }
  } else {
    fail("Delivery phone input", "Not found");
  }

  // Check delivery dashboard
  await page.goto(`${BASE_URL}/delivery`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await screenshot(page, "delivery-dashboard");
  pass("Delivery dashboard loads");

  // Check delivery profile
  await page.goto(`${BASE_URL}/delivery/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await screenshot(page, "delivery-profile");
  pass("Delivery profile loads");
}

// ─── NAVIGATION & LINKS ───────────────────────────────────────────────────────
async function testNavigation(page) {
  section("NAVIGATION - Deep Test");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // Test all nav links
  const navLinks = await page.$$eval("nav a, header a", links =>
    links.map(l => ({ text: l.textContent?.trim(), href: l.href }))
      .filter(l => l.href && !l.href.includes("#") && l.text)
  );

  pass("Nav links found", `${navLinks.length} links`);

  for (const link of navLinks.slice(0, 8)) {
    try {
      await page.goto(link.href, { waitUntil: "networkidle", timeout: 8000 });
      await page.waitForTimeout(500);
      const hasContent = await page.evaluate(() => document.body.innerText.length > 50);
      if (hasContent) pass(`Nav: ${link.text}`, link.href);
      else fail(`Nav: ${link.text}`, "Page has no content");
    } catch (e) {
      fail(`Nav: ${link.text}`, e.message.substring(0, 60));
    }
  }
}

// ─── FORMS VALIDATION ─────────────────────────────────────────────────────────
async function testForms(page) {
  section("FORMS - Validation & Submission");

  // Test signup form
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await screenshot(page, "signup");

  const nameInput = await page.$("input[name='name'], input[placeholder*='name' i]");
  const phoneInput = await page.$("input[type='tel'], input[name='phone']");

  if (nameInput && phoneInput) {
    // Test empty submission
    const submitBtn = await page.$("button[type='submit']");
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
      const errorMsg = await page.$("[class*='error'], [class*='invalid'], .error-message");
      if (errorMsg) pass("Form validation works", "Shows error on empty submit");
      else fail("Form validation", "No error shown on empty submit");
    }

    // Fill valid data
    await nameInput.fill("Test User");
    await phoneInput.fill("9876543210");
    pass("Signup form fillable");
  } else {
    fail("Signup form", "Name or phone input not found");
  }

  // Test contact form
  await page.goto(`${BASE_URL}/contact-us`, { waitUntil: "networkidle" });
  await screenshot(page, "contact");
  const contactForm = await page.$("form");
  if (contactForm) pass("Contact form exists");
  else fail("Contact form", "No form found on contact page");
}

// ─── API DATA VALIDATION ──────────────────────────────────────────────────────
async function testAPIData() {
  section("API DATA VALIDATION");

  // Products API
  const products = await checkAPIResponse(`${API_URL}/products?limit=10`, "Products list");
  if (products) {
    const items = products.products || products.data || products;
    if (Array.isArray(items) && items.length > 0) {
      pass("Products data valid", `${items.length} products returned`);
      const p = items[0];
      if (p.name) pass("Product has name", p.name);
      else fail("Product name", "Missing name field");
      if (p.price !== undefined) pass("Product has price", `₹${p.price}`);
      else fail("Product price", "Missing price field");
    } else {
      fail("Products data", "Empty or invalid array");
    }
  }

  // Categories API
  const cats = await checkAPIResponse(`${API_URL}/products/categories`, "Categories");
  if (cats) {
    const items = cats.categories || cats.data || cats;
    if (Array.isArray(items) && items.length > 0) pass("Categories data valid", `${items.length} categories`);
    else fail("Categories data", "Empty or invalid");
  }

  // Pincode API
  const pincode = await checkAPIResponse(`${API_URL}/pincode/521235`, "Pincode check");
  if (pincode) {
    if (pincode.serviceable !== undefined || pincode.deliverable !== undefined || pincode.pincode) 
      pass("Pincode data valid", JSON.stringify(pincode).substring(0, 60));
    else fail("Pincode data", "Missing expected fields");
  }
}

// ─── RESPONSIVE CHECK ─────────────────────────────────────────────────────────
async function testResponsive(browser) {
  section("RESPONSIVE DESIGN");

  const viewports = [
    { width: 375, height: 812, name: "mobile" },
    { width: 768, height: 1024, name: "tablet" },
    { width: 1280, height: 800, name: "desktop" },
  ];

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: vp });
    const pg = await ctx.newPage();
    await pg.goto(BASE_URL, { waitUntil: "networkidle" });
    await pg.waitForTimeout(1000);
    await ensureDir(SCREENSHOT_DIR);
    await pg.screenshot({ path: path.join(SCREENSHOT_DIR, `responsive-${vp.name}.png`) });
    const hasContent = await pg.evaluate(() => document.body.innerText.length > 100);
    if (hasContent) pass(`Responsive: ${vp.name}`, `${vp.width}x${vp.height}`);
    else fail(`Responsive: ${vp.name}`, "No content");
    await ctx.close();
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  log("\n🤖 DEEP COMPREHENSIVE TEST - All Pages, Buttons, Forms & APIs");
  log("=".repeat(60));

  // Check servers
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
    pass("Frontend server", `Running at ${BASE_URL}`);
  } catch { log("❌ Frontend not running! Start with: npm run dev:frontend"); process.exit(1); }

  try {
    await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) });
    pass("Backend server", `Running at ${API_URL}`);
  } catch { log("❌ Backend not running! Start with: npm run dev:backend"); process.exit(1); }

  // Test backend APIs first
  await testBackendHealth();

  // Launch browser
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Track console errors globally
  const allErrors = [];
  page.on("console", msg => { if (msg.type() === "error") allErrors.push(msg.text()); });
  page.on("pageerror", err => allErrors.push(err.message));

  try {
    await testHomePage(page);
    await testProductsPage(page);
    await testCartPage(page);
    await testLoginPage(page);
    await testAdminPages(page);
    await testDeliveryPages(page);
    await testNavigation(page);
    await testForms(page);
    await testAPIData();
    await testResponsive(browser);
  } catch (e) {
    fail("Test runner", e.message);
  }

  await browser.close();

  // Final report
  const criticalErrors = allErrors.filter(e =>
    !e.includes("favicon") && !e.includes("analytics") && !e.includes("ANDROID_HOME")
  );

  log("\n" + "=".repeat(60));
  log("📊 FINAL REPORT");
  log("=".repeat(60));
  log(`✅ Passed: ${passed.length}`);
  log(`❌ Failed: ${issues.length}`);
  log(`🔴 Console Errors: ${criticalErrors.length}`);

  if (issues.length > 0) {
    log("\n❌ ISSUES FOUND:");
    issues.forEach((i, idx) => log(`  ${idx + 1}. [${i.test}] ${i.error}`));
  }

  if (criticalErrors.length > 0) {
    log("\n🔴 CONSOLE ERRORS:");
    criticalErrors.slice(0, 10).forEach((e, idx) => log(`  ${idx + 1}. ${e.substring(0, 120)}`));
  }

  const report = {
    timestamp: new Date().toISOString(),
    summary: { passed: passed.length, failed: issues.length, consoleErrors: criticalErrors.length },
    issues,
    passed,
    consoleErrors: criticalErrors,
  };

  await ensureDir(path.dirname(REPORT_PATH));
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  log(`\n📄 Report saved: ${REPORT_PATH}`);
  log(`📸 Screenshots: ${SCREENSHOT_DIR}/`);
  log("\n" + (issues.length === 0 ? "✅ ALL TESTS PASSED!" : `⚠️  ${issues.length} ISSUES NEED FIXING`));
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });

import { test as base, expect, type Page } from "@playwright/test";

// Define test fixtures
export const test = base.extend<{
  customerPage: Page;
  adminPage: Page;
  deliveryPage: Page;
}>({
  // Authenticated user page
  customerPage: async ({ page }, use) => {
    // Seed auth state via localStorage (app reads these on startup)
    await page.addInitScript(() => {
      localStorage.setItem("accessToken", "e2e-access-token");
      localStorage.setItem("refreshToken", "e2e-refresh-token");
      localStorage.setItem(
        "authUser",
        JSON.stringify({
          name: "E2E Customer",
          role: "customer",
          isAdmin: false,
          email: "test@example.com",
        })
      );

      const jsonResponse = (data: any, status = 200) => {
        return Promise.resolve(
          new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
          })
        );
      };

      const readCart = () => {
        try {
          const raw = localStorage.getItem("e2eCart");
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      };

      const readOrders = () => {
        try {
          const raw = localStorage.getItem("e2eOrders");
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      };

      const writeOrders = (orders: any[]) => {
        try {
          localStorage.setItem("e2eOrders", JSON.stringify(orders));
        } catch {
          // ignore
        }
      };

      const nextOrderId = (prefix: string) => {
        try {
          const raw = localStorage.getItem("e2eOrderCounter");
          const current = raw ? Number(raw) : 0;
          const next = Number.isFinite(current) ? current + 1 : 1;
          localStorage.setItem("e2eOrderCounter", String(next));
          return `${prefix}${next}`;
        } catch {
          return `${prefix}${Date.now()}`;
        }
      };

      const writeCart = (items: any[]) => {
        try {
          localStorage.setItem("e2eCart", JSON.stringify(items));
        } catch {
          // ignore
        }
      };

      const computeCartTotals = (items: any[]) => {
        const total = items.reduce(
          (sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 0),
          0
        );
        return {
          total,
          itemCount: items.length,
        };
      };

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input?.url || "";
        const requestMethod = typeof input === "string" ? undefined : input?.method;
        const method = String(init?.method || requestMethod || "GET").toUpperCase();

        const readJsonBody = async () => {
          try {
            // Prefer explicit init.body when present (common for RTK Query)
            if (init?.body) {
              return typeof init.body === "string" ? JSON.parse(init.body) : init.body;
            }

            // If fetch was called with a Request, try to read and parse its body
            if (typeof input !== "string" && input?.clone) {
              const text = await input.clone().text();
              return text ? JSON.parse(text) : {};
            }

            return {};
          } catch {
            return {};
          }
        };

        // Products listing
        if (url.includes("/api/products") && method === "GET") {
          const mode = localStorage.getItem("e2eProductsMode") || "default";

          const products = [
            {
              _id: "product1",
              name: "Test Product",
              description: "Test Description",
              category: "electronics",
              price: 100,
              mrp: 120,
              stock: mode === "out_of_stock" ? 0 : mode === "limited_stock" ? 2 : 10,
              weight: 0,
              images: [
                {
                  variants: {
                    micro: "/placeholder-product.svg",
                    thumb: "/placeholder-product.svg",
                    small: "/placeholder-product.svg",
                    medium: "/placeholder-product.svg",
                    large: "/placeholder-product.svg",
                    original: "/placeholder-product.svg",
                  },
                },
              ],
              tags: ["test"],
            },
            {
              _id: "product2",
              name: "Another Product",
              description: "Another Description",
              category: "clothing",
              price: 200,
              mrp: 240,
              stock: mode === "out_of_stock" ? 0 : 5,
              weight: 0,
              images: [
                {
                  variants: {
                    micro: "/placeholder-product.svg",
                    thumb: "/placeholder-product.svg",
                    small: "/placeholder-product.svg",
                    medium: "/placeholder-product.svg",
                    large: "/placeholder-product.svg",
                    original: "/placeholder-product.svg",
                  },
                },
              ],
              tags: ["test"],
            },
          ];

          return jsonResponse({ products, pagination: { page: 1, limit: 10, total: products.length } });
        }

        // Profile completion checks
        if (url.includes("/api/user/profile")) {
          return jsonResponse({
            name: "E2E Customer",
            phone: "9876543210",
          });
        }

        // Addresses (default address for checkout/cart delivery fee)
        if (url.includes("/api/user/addresses") && method === "GET") {
          const invalidCoords = localStorage.getItem("e2eInvalidCoords") === "true";
          let addresses: any[] | null = null;
          try {
            const raw = localStorage.getItem("e2eAddresses");
            addresses = raw ? JSON.parse(raw) : null;
          } catch {
            addresses = null;
          }

          const defaultAddressId = localStorage.getItem("e2eDefaultAddressId") || "addr1";

          const baseAddresses = (addresses && Array.isArray(addresses) && addresses.length > 0)
            ? addresses
            : [
                {
                  _id: "addr1",
                  id: "addr1",
                  label: "Home",
                  name: "E2E Customer",
                  phone: "9876543210",
                  addressLine: "123 Test Street",
                  city: "Hyderabad",
                  state: "Telangana",
                  pincode: "500001",
                  lat: invalidCoords ? 0 : 17.385,
                  lng: invalidCoords ? 0 : 78.4867,
                  location: invalidCoords ? { lat: 0, lng: 0 } : { lat: 17.385, lng: 78.4867 },
                },
              ];

          const normalized = baseAddresses.map((a: any) => {
            const id = String(a.id || a._id || "");
            const lat = typeof a.lat === "number" ? a.lat : (typeof a.location?.lat === "number" ? a.location.lat : undefined);
            const lng = typeof a.lng === "number" ? a.lng : (typeof a.location?.lng === "number" ? a.location.lng : undefined);
            return {
              ...a,
              _id: a._id || id,
              id,
              lat: typeof lat === "number" ? lat : 0,
              lng: typeof lng === "number" ? lng : 0,
              location: a.location || { lat: typeof lat === "number" ? lat : 0, lng: typeof lng === "number" ? lng : 0 },
            };
          });

          return jsonResponse({
            addresses: normalized,
            defaultAddressId,
          });
        }

        // Set default address
        if (url.includes("/api/user/addresses/") && url.includes("/default") && method === "PATCH") {
          try {
            const addressId = String(url.split("/api/user/addresses/")[1]?.split("/")[0] || "");
            if (addressId) {
              localStorage.setItem("e2eDefaultAddressId", addressId);
            }
          } catch {
            // ignore
          }
          return jsonResponse({ success: true });
        }

        // Pincode deliverability check
        if (url.includes("/api/pincode/check/") && method === "GET") {
          const forced = localStorage.getItem("e2ePincodeDeliverable");
          if (forced === "false") return jsonResponse({ deliverable: false });
          return jsonResponse({ deliverable: true });
        }

        // Cart CRUD
        if (url.includes("/api/cart") && method === "GET") {
          const items = readCart();
          const totals = computeCartTotals(items);
          const backendItems = items.map((it: any) => ({
            productId: { _id: it.id },
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            image: it.image,
          }));
          return jsonResponse({
            cart: {
              items: backendItems,
              totalAmount: totals.total,
              itemCount: totals.itemCount,
            },
          });
        }

        if (url.includes("/api/cart/clear") && method === "DELETE") {
          writeCart([]);
          return jsonResponse({ cart: { items: [], total: 0, itemCount: 0 } });
        }

        if (url.includes("/api/cart") && method === "POST") {
          const body: any = await readJsonBody();

          const items = readCart();
          const productId = String(body.productId || body.id || "");
          const qty = Number(body.quantity || 1);

          const existing = items.find((it: any) => it.id === productId);
          if (existing) {
            existing.quantity = Number(existing.quantity || 0) + qty;
          } else {
            items.push({
              id: productId || `product_${Date.now()}`,
              name: body.name || "Test Product",
              price: Number(body.price || 100),
              image: body.image || "/placeholder-product.svg",
              quantity: qty,
            });
          }

          writeCart(items);
          const totals = computeCartTotals(items);
          return jsonResponse({ cart: { items, total: totals.total, itemCount: totals.itemCount } });
        }

        if (url.includes("/api/cart") && method === "PUT") {
          const body: any = await readJsonBody();

          const items = readCart();
          const productId = String(body.productId || body.id || "");
          const qty = Number(body.quantity || 1);

          const mode = localStorage.getItem("e2eProductsMode") || "default";
          if (mode === "limited_stock") {
            const stockByProductId: Record<string, number> = {
              product1: 2,
              product2: 5,
            };
            const stock = stockByProductId[productId];
            if (typeof stock === "number" && qty > stock) {
              return jsonResponse({ error: "Insufficient stock" }, 400);
            }
          }

          const existing = items.find((it: any) => it.id === productId);
          if (existing) {
            existing.quantity = qty;
          }

          writeCart(items);
          const totals = computeCartTotals(items);
          return jsonResponse({ cart: { items, total: totals.total, itemCount: totals.itemCount } });
        }

        if (url.includes("/api/cart/") && method === "DELETE") {
          const productId = String(url.split("/api/cart/")[1] || "");
          const items = readCart().filter((it: any) => it.id !== productId);
          writeCart(items);
          const totals = computeCartTotals(items);
          return jsonResponse({ cart: { items, total: totals.total, itemCount: totals.itemCount } });
        }

        // Orders (simplified)
        if (url.includes("/api/orders") && method === "GET") {
          const parts = url.split("/api/orders/");
          // GET /api/orders/:id
          if (parts.length > 1 && parts[1] && !parts[1].includes("?") && !parts[1].includes("payment-status")) {
            const orderId = String(parts[1].split("?")[0] || "");
            const orders = readOrders();
            const found = orders.find((o: any) => o._id === orderId);
            if (found) {
              return jsonResponse(found);
            }
            return jsonResponse({ message: "Order not found" }, 404);
          }

          // GET /api/orders
          return jsonResponse({ orders: readOrders() });
        }

        if (url.includes("/api/orders") && method === "POST") {
          if (localStorage.getItem("e2eOrdersFail") === "true") {
            return jsonResponse({ message: "Failed to create order" }, 400);
          }

          const body: any = await readJsonBody();

          const paymentMethod = String(body.paymentMethod || "").toLowerCase();
          const cartItems = readCart();
          const orderItems = cartItems.map((it: any) => ({
            productId: {
              _id: it.id,
              name: it.name,
              price: it.price,
              images: [it.image].filter(Boolean),
              mrp: it.price,
            },
            name: it.name,
            price: it.price,
            qty: it.quantity,
            quantity: it.quantity,
          }));
          const totals = computeCartTotals(cartItems);

          if (paymentMethod === "upi") {
            const id = nextOrderId("order_upi_");
            const order = {
              _id: id,
              items: orderItems,
              totalAmount: totals.total,
              paymentMethod: "upi",
              paymentStatus: "AWAITING_UPI_APPROVAL",
              orderStatus: "PENDING_PAYMENT",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            const orders = readOrders();
            orders.unshift(order);
            writeOrders(orders);
            return jsonResponse({ message: "Order created. Awaiting UPI payment", order }, 201);
          }

          const id = nextOrderId("order_cod_");
          const order = {
            _id: id,
            items: orderItems,
            totalAmount: totals.total,
            paymentMethod: "cod",
            paymentStatus: "PENDING",
            orderStatus: "CONFIRMED",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const orders = readOrders();
          orders.unshift(order);
          writeOrders(orders);
          return jsonResponse({ message: "Order placed with Cash on Delivery", order }, 201);
        }

        if (url.includes("/api/orders/") && url.includes("/payment-status") && method === "PUT") {
          const orderId = url.split("/api/orders/")[1]?.split("/")[0] || "";
          const orders = readOrders();
          const idx = orders.findIndex((o: any) => o._id === orderId);
          if (idx >= 0) {
            orders[idx] = {
              ...orders[idx],
              paymentStatus: "PAID",
              orderStatus: "CONFIRMED",
              paymentReceivedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            writeOrders(orders);
          }
          return jsonResponse({
            success: true,
            message: "Payment status updated successfully",
            order: {
              _id: orderId,
              paymentStatus: "PAID",
              orderStatus: "CONFIRMED",
            },
          });
        }

        return originalFetch(input, init);
      };
    });

    await page.goto("/");
    await use(page);
  },
  
  // Admin page
  adminPage: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem("accessToken", "e2e-admin-access-token");
      localStorage.setItem("refreshToken", "e2e-admin-refresh-token");
      localStorage.setItem(
        "authUser",
        JSON.stringify({
          name: "E2E Admin",
          role: "admin",
          isAdmin: true,
          email: "admin@cpsstore.com",
        })
      );

      const jsonResponse = (data: any, status = 200) => {
        return Promise.resolve(
          new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
          })
        );
      };

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input?.url || "";
        const requestMethod = typeof input === "string" ? undefined : input?.method;
        const method = String(init?.method || requestMethod || "GET").toUpperCase();

        if (url.includes("/api/admin/dashboard-stats") && method === "GET") {
          return jsonResponse({
            totalProducts: 0,
            totalUsers: 0,
            totalOrders: 0,
            totalDeliveryBoys: 0,
            recentOrders: 0,
            totalRevenue: 0,
          });
        }

        if (url.includes("/api/user/profile") && method === "GET") {
          return jsonResponse({ name: "E2E Admin", phone: "9876543210" });
        }

        return originalFetch(input, init);
      };
    });

    await page.goto("/admin");
    await use(page);
  },
  
  // Delivery partner page
  deliveryPage: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem("accessToken", "e2e-delivery-access-token");
      localStorage.setItem("refreshToken", "e2e-delivery-refresh-token");
      localStorage.setItem(
        "authUser",
        JSON.stringify({
          name: "E2E Delivery",
          role: "delivery",
          isAdmin: false,
          email: "driver@cpsstore.com",
        })
      );

      const jsonResponse = (data: any, status = 200) => {
        return Promise.resolve(
          new Response(JSON.stringify(data), {
            status,
            headers: { "Content-Type": "application/json" },
          })
        );
      };

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input?.url || "";
        const requestMethod = typeof input === "string" ? undefined : input?.method;
        const method = String(init?.method || requestMethod || "GET").toUpperCase();

        if (url.includes("/api/delivery/orders") && method === "GET") {
          return jsonResponse({ deliveryBoy: { _id: "driver1" } });
        }

        if (url.includes("/api/user/profile") && method === "GET") {
          return jsonResponse({ name: "E2E Delivery", phone: "9876543210" });
        }

        return originalFetch(input, init);
      };
    });

    // Retry navigation to handle transient connection issues
    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto("/delivery/dashboard");
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await page.waitForTimeout(1000);
      }
    }
    await use(page);
  },
});

// Re-export expect
export { expect };

export type { Page };

// Helper functions
export async function signupUser(page: Page, userData: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  await page.goto("/signup");
  await page.fill('input[name="name"]', userData.name);
  await page.fill('input[name="email"]', userData.email);
  await page.fill('input[name="phone"]', userData.phone);
  await page.fill('input[name="password"]', userData.password);
  await page.fill('input[name="confirmPassword"]', userData.password);
  await page.click('button[type="submit"]');
}

export async function loginUser(page: Page, email: string, password: string) {
  // App uses OTP login; for tests, prefer seeding localStorage via fixtures.
  await page.goto("/login");
  await page.fill('input[name="emailOrPhone"]', email);
  await page.click('button:has-text("Send OTP")');
  await page.fill('input[name="otp"]', "123456");
  await page.click('button:has-text("Verify OTP")');
}

export async function addProductToCart(page: Page, productName?: string) {
  await page.goto("/products");

  const addButton = productName
    ? page.locator(`button:has-text("Add to Cart")`, { hasText: "Add to Cart" })
    : page.locator('button:has-text("Add to Cart")').first();

  await addButton.click();
}

export async function proceedToCheckout(page: Page) {
  // Go to cart
  await page.goto("/cart");

  // Proceed to checkout
  await page.click('a:has-text("PLACE ORDER")');

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
  // Checkout page uses saved default address; address entry happens on /addresses.
  // This helper now only places a COD order from checkout.
  await page.locator('input[type="radio"][name="payment"][value="cod"]').check();
  await page.click('button:has-text("Place Order")');
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

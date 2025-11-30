import request from "supertest";
import app from "../../src/app";
import { createTestUser, getAuthHeaders } from "../helpers/auth";
import "../types/global.d.ts";

describe("Cart Endpoints", () => {
  let user: any;
  let authHeaders: any;
  let product: any;

  beforeEach(async () => {
    user = await createTestUser();
    authHeaders = getAuthHeaders(user);
    product = await global.createTestProduct({
      name: "Test Product",
      price: 100,
      stock: 10,
    });
  });

  describe("POST /api/cart/add", () => {
    it("should add item to cart", async () => {
      const cartData = {
        productId: product._id,
        quantity: 2,
      };

      const response = await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send(cartData)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Item added to cart");
      expect(response.body).toHaveProperty("cart");
      expect(response.body.cart.items).toHaveLength(1);
      expect(response.body.cart.items[0].productId).toBe(product._id.toString());
      expect(response.body.cart.items[0].quantity).toBe(2);
      expect(response.body.cart.totalAmount).toBe(200);
    });

    it("should update quantity if item already exists in cart", async () => {
      // Add item first
      await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send({ productId: product._id, quantity: 2 });

      // Add same item again
      const response = await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send({ productId: product._id, quantity: 3 })
        .expect(200);

      expect(response.body.cart.items).toHaveLength(1);
      expect(response.body.cart.items[0].quantity).toBe(5); // 2 + 3
      expect(response.body.cart.totalAmount).toBe(500);
    });

    it("should not add item with insufficient stock", async () => {
      const cartData = {
        productId: product._id,
        quantity: 15, // More than stock (10)
      };

      const response = await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send(cartData)
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Insufficient stock");
    });

    it("should not add item for non-existent product", async () => {
      const cartData = {
        productId: "507f1f77bcf86cd799439011",
        quantity: 1,
      };

      const response = await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send(cartData)
        .expect(404);

      expect(response.body).toHaveProperty("message", "Product not found");
    });

    it("should not add item without authentication", async () => {
      const cartData = {
        productId: product._id,
        quantity: 1,
      };

      const response = await request(app)
        .post("/api/cart/add")
        .send(cartData)
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("GET /api/cart", () => {
    beforeEach(async () => {
      // Add items to cart
      await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send({ productId: product._id, quantity: 2 });
    });

    it("should get user cart", async () => {
      const response = await request(app)
        .get("/api/cart")
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("cart");
      expect(response.body.cart.items).toHaveLength(1);
      expect(response.body.cart.items[0].productId).toBe(product._id.toString());
      expect(response.body.cart.items[0].quantity).toBe(2);
      expect(response.body.cart.totalAmount).toBe(200);
    });

    it("should return empty cart for new user", async () => {
      const newUser = await createTestUser({ email: "newuser@example.com" });
      const newAuthHeaders = getAuthHeaders(newUser);

      const response = await request(app)
        .get("/api/cart")
        .set(newAuthHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("cart");
      expect(response.body.cart.items).toHaveLength(0);
      expect(response.body.cart.totalAmount).toBe(0);
    });

    it("should not get cart without authentication", async () => {
      const response = await request(app)
        .get("/api/cart")
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });

  describe("PUT /api/cart/update", () => {
    beforeEach(async () => {
      // Add item to cart
      await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send({ productId: product._id, quantity: 2 });
    });

    it("should update item quantity", async () => {
      const updateData = {
        productId: product._id,
        quantity: 5,
      };

      const response = await request(app)
        .put("/api/cart/update")
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Cart updated");
      expect(response.body.cart.items[0].quantity).toBe(5);
      expect(response.body.cart.totalAmount).toBe(500);
    });

    it("should remove item if quantity is 0", async () => {
      const updateData = {
        productId: product._id,
        quantity: 0,
      };

      const response = await request(app)
        .put("/api/cart/update")
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Cart updated");
      expect(response.body.cart.items).toHaveLength(0);
      expect(response.body.cart.totalAmount).toBe(0);
    });

    it("should not update quantity beyond stock", async () => {
      const updateData = {
        productId: product._id,
        quantity: 15, // More than stock (10)
      };

      const response = await request(app)
        .put("/api/cart/update")
        .set(authHeaders)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Insufficient stock");
    });

    it("should not update non-existent item", async () => {
      const updateData = {
        productId: "507f1f77bcf86cd799439011",
        quantity: 1,
      };

      const response = await request(app)
        .put("/api/cart/update")
        .set(authHeaders)
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty("message", "Item not found in cart");
    });

    it("should not update cart without authentication", async () => {
      const updateData = {
        productId: product._id,
        quantity: 3,
      };

      const response = await request(app)
        .put("/api/cart/update")
        .send(updateData)
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });

  describe("DELETE /api/cart/remove", () => {
    beforeEach(async () => {
      // Add item to cart
      await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send({ productId: product._id, quantity: 2 });
    });

    it("should remove item from cart", async () => {
      const response = await request(app)
        .delete("/api/cart/remove")
        .set(authHeaders)
        .send({ productId: product._id })
        .expect(200);

      expect(response.body).toHaveProperty("message", "Item removed from cart");
      expect(response.body.cart.items).toHaveLength(0);
      expect(response.body.cart.totalAmount).toBe(0);
    });

    it("should not remove non-existent item", async () => {
      const response = await request(app)
        .delete("/api/cart/remove")
        .set(authHeaders)
        .send({ productId: "507f1f77bcf86cd799439011" })
        .expect(404);

      expect(response.body).toHaveProperty("message", "Item not found in cart");
    });

    it("should not remove item without authentication", async () => {
      const response = await request(app)
        .delete("/api/cart/remove")
        .send({ productId: product._id })
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });

    it("should validate product ID", async () => {
      const response = await request(app)
        .delete("/api/cart/remove")
        .set(authHeaders)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message", "Product ID is required");
    });
  });

  describe("DELETE /api/cart/clear", () => {
    beforeEach(async () => {
      // Add items to cart
      await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send({ productId: product._id, quantity: 2 });
    });

    it("should clear entire cart", async () => {
      const response = await request(app)
        .delete("/api/cart/clear")
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Cart cleared");
      expect(response.body.cart.items).toHaveLength(0);
      expect(response.body.cart.totalAmount).toBe(0);
    });

    it("should not clear cart without authentication", async () => {
      const response = await request(app)
        .delete("/api/cart/clear")
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });
  });

  describe("Cart with multiple items", () => {
    let product2: any;

    beforeEach(async () => {
      product2 = await global.createTestProduct({
        name: "Second Product",
        price: 50,
        stock: 5,
      });

      // Add multiple items
      await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send({ productId: product._id, quantity: 2 });

      await request(app)
        .post("/api/cart/add")
        .set(authHeaders)
        .send({ productId: product2._id, quantity: 3 });
    });

    it("should handle multiple items correctly", async () => {
      const response = await request(app)
        .get("/api/cart")
        .set(authHeaders)
        .expect(200);

      expect(response.body.cart.items).toHaveLength(2);
      expect(response.body.cart.totalAmount).toBe(350); // (100 * 2) + (50 * 3)
    });

    it("should update one item without affecting others", async () => {
      const updateData = {
        productId: product._id,
        quantity: 1,
      };

      const response = await request(app)
        .put("/api/cart/update")
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.cart.items).toHaveLength(2);
      expect(response.body.cart.totalAmount).toBe(250); // (100 * 1) + (50 * 3)
    });

    it("should remove one item without affecting others", async () => {
      const response = await request(app)
        .delete("/api/cart/remove")
        .set(authHeaders)
        .send({ productId: product._id })
        .expect(200);

      expect(response.body.cart.items).toHaveLength(1);
      expect(response.body.cart.items[0].productId).toBe(product2._id.toString());
      expect(response.body.cart.totalAmount).toBe(150); // 50 * 3
    });
  });
});

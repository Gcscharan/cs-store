import request from "supertest";
import app from "../../src/app";
import { createTestUser, createTestAdmin, getAuthHeaders, getAuthHeadersForAdmin } from "../helpers/auth";
import "../types/global.d.ts";

describe("Products Endpoints", () => {
  describe("GET /api/products", () => {
    beforeEach(async () => {
      // Create test products
      await global.createTestProduct({
        name: "Laptop",
        price: 50000,
        category: "electronics",
        stock: 10,
      });
      await global.createTestProduct({
        name: "Phone",
        price: 25000,
        category: "electronics",
        stock: 20,
      });
    });

    it("should get all products", async () => {
      const response = await request(app)
        .get("/api/products")
        .expect(200);

      expect(response.body).toHaveProperty("products");
      expect(response.body.products).toHaveLength(2);
      expect(response.body).toHaveProperty("pagination");
      expect(response.body.pagination).toHaveProperty("page", 1);
      expect(response.body.pagination).toHaveProperty("limit", 10);
      expect(response.body.pagination).toHaveProperty("total", 2);
    });

    it("should filter products by category", async () => {
      const response = await request(app)
        .get("/api/products?category=electronics")
        .expect(200);

      expect(response.body.products).toHaveLength(2);
      response.body.products.forEach((product: any) => {
        expect(product.category).toBe("electronics");
      });
    });

    it("should paginate products", async () => {
      const response = await request(app)
        .get("/api/products?page=1&limit=1")
        .expect(200);

      expect(response.body.products).toHaveLength(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.total).toBe(2);
    });

    it("should search products by name", async () => {
      const response = await request(app)
        .get("/api/products?search=Laptop")
        .expect(200);

      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].name).toContain("Laptop");
    });
  });

  describe("GET /api/products/:id", () => {
    let product: any;

    beforeEach(async () => {
      product = await global.createTestProduct();
    });

    it("should get product by ID", async () => {
      const response = await request(app)
        .get(`/api/products/${product._id}`)
        .expect(200);

      expect(response.body).toHaveProperty("product");
      expect(response.body.product._id).toBe(product._id.toString());
      expect(response.body.product.name).toBe(product.name);
    });

    it("should return 404 for non-existent product", async () => {
      const response = await request(app)
        .get("/api/products/507f1f77bcf86cd799439011")
        .expect(404);

      expect(response.body).toHaveProperty("message", "Product not found");
    });
  });

  describe("GET /api/products/search/suggestions", () => {
    beforeEach(async () => {
      await global.createTestProduct({
        name: "Laptop Pro Max",
        price: 50000,
        category: "electronics",
      });
      await global.createTestProduct({
        name: "Laptop Air",
        price: 40000,
        category: "electronics",
      });
      await global.createTestProduct({
        name: "Smartphone Pro",
        price: 25000,
        category: "electronics",
      });
    });

    it("should get search suggestions", async () => {
      const response = await request(app)
        .get("/api/products/search/suggestions?q=Laptop")
        .expect(200);

      expect(response.body).toHaveProperty("suggestions");
      expect(response.body.suggestions.length).toBeGreaterThan(0);
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.name).toContain("Laptop");
      });
    });

    it("should return empty suggestions for no query", async () => {
      const response = await request(app)
        .get("/api/products/search/suggestions")
        .expect(200);

      expect(response.body).toHaveProperty("suggestions", []);
    });
  });

  describe("GET /api/products/similar/:id", () => {
    let product: any;

    beforeEach(async () => {
      product = await global.createTestProduct({
        name: "Laptop",
        category: "electronics",
        price: 50000,
      });
      
      // Create similar products
      await global.createTestProduct({
        name: "Gaming Laptop",
        category: "electronics",
        price: 60000,
      });
      await global.createTestProduct({
        name: "Office Laptop",
        category: "electronics",
        price: 45000,
      });
    });

    it("should get similar products", async () => {
      const response = await request(app)
        .get(`/api/products/similar/${product._id}`)
        .expect(200);

      expect(response.body).toHaveProperty("products");
      expect(response.body.products.length).toBeGreaterThan(0);
      response.body.products.forEach((similarProduct: any) => {
        expect(similarProduct._id).not.toBe(product._id.toString());
        expect(similarProduct.category).toBe(product.category);
      });
    });

    it("should return 404 for non-existent product", async () => {
      const response = await request(app)
        .get("/api/products/similar/507f1f77bcf86cd799439011")
        .expect(404);

      expect(response.body).toHaveProperty("message", "Product not found");
    });
  });

  describe("POST /api/products (Admin only)", () => {
    let admin: any;
    let adminHeaders: any;
    let user: any;
    let userHeaders: any;

    beforeEach(async () => {
      admin = await createTestAdmin();
      adminHeaders = getAuthHeadersForAdmin(admin);
      user = await createTestUser();
      userHeaders = getAuthHeaders(user);
    });

    it("should create product as admin", async () => {
      const productData = {
        name: "New Laptop",
        description: "A powerful laptop",
        price: 55000,
        category: "electronics",
        stock: 15,
        images: ["https://example.com/laptop.jpg"],
        specifications: {
          brand: "TestBrand",
          ram: "16GB",
          storage: "512GB SSD",
        },
      };

      const response = await request(app)
        .post("/api/products")
        .set(adminHeaders)
        .send(productData)
        .expect(201);

      expect(response.body).toHaveProperty("message", "Product created successfully");
      expect(response.body).toHaveProperty("product");
      expect(response.body.product.name).toBe(productData.name);
      expect(response.body.product.price).toBe(productData.price);
    });

    it("should not create product as regular user", async () => {
      const productData = {
        name: "New Laptop",
        description: "A powerful laptop",
        price: 55000,
        category: "electronics",
        stock: 15,
        images: ["https://example.com/laptop.jpg"],
      };

      const response = await request(app)
        .post("/api/products")
        .set(userHeaders)
        .send(productData)
        .expect(403);

      expect(response.body).toHaveProperty("message", "Admin access required");
    });

    it("should not create product without authentication", async () => {
      const productData = {
        name: "New Laptop",
        description: "A powerful laptop",
        price: 55000,
        category: "electronics",
        stock: 15,
        images: ["https://example.com/laptop.jpg"],
      };

      const response = await request(app)
        .post("/api/products")
        .send(productData)
        .expect(401);

      expect(response.body).toHaveProperty("message", "Authentication required");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/products")
        .set(adminHeaders)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("PUT /api/products/:id (Admin only)", () => {
    let admin: any;
    let adminHeaders: any;
    let product: any;

    beforeEach(async () => {
      admin = await createTestAdmin();
      adminHeaders = getAuthHeadersForAdmin(admin);
      product = await global.createTestProduct();
    });

    it("should update product as admin", async () => {
      const updateData = {
        name: "Updated Laptop",
        price: 52000,
        stock: 20,
      };

      const response = await request(app)
        .put(`/api/products/${product._id}`)
        .set(adminHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Product updated successfully");
      expect(response.body).toHaveProperty("product");
      expect(response.body.product.name).toBe(updateData.name);
      expect(response.body.product.price).toBe(updateData.price);
      expect(response.body.product.stock).toBe(updateData.stock);
    });

    it("should not update product with invalid ID", async () => {
      const updateData = {
        name: "Updated Laptop",
        price: 52000,
      };

      const response = await request(app)
        .put("/api/products/507f1f77bcf86cd799439011")
        .set(adminHeaders)
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty("message", "Product not found");
    });
  });

  describe("DELETE /api/products/:id (Admin only)", () => {
    let admin: any;
    let adminHeaders: any;
    let product: any;

    beforeEach(async () => {
      admin = await createTestAdmin();
      adminHeaders = getAuthHeadersForAdmin(admin);
      product = await global.createTestProduct();
    });

    it("should delete product as admin", async () => {
      const response = await request(app)
        .delete(`/api/products/${product._id}`)
        .set(adminHeaders)
        .expect(200);

      expect(response.body).toHaveProperty("message", "Product deleted successfully");

      // Verify product is deleted
      const { Product } = await import("../../src/models/Product");
      const deletedProduct = await Product.findById(product._id);
      expect(deletedProduct).toBeNull();
    });

    it("should not delete product with invalid ID", async () => {
      const response = await request(app)
        .delete("/api/products/507f1f77bcf86cd799439011")
        .set(adminHeaders)
        .expect(404);

      expect(response.body).toHaveProperty("message", "Product not found");
    });
  });

  describe("GET /api/products/categories", () => {
    beforeEach(async () => {
      await global.createTestProduct({ category: "electronics" });
      await global.createTestProduct({ category: "electronics" });
      await global.createTestProduct({ category: "clothing" });
      await global.createTestProduct({ category: "other" });
    });

    it("should get all categories with product counts", async () => {
      const response = await request(app)
        .get("/api/products/categories")
        .expect(200);

      expect(response.body).toHaveProperty("categories");
      expect(response.body.categories.length).toBeGreaterThan(0);
      
      const electronics = response.body.categories.find((cat: any) => cat.name === "electronics");
      expect(electronics).toBeDefined();
      expect(electronics.count).toBe(2);
    });
  });
});

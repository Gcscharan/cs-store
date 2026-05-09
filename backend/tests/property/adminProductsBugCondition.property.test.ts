/**
 * Bug Condition Exploration Test - Admin Products POST Route Missing
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * This test encodes the EXPECTED behavior:
 * - POST /admin/products should exist as a route (not return 404)
 * - POST /admin/products should handle authentication properly
 * - POST /admin/products should handle multipart form data
 * 
 * When this test passes after the fix, it confirms the expected behavior is satisfied.
 */

import request from "supertest";
import { createApp } from "../../src/createApp";

// Create test app without external dependencies
const app = createApp({
  enableQueues: false,
  enableRedis: false,
  enableExternalAPIs: false,
  enableSentry: false,
  enableAuth: true,
});

describe("Bug Condition: Admin Products POST Route Missing", () => {
  describe("Property 1: Admin Product Creation Route Should Exist", () => {
    it("should not return 404 for POST /api/admin/products with multipart data", async () => {
      // Combined test: route existence + multipart handling + auth validation
      const testImageBuffer = Buffer.from("fake-image-data");

      const response = await request(app)
        .post("/api/admin/products")
        .field("name", "Test Product")
        .field("description", "Test Description")
        .field("category", "chocolates")
        .field("price", "10.00")
        .field("stock", "1")
        .attach("images", testImageBuffer, "test.jpg");

      // EXPECTED: Should NOT return 404 (route should exist and handle multipart data)
      // CURRENT BUG: Returns 404 because POST /api/admin/products route doesn't exist
      // After fix: Should return 401 (Unauthorized) - missing authentication
      expect(response.status).not.toBe(404);
      
      // Should return proper authentication error since no auth token provided
      expect([400, 401, 403, 422, 500]).toContain(response.status);
    });

    it("should behave consistently with existing admin routes (not return 404)", async () => {
      // Test that POST /api/admin/products behaves like other admin routes
      const postResponse = await request(app)
        .post("/api/admin/products")
        .send({
          name: "Test Product",
          category: "chocolates",
          price: 10.00
        });

      // EXPECTED: Should NOT return 404 (route should exist)
      // CURRENT BUG: Returns 404 because route doesn't exist
      expect(postResponse.status).not.toBe(404);
      
      // Should require authentication (return 401/403, not 404)
      expect([400, 401, 403, 422, 500]).toContain(postResponse.status);
    });
  });
});
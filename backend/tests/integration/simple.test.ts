import request from "supertest";
import app from "../../src/app";

describe("Simple API Tests", () => {
  test("should return 404 for non-existent route", async () => {
    const response = await request(app)
      .get("/api/non-existent")
      .expect(404);

    expect(response.body).toHaveProperty("message");
  });

  test("should handle health check", async () => {
    const response = await request(app)
      .get("/health")
      .expect(200);

    expect(response.body).toHaveProperty("status", "OK");
  });

  test("should handle CORS preflight", async () => {
    await request(app)
      .options("/api/test")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET")
      .expect(204);
  });
});

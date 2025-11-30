import request from "supertest";
import app from "../../src/app";

describe("Basic API Tests", () => {
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

  test("should handle product listing endpoint", async () => {
    const response = await request(app)
      .get("/api/products")
      .expect(200);

    expect(Array.isArray(response.body.products)).toBe(true);
  });

  test("should reject invalid login", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "invalid@example.com",
        password: "wrongpassword"
      })
      .expect(400);

    expect(response.body).toHaveProperty("message");
  });

  test("should reject signup with incomplete data", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({
        email: "test@example.com"
        // Missing password, name, phone
      })
      .expect(400);

    expect(response.body).toHaveProperty("message");
  });
});

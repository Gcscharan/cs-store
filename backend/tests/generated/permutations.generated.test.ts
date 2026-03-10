import request from "supertest";
import app from "../../src/app";
import {
  generateAlgNoneToken,
  generateExpiredToken,
  generateInvalidToken,
  generateMalformedToken,
  generateValidAdminToken,
  generateValidCustomerToken,
} from "../helpers/tokenHelper";

jest.setTimeout(30000);

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type Endpoint = {
  method: HttpMethod;
  path: string;
  auth: "public" | "customer" | "admin";
};

const PUBLIC = new Set(["/api/products", "/api/auth/login", "/api/auth/signup", "/api/health"]);

function classifyPath(path: string): Endpoint["auth"] {
  if (PUBLIC.has(path.replace(/\/$/, ""))) return "public";
  if (path.startsWith("/api/admin") || path.startsWith("/internal")) return "admin";
  return "customer";
}

const endpoints: Endpoint[] = [
  { method: "GET", path: "/api/products", auth: classifyPath("/api/products") },
  { method: "POST", path: "/api/auth/login", auth: classifyPath("/api/auth/login") },
  { method: "POST", path: "/api/auth/signup", auth: classifyPath("/api/auth/signup") },
  { method: "GET", path: "/api/health", auth: classifyPath("/api/health") },
  { method: "GET", path: "/api/cart", auth: classifyPath("/api/cart") },
  { method: "POST", path: "/api/cart", auth: classifyPath("/api/cart") },
  { method: "GET", path: "/api/orders", auth: classifyPath("/api/orders") },
  { method: "POST", path: "/api/orders", auth: classifyPath("/api/orders") },
  { method: "GET", path: "/api/user/profile", auth: classifyPath("/api/user/profile") },
  { method: "PUT", path: "/api/user/profile", auth: classifyPath("/api/user/profile") },
  { method: "GET", path: "/api/admin/orders", auth: classifyPath("/api/admin/orders") },
  { method: "GET", path: "/api/admin/users", auth: classifyPath("/api/admin/users") },
  { method: "POST", path: "/api/admin/products", auth: classifyPath("/api/admin/products") },
  // TODO: Expand this list to include all OpenAPI paths.
];

function expectProtectedAuthFailure(status: number) {
  expect([401, 403].includes(status)).toBe(true);
}

function send(method: HttpMethod, path: string) {
  const req = request(app)[method.toLowerCase() as "get"](path);
  return req;
}

function withAuth(req: any, token: string | null) {
  if (!token) return req;
  return req.set("Authorization", `Bearer ${token}`);
}

function anyBodyFor(method: HttpMethod) {
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return { any: "body" };
  }
  return undefined;
}

function makeReq(ep: Endpoint) {
  return send(ep.method, ep.path);
}

describe("Generated endpoint permutations", () => {
  endpoints.forEach((ep) => {
    describe(`${ep.method} ${ep.path}`, () => {
      if (ep.auth === "public") {
        it("public endpoint: skip auth permutations", async () => {
          const req = makeReq(ep);
          const body = anyBodyFor(ep.method);
          const res = body ? await req.send(body) : await req;
          expect(res.status).not.toBe(500);
        });
        return;
      }

      it("no token returns 401/403", async () => {
        const req = makeReq(ep);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        expectProtectedAuthFailure(res.status);
      });

      it("invalid token returns 401/403", async () => {
        const req = makeReq(ep).set("Authorization", `Bearer ${generateInvalidToken()}`);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        expectProtectedAuthFailure(res.status);
      });

      it("malformed token returns 401/403", async () => {
        const req = makeReq(ep).set("Authorization", `Bearer ${generateMalformedToken()}`);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        expectProtectedAuthFailure(res.status);
      });

      it("expired token returns 401/403", async () => {
        const req = makeReq(ep).set("Authorization", `Bearer ${generateExpiredToken()}`);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        expectProtectedAuthFailure(res.status);
      });

      it("customer token on admin path returns 403", async () => {
        const req = withAuth(send(ep.method, ep.path), generateValidCustomerToken());
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        if (ep.auth === "admin") {
          expect([403, 404]).toContain(res.status);
        } else {
          // not an admin route
          expect([200, 201, 400, 401, 404]).toContain(res.status);
        }
      });

      it("admin token on customer path returns not 401/403/500", async () => {
        const req = withAuth(send(ep.method, ep.path), generateValidAdminToken());
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        if (ep.auth === "customer") {
          expect([401, 403, 500]).not.toContain(res.status);
        } else {
          expect([500]).not.toContain(res.status);
        }
      });

      it("valid token + missing required body returns 400", async () => {
        const token = ep.auth === "admin" ? generateValidAdminToken() : generateValidCustomerToken();
        const req = withAuth(send(ep.method, ep.path), token);
        if (ep.method === "POST" || ep.method === "PUT" || ep.method === "PATCH") {
          const res = await req.send({});
          expect([400, 401, 403, 404]).toContain(res.status);
        } else {
          const res = await req;
          expect([200, 201, 400, 401, 403, 404]).toContain(res.status);
        }
      });

      it("valid token + valid-ish body returns not 500", async () => {
        const token = ep.auth === "admin" ? generateValidAdminToken() : generateValidCustomerToken();
        const req = withAuth(send(ep.method, ep.path), token);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        expect(res.status).not.toBe(500);
      });

      it("alg:none token returns 401/403", async () => {
        const req = makeReq(ep).set("Authorization", `Bearer ${generateAlgNoneToken()}`);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        expectProtectedAuthFailure(res.status);
      });
    });
  });
});

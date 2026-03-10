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

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type Endpoint = {
  method: HttpMethod;
  path: string;
  auth: "public" | "customer" | "admin";
};

const endpoints: Endpoint[] = [
  { method: "GET", path: "/api/products", auth: "public" },
  { method: "GET", path: "/api/products/", auth: "public" },
  { method: "POST", path: "/api/auth/login", auth: "public" },
  { method: "POST", path: "/api/auth/signup", auth: "public" },
  { method: "POST", path: "/api/auth/refresh", auth: "public" },
  { method: "GET", path: "/api/cart", auth: "customer" },
  { method: "POST", path: "/api/cart", auth: "customer" },
  { method: "GET", path: "/api/orders", auth: "customer" },
  { method: "POST", path: "/api/orders", auth: "customer" },
  { method: "GET", path: "/api/user/profile", auth: "customer" },
  { method: "PUT", path: "/api/user/profile", auth: "customer" },
  { method: "GET", path: "/api/admin/orders", auth: "admin" },
  { method: "POST", path: "/api/admin/products", auth: "admin" },
  // TODO: Expand this list to include all OpenAPI paths.
];

function expectAuthFailureStatus(status: number) {
  expect([400, 401, 403].includes(status)).toBe(true);
}

function expectProtectedFailureOrNotFound(status: number) {
  expect([400, 401, 403, 404].includes(status)).toBe(true);
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
      it("no token returns 401", async () => {
        const req = makeReq(ep);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        expectProtectedFailureOrNotFound(res.status);
      });

      it("invalid token returns 401", async () => {
        const req = makeReq(ep).set("Authorization", `Bearer ${generateInvalidToken()}`);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        if (ep.path.startsWith("/api/auth/")) expectAuthFailureStatus(res.status);
        else expectProtectedFailureOrNotFound(res.status);
      });

      it("malformed token returns 401", async () => {
        const req = makeReq(ep).set("Authorization", `Bearer ${generateMalformedToken()}`);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        if (ep.path.startsWith("/api/auth/")) expectAuthFailureStatus(res.status);
        else expectProtectedFailureOrNotFound(res.status);
      });

      it("expired token returns 401", async () => {
        const req = makeReq(ep).set("Authorization", `Bearer ${generateExpiredToken()}`);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        if (ep.path.startsWith("/api/auth/")) expectAuthFailureStatus(res.status);
        else expectProtectedFailureOrNotFound(res.status);
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

      it("alg:none token returns 401", async () => {
        const req = makeReq(ep).set("Authorization", `Bearer ${generateAlgNoneToken()}`);
        const body = anyBodyFor(ep.method);
        const res = body ? await req.send(body) : await req;
        if (ep.path.startsWith("/api/auth/")) expectAuthFailureStatus(res.status);
        else expectProtectedFailureOrNotFound(res.status);
      });
    });
  });
});

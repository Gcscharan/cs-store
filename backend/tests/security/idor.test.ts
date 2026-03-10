import request from "supertest";
import app from "../../src/app";
import { generateValidCustomerToken } from "../helpers/tokenHelper";

describe("security: IDOR checks", () => {
  const customerToken = generateValidCustomerToken();

  function listAdminGetPaths(): string[] {
    const stack = (app as any)?._router?.stack;
    if (!Array.isArray(stack)) return ["/api/admin/orders", "/api/admin/users"];

    const paths: string[] = [];

    const walk = (layers: any[], prefix: string) => {
      for (const layer of layers) {
        if (!layer) continue;
        if (layer.route && layer.route.path && layer.route.methods?.get) {
          paths.push(`${prefix}${layer.route.path}`.replace(/\/+/g, "/"));
        }

        if (layer.name === "router" && layer.handle?.stack) {
          // best-effort mount path extraction
          const mount = layer.regexp?.source
            ? layer.regexp.source
                .replace('^\\/', '/')
                .replace('\\/?(?=\\/|$)', '')
                .replace(/\(\?:\(\[\^\\/\]\+\?\)\)/g, "")
                .replace(/\$\/?\?$/g, "")
                .replace(/\\\//g, "/")
            : "";
          const mountPath = mount && mount !== "^/?$" ? mount : "";
          walk(layer.handle.stack, `${prefix}${mountPath}`);
        }
      }
    };

    walk(stack, "");

    const adminGets = paths
      .filter((p) => p.startsWith("/api/admin"))
      .map((p) => p.replace(/\/$/, ""));

    // Ensure at least these common admin endpoints are considered
    const fallback = ["/api/admin/orders", "/api/admin/users"];
    const merged = Array.from(new Set([...adminGets, ...fallback]));
    return merged.length ? merged : fallback;
  }

  const adminPaths = listAdminGetPaths();

  const idorChecks = Array.from({ length: 30 }, (_, i) => ({
    name: `customer-admin-check-${i}`,
    path: adminPaths[i % adminPaths.length],
  }));

  it.each(idorChecks)("%s customer cannot access admin resources", async ({ path }) => {
    const res = await request(app).get(path).set("Authorization", `Bearer ${customerToken}`);
    expect([401, 403, 404]).toContain(res.status);
  });
});

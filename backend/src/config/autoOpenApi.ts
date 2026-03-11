import { Express } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import listEndpoints from "express-list-endpoints";

export function generateOpenApiSpec(app: Express) {
  const endpoints = (listEndpoints(app) as any[]) || [];

  const paths: Record<string, any> = {};
  for (const ep of endpoints) {
    const p = String(ep.path || "");
    if (!p) continue;

    const methods: string[] = Array.isArray(ep.methods) ? ep.methods : [];
    if (!paths[p]) paths[p] = {};

    for (const m of methods) {
      const method = String(m || "").toLowerCase();
      if (!method) continue;

      paths[p][method] = {
        summary: `${method.toUpperCase()} ${p}`,
        responses: {
          "200": { description: "OK" },
          "400": { description: "Bad Request" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Not Found" },
          "500": { description: "Server Error" },
        },
      };
    }
  }

  const spec = swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "VyaparSetu API",
        version: "0.0.0",
      },
      servers: [{ url: "http://localhost:5001" }],
      paths,
    },
    apis: [],
  });

  return spec;
}

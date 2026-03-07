/// <reference types="vitest" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(() => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("/src/pages/HomePage")) return "page-home";
            if (id.includes("/src/pages/ProductsPage") || id.includes("/src/pages/SearchResultsPage")) return "page-products";
            if (id.includes("/src/pages/ProductDetailPage")) return "page-product-detail";
            if (id.includes("/src/pages/CartPage")) return "page-cart";
            if (id.includes("/src/pages/CheckoutPage")) return "page-checkout";
            if (id.includes("/src/pages/OrdersPage") || id.includes("/src/pages/Order")) return "page-orders";
            if (id.includes("/src/pages/ProfilePage") || id.includes("/src/pages/Account")) return "page-account";
            if (id.includes("/src/pages/Admin") || id.includes("/src/pages/Admin")) return "page-admin";
            if (id.includes("/src/admin/ops")) return "page-admin-ops";
            if (id.includes("/src/pages/Delivery")) return "page-delivery";
            return undefined;
          },
        },
      },
    },
    test: {
      globals: true,
      environment: "node",
      include: ["src/test/logic/**/*.test.ts"],
      exclude: ["tests/**"],
      coverage: {
        provider: "v8",
        reporter: ["text"],
        reportsDirectory: "./coverage",

        include: [
          "src/utils/**/*.ts",
          "src/hooks/**/*.ts",
          "src/store/**/*.ts",
          "src/config/**/*.ts",
        ],

        exclude: [
          "src/pages/**",
          "src/components/**",
          "src/test/**",
          "tests/**",
          "**/*.d.ts",
        ],

        all: false,

        thresholds: {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
      },
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        "/api": {
          target: "http://localhost:5001",
          changeOrigin: true,
        },
      },
      watch: {
        usePolling: false,
        ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
      },
    },
  };
});

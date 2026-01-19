import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(() => {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  return {
    plugins: [react()],
    define: {
      "process.env.NEXT_PUBLIC_API_BASE_URL": JSON.stringify(apiBaseUrl),
      "process.env": JSON.stringify({ NEXT_PUBLIC_API_BASE_URL: apiBaseUrl }),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
    server: {
      port: 3000,
      host: true,
      watch: {
        usePolling: false,
        ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
      },
      proxy: apiBaseUrl
        ? {
            "/api": {
              target: apiBaseUrl,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
  };
});

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
    },
  };
});

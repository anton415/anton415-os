import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.ts"]
  }
});

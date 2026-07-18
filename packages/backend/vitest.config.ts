import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Exclude dist to avoid running stale compiled copies
    exclude: ["dist/**", "node_modules/**"],
  },
});

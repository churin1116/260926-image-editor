import { defineConfig } from "vitest/config";

export default defineConfig({
  // e2e/ holds Playwright specs, which Vitest must not try to run.
  test: { include: ["src/**/*.test.ts"] },
});

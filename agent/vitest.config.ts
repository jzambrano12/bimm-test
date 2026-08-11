import { defineConfig } from "vitest/config";

// Explicit config so vitest does not walk up and inherit the boilerplate's
// React + jsdom setup. The agent is a Node CLI; it shares no test environment
// with the app it generates.
export default defineConfig({
  test: {
    root: import.meta.dirname,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

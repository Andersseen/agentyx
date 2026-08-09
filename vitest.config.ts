import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agentyx/adapters": new URL("./packages/adapters/src/index.ts", import.meta.url).pathname,
      "@agentyx/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    coverage: {
      reportsDirectory: "coverage",
    },
    include: ["packages/**/*.test.ts"],
  },
});

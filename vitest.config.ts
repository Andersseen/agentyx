import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agentyx/adapters": fileURLToPath(
        new URL("./packages/adapters/src/index.ts", import.meta.url),
      ),
      "@agentyx/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
    },
  },
  test: {
    coverage: {
      reportsDirectory: "coverage",
    },
    include: ["packages/**/*.test.ts"],
  },
});

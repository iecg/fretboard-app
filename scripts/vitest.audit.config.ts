import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@fretflow/core": fileURLToPath(new URL("../packages/core/src/index.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["scripts/**/*.ts"],
    exclude: ["scripts/vitest.audit.config.ts"],
    reporter: ["verbose"],
  },
});

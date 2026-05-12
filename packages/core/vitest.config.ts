import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      thresholds: {
        statements: 85,
        branches: 72,
        functions: 78,
        lines: 87,
      },
    },
  },
});

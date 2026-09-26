import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const serverOnlyStub = fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url));

export default defineConfig({
  resolve: { alias: { "server-only": serverOnlyStub } },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["packages/*/src/**/*.test.ts", "apps/web/src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          testTimeout: 30000,
          hookTimeout: 60000,
          fileParallelism: false,
        },
      },
    ],
  },
});

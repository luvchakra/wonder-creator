import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: "apps/web/" } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Playwright fixtures call `use()`, which is not a React hook.
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  globalIgnores(["**/.next/**", "**/out/**", "**/build/**", "**/next-env.d.ts", "**/node_modules/**", "coverage/**", "playwright-report/**", "test-results/**", "packages/db/src/database.types.ts"]),
]);

export default eslintConfig;

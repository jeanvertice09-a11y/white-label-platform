import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.output/**",
      "**/coverage/**",
      "supabase/migrations/**",
      "**/*.sql",
      "**/*.gen.ts",
      "**/fixtures/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Requisito do produto: arquivos de aplicação <= 300 linhas úteis.
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      // Funções longas geram warning (~60 linhas).
      "max-lines-per-function": ["warn", { max: 60, skipBlankLines: true, skipComments: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/*.mjs", "**/*.cjs", "playwright.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["apps/web/src/routes/**/*", "apps/web/src/lib/client-guard.ts", "apps/web/src/router.tsx", "apps/web/src/main.tsx"],
    rules: {
      // Fronteira server/client: bundle client nunca importa entry server.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tanstack/react-start/server",
              message: "Entry server-only: use apenas em apps/web/src/lib/server/**.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts", "packages/*/src/**/*.test.ts"],
    rules: {
      "max-lines-per-function": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);

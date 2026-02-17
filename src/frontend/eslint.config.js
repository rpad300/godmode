/**
 * Purpose:
 *   ESLint flat-config for the GodMode React/TypeScript frontend.
 *
 * Responsibilities:
 *   - Extend the recommended ESLint and typescript-eslint rule sets
 *   - Enforce React Hooks rules (exhaustive-deps, rules-of-hooks)
 *   - Warn on non-component exports via react-refresh plugin
 *   - Block imports from legacy frontend backup directories
 *
 * Key dependencies:
 *   - typescript-eslint: TypeScript-aware linting
 *   - eslint-plugin-react-hooks: React Hooks correctness checks
 *   - eslint-plugin-react-refresh: Vite HMR compatibility checks
 *
 * Notes:
 *   - @typescript-eslint/no-unused-vars is disabled to reduce noise during
 *     rapid prototyping; re-enable for stricter enforcement
 *   - The no-restricted-imports rule prevents accidental references to
 *     frontend_backup* or frontend-legacy* directories (CI guardrail)
 *   - dist/ is ignored entirely
 */
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["*frontend_backup*", "*frontend-legacy*"],
            message: "Do not import from the legacy frontend backup. Use src/frontend/ components only.",
          },
        ],
      }],
    },
  },
);

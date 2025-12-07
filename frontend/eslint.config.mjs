import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint configuration for YallaBusinessAdmin Frontend
 * Based on Code Quality Audit framework
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ═══════════════════════════════════════════════════════════════════════════════
  // Custom Rules for Code Quality
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    rules: {
      // ─────────────────────────────────────────────────────────────────────────
      // TypeScript Specific Rules (without type-checking)
      // ─────────────────────────────────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Disabled: requires type-checking
      // "@typescript-eslint/prefer-nullish-coalescing": "warn",
      // "@typescript-eslint/prefer-optional-chain": "warn",

      // ─────────────────────────────────────────────────────────────────────────
      // React/Next.js Rules
      // ─────────────────────────────────────────────────────────────────────────
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-no-target-blank": "error",
      "react/jsx-key": "error",
      "react/no-unescaped-entities": "warn",
      "react/self-closing-comp": [
        "warn",
        {
          component: true,
          html: true,
        },
      ],
      "react/jsx-curly-brace-presence": [
        "warn",
        { props: "never", children: "never" },
      ],

      // ─────────────────────────────────────────────────────────────────────────
      // React Hooks Rules
      // ─────────────────────────────────────────────────────────────────────────
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ─────────────────────────────────────────────────────────────────────────
      // Code Quality Rules (from Audit Framework)
      // ─────────────────────────────────────────────────────────────────────────
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-debugger": "warn",
      "no-alert": "warn",
      "no-var": "error",
      "prefer-const": "warn",
      "prefer-template": "warn",
      "no-nested-ternary": "warn",
      eqeqeq: ["error", "always", { null: "ignore" }],
      curly: ["warn", "multi-line"],
      "no-throw-literal": "error",
      "prefer-promise-reject-errors": "error",
      "no-return-await": "warn",

      // ─────────────────────────────────────────────────────────────────────────
      // Naming Conventions (from Audit Framework)
      // ─────────────────────────────────────────────────────────────────────────
      camelcase: [
        "warn",
        {
          properties: "never",
          ignoreDestructuring: true,
          allow: ["^[A-Z]"],
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Ignores
  // ═══════════════════════════════════════════════════════════════════════════════
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "*.config.js",
    "*.config.mjs",
    "tests/**",
    "e2e/**",
  ]),
]);

export default eslintConfig;

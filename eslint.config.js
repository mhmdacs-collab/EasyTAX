import eslint from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";

// Use @typescript-eslint/eslint-plugin flat configs directly (no typescript-eslint wrapper needed)
const strictTypeChecked = /** @type {import("eslint").Linter.Config[]} */ (
  tsPlugin.configs["flat/strict-type-checked"]
);

export default [
  eslint.configs.recommended,
  ...strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
    },
  },
  {
    ignores: ["**/dist/**", "**/build/**", "**/node_modules/**"],
  },
];

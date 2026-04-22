import stylistic from "@stylistic/eslint-plugin";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist",
      "node_modules",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      "**/*.ts",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "@stylistic/array-bracket-newline": [
        "error",
        "consistent",
      ],
      "@stylistic/array-element-newline": [
        "error",
        "consistent",
      ],
      "@stylistic/comma-dangle": [
        "error",
        "always-multiline",
      ],
      "@stylistic/function-call-argument-newline": [
        "error",
        "consistent",
      ],
      "@stylistic/function-paren-newline": [
        "error",
        "multiline",
      ],
      "@stylistic/indent": [
        "error",
        2,
        {
          MemberExpression: 1,
          SwitchCase: 1,
        },
      ],
      "@stylistic/member-delimiter-style": [
        "error",
        {
          multiline: {
            delimiter: "semi",
            requireLast: true,
          },
          singleline: {
            delimiter: "semi",
            requireLast: false,
          },
        },
      ],
      "@stylistic/newline-per-chained-call": [
        "error",
        {
          ignoreChainWithDepth: 1,
        },
      ],
      "@stylistic/object-curly-spacing": [
        "error",
        "always",
      ],
      "@stylistic/quotes": [
        "error",
        "double",
      ],
      "@stylistic/semi": [
        "error",
        "always",
      ],
    },
  },
];

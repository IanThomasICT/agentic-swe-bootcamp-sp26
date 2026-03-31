import markdown from "@eslint/markdown";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    plugins: { markdown },
  },
  {
    // Lint fenced code blocks in markdown files
    files: ["**/*.md"],
    processor: "markdown/markdown",
  },
  {
    // Rules for TS code blocks extracted from markdown
    files: ["**/*.md/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      // Syntax checks only -- snippets are partial so we stay lenient
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      // Catch actual problems
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "warn",
      "no-constant-condition": "warn",
    },
  },
  {
    // Rules for JS code blocks
    files: ["**/*.md/*.js"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
    },
  },
];

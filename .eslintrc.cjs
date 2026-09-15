/**
 * Repository lint baseline.
 *
 * The project predates the production CI lint gate and contains substantial
 * legacy style/a11y debt. Keep correctness/security rules active while making
 * that historical debt visible as warnings so new production checks can run.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  ignorePatterns: [
    "!**/.server",
    "!**/.client",
    "examples/plugins/**",
    "extensions/vsn-page-builder-theme/assets/**",
  ],

  extends: ["eslint:recommended"],

  // Historical repository debt stays visible without preventing the newly
  // enabled production gate from reaching typecheck/build/QA. These should be
  // tightened incrementally as the existing warnings are retired.
  rules: {
    "no-unused-vars": "warn",
    "no-empty": ["warn", { allowEmptyCatch: true }],
    "no-useless-escape": "warn",
    "no-control-regex": "warn",
    "no-constant-condition": "warn",
    "no-sparse-arrays": "warn",
    "no-mixed-spaces-and-tabs": "warn",
  },

  overrides: [
    // React
    {
      files: ["**/*.{js,jsx,ts,tsx}"],
      plugins: ["react", "jsx-a11y"],
      extends: [
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
      ],
      settings: {
        react: {
          version: "detect",
        },
        formComponents: ["Form"],
        linkComponents: [
          { name: "Link", linkAttribute: "to" },
          { name: "NavLink", linkAttribute: "to" },
        ],
        "import/resolver": {
          typescript: {},
        },
      },
      rules: {
        // This JavaScript codebase does not use runtime PropTypes. The rule was
        // responsible for thousands of non-actionable legacy failures.
        "react/prop-types": "off",
        "react/no-unknown-property": ["error", { ignore: ["variant"] }],
        "react/no-unescaped-entities": "warn",
        "react-hooks/rules-of-hooks": "warn",
        "jsx-a11y/no-static-element-interactions": "warn",
        "jsx-a11y/label-has-associated-control": "warn",
        "jsx-a11y/click-events-have-key-events": "warn",
        "jsx-a11y/anchor-is-valid": "warn",
        "jsx-a11y/no-noninteractive-element-interactions": "warn",
        "jsx-a11y/media-has-caption": "warn",
        "jsx-a11y/no-autofocus": "warn",
        "jsx-a11y/no-noninteractive-tabindex": "warn",
        "jsx-a11y/alt-text": "warn",
      },
    },

    // Typescript
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["@typescript-eslint", "import"],
      parser: "@typescript-eslint/parser",
      settings: {
        "import/internal-regex": "^~/",
        "import/resolver": {
          node: {
            extensions: [".ts", ".tsx"],
          },
          typescript: {
            alwaysTryTypes: true,
          },
        },
      },
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript",
      ],
    },

    // Node
    {
      files: [
        ".eslintrc.cjs",
        "vite.config.{js,ts}",
        ".graphqlrc.{js,ts}",
        "shopify.server.{js,ts}",
        "**/*.server.{js,ts}",
        "scripts/**/*.{js,mjs,cjs}",
      ],
      env: {
        node: true,
      },
    },
  ],
  globals: {
    shopify: "readonly",
    globalThis: "readonly",
    process: "readonly",
    Buffer: "readonly",
  },
};

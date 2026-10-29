/**
 * This is intended to be a basic starting point for linting in your app.
 * It relies on recommended configs out of the box for simplicity, but you can
 * and should modify this configuration to best suit your team's needs.
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
    es2022: true,
  },
  ignorePatterns: ["!**/.server", "!**/.client"],

  // Base config
  extends: ["eslint:recommended"],

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
        "react/no-unknown-property": ["error", { ignore: ["variant"] }],
        // The codebase does not use PropTypes; props are validated by schemas/TypeScript.
        "react/prop-types": "off",
        // SearchableSelect is the app-wide replacement for <select>.
        "jsx-a11y/label-has-associated-control": ["error", { controlComponents: ["SearchableSelect", "VsnDateTimePicker", "ColorField"], depth: 3 }],
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
        "react-router.config.js",
        "app/root.jsx",
        "app/routes/**",
        "app/config/**",
        "app/services/**",
        "workers/**",
        "scripts/**",
      ],
      env: {
        node: true,
      },
    },

    // Import attributes (`with { type: "json" }`) need a newer parser than ESLint 8's espree.
    {
      files: [
        "app/services/db-worker-neon.js",
        "app/services/neon-target-policy.js",
        "app/services/shopify-worker-configuration.js",
        "examples/plugins/**/*.{js,jsx}",
      ],
      parser: "@typescript-eslint/parser",
    },
  ],
  globals: {
    shopify: "readonly"
  },
};

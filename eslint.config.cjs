const { defineConfig } = require('eslint/config')
const base = require('@infinitetoken/eslint-config/npm-package')

module.exports = defineConfig([
  ...base,
  {
    ignores: ['**/*.cjs', 'src/__tests__/**']
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  {
    // Repo-specific: the shared preset type-checks every **/*.ts against tsconfig.json,
    // but tsconfig.json only includes src/**, so root-level config files like
    // tsup.config.ts need type-aware parsing turned back off (matches the original
    // config's `files: ['src/**/*.ts']` scoping).
    files: ['tsup.config.ts'],
    languageOptions: {
      parserOptions: {
        project: false
      }
    }
  }
])

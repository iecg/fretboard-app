import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactCompiler from 'eslint-plugin-react-compiler'

export default defineConfig([
  globalIgnores(['dist', 'coverage', '.claude']),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-compiler': reactCompiler,
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // React Compiler bails on code that violates the Rules of React.
      // Surfaced at 'warn' during rollout so CI doesn't break; promoted
      // to 'error' once the codebase is clean (see plan Task 8).
      'react-compiler/react-compiler': 'warn',
    },
  },
  // Set all jsx-a11y rules to 'error' — violations break CI.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      ...Object.fromEntries(
        Object.entries(jsxA11y.configs.recommended.rules).map(([rule, value]) => [
          rule,
          Array.isArray(value) ? ['error', ...value.slice(1)] : 'error',
        ])
      ),
    },
  },
])

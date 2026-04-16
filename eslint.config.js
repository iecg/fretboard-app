import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
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
  },
  // jsx-a11y: accessibility lint rules — all warn in Phase 4 (pre-existing violations).
  // Promote critical rules to 'error' in Phase 5 after primitive a11y work completes.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      // All jsx-a11y recommended rules set to warn so pre-existing violations
      // surface without breaking CI. Promote to 'error' in Phase 5 after all
      // primitives are fixed. See: Phase 4 Plan 04-02.
      ...Object.fromEntries(
        Object.entries(jsxA11y.configs.recommended.rules).map(([rule, value]) => [
          rule,
          Array.isArray(value) ? ['warn', ...value.slice(1)] : 'warn',
        ])
      ),
    },
  },
])

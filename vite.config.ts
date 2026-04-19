/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  base: '/fretboard-app/',
  plugins: [react()],
  css: {
    modules: {
      localsConvention: 'dashes',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: {
      include: /.+/,
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**'],
    // vitest 4.x defaults to updateSnapshot="none" in CI (when CI=true).
    // Override to "new" so missing snapshots are created rather than failing.
    // Snapshots are gitignored because Node 22 (local) and Node 24 (CI) produce
    // slightly different floating-point SVG coordinates.
    snapshotOptions: {
      update: 'new',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary', 'text-summary'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.d.ts',
        'src/main.tsx',
        '**/dist/**',
        '**/build/**',
        'coverage/**',
      ],
      include: ['src/**/*.{ts,tsx}'],
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 65,
        statements: 70,
      },
    },
  },
})

/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

export default defineConfig({
  base: process.env.VITE_MOBILE === 'true' ? './' : '/fretboard-app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@fretflow/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    },
  },
  css: {
    modules: {
      localsConvention: 'dashes',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react-dom|react|scheduler)[\\/]/,
              priority: 3,
            },
            {
              name: 'vendor-motion',
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils|motion)[\\/]/,
              priority: 2,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setup.ts'],
    testTimeout: 15000,
    css: {
      include: /.+/,
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'packages/core/src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**'],
    // Vitest 4 CI defaults to updateSnapshot="none". "new" ensures missing snapshots
    // are written. Snapshots are gitignored as Node 22/24 produce slight SVG differences.
    update: 'new',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary', 'text-summary'],
      exclude: [
        'node_modules/',
        'src/test-utils/',
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

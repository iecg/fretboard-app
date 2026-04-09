/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const version = (() => {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim().replace(/^v/, '')
  } catch {
    return JSON.parse(readFileSync('./package.json', 'utf-8')).version as string
  }
})()

// https://vite.dev/config/
export default defineConfig({
  base: '/fretboard-app/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
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

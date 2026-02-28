import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    isolate: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        '**/__mocks__/**',
        '**/tests/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    include: ['packages/**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'packages/**/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@gamevibe/bot': resolve(__dirname, './packages/bot/src'),
      '@gamevibe/ai-service': resolve(__dirname, './packages/ai-service/src'),
      '@gamevibe/asset-generator': resolve(__dirname, './packages/asset-generator/src'),
      '@gamevibe/game-engine': resolve(__dirname, './packages/game-engine/src'),
      '@gamevibe/web-runtime': resolve(__dirname, './packages/web-runtime/src'),
      '@gamevibe/multiplayer-server': resolve(__dirname, './packages/multiplayer-server/src'),
      '@gamevibe/shared': resolve(__dirname, './packages/shared/src'),
    },
  },
});
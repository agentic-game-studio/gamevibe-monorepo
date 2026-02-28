import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/**/src/**/*.integration.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    testTimeout: 60000, // 1 minute for integration tests
    hookTimeout: 60000,
    pool: 'forks', // Use separate processes for integration tests
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid database conflicts
      },
    },
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
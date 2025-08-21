import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Skip database tests if no database is available
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@neolink/shared': path.resolve(__dirname, '../shared/src'),
      '@neolink/database': path.resolve(__dirname, './src'),
    },
  },
});

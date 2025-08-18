import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@neolink/shared': path.resolve(__dirname, '../shared/src'),
      '@neolink/ai': path.resolve(__dirname, './src'),
    },
  },
});

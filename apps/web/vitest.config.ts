import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@neolink/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@neolink/shared/schemas': path.resolve(
        __dirname,
        '../../packages/shared/src/schemas'
      ),
      '@neolink/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
});

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@neolink/shared': path.resolve(
        __dirname,
        '../../packages/shared/src/index.ts'
      ),
      '@neolink/database': path.resolve(
        __dirname,
        '../../packages/database/src/index.ts'
      ),
      '@neolink/ai': path.resolve(__dirname, '../../packages/ai/src/index.ts'),
    },
  },
});

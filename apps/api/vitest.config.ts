import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./src/test-env.ts', './src/test-setup.ts'],
    testTimeout: 30000, // 增加超时时间到30秒
  },
  resolve: {
    alias: {
      '@neolink/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@neolink/shared/schemas': path.resolve(
        __dirname,
        '../../packages/shared/src/schemas'
      ),
      '@neolink/database': path.resolve(
        __dirname,
        '../../packages/database/src'
      ),
      '@neolink/database/connection': path.resolve(
        __dirname,
        '../../packages/database/src/connection.ts'
      ),
      '@neolink/database/schema': path.resolve(
        __dirname,
        '../../packages/database/src/schema.ts'
      ),
      '@neolink/ai': path.resolve(__dirname, '../../packages/ai/src'),
    },
  },
});

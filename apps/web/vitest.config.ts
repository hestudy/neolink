import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules',
      '.next',
      'dist',
      'src/components/dialogs/EditBookmarkDialog.test.tsx',
      'src/components/dialogs/AddBookmarkDialog.test.tsx',
      'src/components/dialogs/DeleteConfirmDialog.test.tsx',
      'src/app/(auth)/register/__tests__/page.test.tsx',
      'src/app/(auth)/login/__tests__/page.test.tsx',
    ],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: '../../coverage',
      exclude: [
        'node_modules/',
        '.next/',
        'dist/',
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.d.ts',
        'vitest.setup.ts',
        'tailwind.config.js',
        'next.config.js',
      ],
    },
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
  define: {
    global: 'globalThis',
  },
});

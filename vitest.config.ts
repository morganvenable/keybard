import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { bundledLayersPlugin } from './build/paranoid';

// Practice's bundle budgets read the stats the last build left behind, so they run only through
// `npm run check:bundle`, which builds first. Under plain `npm test` the stats could be stale.
const BUNDLE_BUDGETS = 'tests/build/bundle-size.test.ts';
const bundleCheck = process.env.npm_lifecycle_event === 'check:bundle';

export default defineConfig({
  root: __dirname,
  plugins: [react(), bundledLayersPlugin(false, __dirname)],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: resolve(__dirname, 'tests/setup.ts'),
    exclude: bundleCheck ? configDefaults.exclude : [...configDefaults.exclude, BUNDLE_BUDGETS],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: [
        'src/services/utils.ts',
        'src/services/key.service.ts',
        'src/services/keyboard.service.ts',
        'src/services/qmk.service.ts'
      ],
      thresholds: {
        branches: 90,
        functions: 75,
        lines: 75,
        statements: 75
      },
      exclude: [
        'node_modules',
        'tests',
        '*.config.ts',
        '*.config.js',
        'dist',
        '.venv',
        'pages'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@types': resolve(__dirname, './src/types'),
      '@services': resolve(__dirname, './src/services'),
      '@contexts': resolve(__dirname, './src/contexts'),
      '@components': resolve(__dirname, './src/components'),
      '@constants': resolve(__dirname, './src/constants')
    }
  }
});
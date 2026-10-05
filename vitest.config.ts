import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: [
        'src/services/utils.ts',
        'src/services/key.service.ts',
        'src/services/vial.service.ts',
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
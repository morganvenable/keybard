import { defineConfig } from 'vitest/config';
import base from './vitest.config';

// Standalone review scope, separate from the editor service coverage gate.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    maxWorkers: 4,
    include: ['tests/practice/**/*.test.{ts,tsx}', 'tests/svalbr/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage/practice',
      thresholds: { lines: 95, statements: 95, functions: 85, branches: 85 },
      include: ['src/svalbr/**/*.{ts,tsx}', 'src/features/practice/**/*.{ts,tsx}'],
      exclude: ['src/features/practice/vendor/**', 'src/svalbr/main.tsx', '**/*.d.ts'],
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}', 'scripts/__tests__/**/*.test.ts'],
    alias: {
      vscode: new URL('./src/extension/__mocks__/vscode.ts', import.meta.url).pathname,
    },
    pool: 'threads',
    testTimeout: 10000,
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    alias: {
      vscode: new URL('./src/extension/__mocks__/vscode.ts', import.meta.url).pathname,
    },
    pool: 'threads',
  },
});

import { beforeAll, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

describe('eslint config', () => {
  let eslint: ESLint;

  beforeAll(() => {
    eslint = new ESLint({ overrideConfigFile: 'eslint.config.mjs' });
  });

  it('webview 與 extension 使用不同 runtime globals', async () => {
    const webviewConfig = await eslint.calculateConfigForFile('src/webview/editor/plugin/PluginCard.tsx');
    const extensionConfig = await eslint.calculateConfigForFile('src/extension/extension.ts');

    expect(webviewConfig.languageOptions.globals).toMatchObject({
      window: false,
      document: false,
    });
    expect(webviewConfig.languageOptions.globals).not.toHaveProperty('process');
    expect(webviewConfig.languageOptions.globals).not.toHaveProperty('Buffer');

    expect(extensionConfig.languageOptions.globals).toMatchObject({
      process: false,
      Buffer: false,
    });
    expect(extensionConfig.languageOptions.globals).not.toHaveProperty('window');
    expect(extensionConfig.languageOptions.globals).not.toHaveProperty('document');
  });

  it('webview 仍啟用 react hooks 與 jsx a11y 規則', async () => {
    const pluginCardConfig = await eslint.calculateConfigForFile('src/webview/editor/plugin/PluginCard.tsx');
    const virtualScrollConfig = await eslint.calculateConfigForFile('src/webview/hooks/useVirtualScroll.ts');

    const toSeverity = (rule: unknown): number | undefined => {
      if (typeof rule === 'string') return rule === 'error' ? 2 : rule === 'warn' ? 1 : 0;
      if (Array.isArray(rule) && typeof rule[0] === 'number') return rule[0];
      return undefined;
    };

    expect(toSeverity(pluginCardConfig.rules['jsx-a11y/click-events-have-key-events'])).toBe(2);
    expect(toSeverity(virtualScrollConfig.rules['react-hooks/exhaustive-deps'])).toBe(2);
  });
});

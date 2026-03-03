import { describe, expect, it } from 'vitest';
import { getWebviewHtml } from '../webviewHtml';

describe('getWebviewHtml', () => {
  it('輸出帶有 mode、locale、CSP nonce 與資源 URI 的 HTML', () => {
    const webview = {
      cspSource: 'vscode-webview-resource:',
      asWebviewUri: (uri: { fsPath: string }) => ({
        toString: () => `webview:${uri.fsPath}`,
      }),
    };

    const html = getWebviewHtml(
      webview as never,
      { fsPath: '/extension' } as never,
      'plugin',
      'ja',
    );

    expect(html).toContain('data-mode="plugin"');
    expect(html).toContain('data-locale="ja"');
    expect(html).toContain('webview:/extension/dist/webview/index.js');
    expect(html).toContain('webview:/extension/dist/webview/index.css');
    expect(html).toContain("style-src vscode-webview-resource: 'unsafe-inline';");

    const nonceMatch = html.match(/script-src 'nonce-([0-9a-f]+)'/);
    expect(nonceMatch?.[1]).toBeTruthy();
    expect(html).toContain(`<script nonce="${nonceMatch![1]}" src="webview:/extension/dist/webview/index.js"></script>`);
  });
});

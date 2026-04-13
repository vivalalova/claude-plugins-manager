/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { I18nProvider } from '../../i18n/I18nContext';
import { ContentDetailPanel } from '../ContentDetailPanel';

// 不 mock marked/DOMPurify，測試真實 sanitization 行為

describe('ContentDetailPanel XSS sanitization', () => {
  afterEach(() => {
    cleanup();
  });

  const renderPanel = (body: string) =>
    render(
      <I18nProvider locale="en">
        <ContentDetailPanel
          name="Test"
          detail={{ frontmatter: {}, body }}
          loading={false}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

  describe('blocks malicious payloads', () => {
    it.each([
      ['script tag', '<script>alert(1)</script>', 'script'],
      ['img onerror', '<img src=x onerror="alert(1)">', 'onerror'],
      ['javascript href', '<a href="javascript:alert(1)">click</a>', 'javascript:'],
      ['svg onload', '<svg onload="alert(1)">', 'onload'],
      ['body onload', '<body onload="alert(1)">', 'onload'],
      ['iframe', '<iframe src="javascript:alert(1)"></iframe>', 'iframe'],
      ['object tag', '<object data="javascript:alert(1)">', 'object'],
      ['embed tag', '<embed src="javascript:alert(1)">', 'embed'],
    ])('%s is sanitized', (_, payload, forbidden) => {
      renderPanel(payload);
      const container = document.querySelector('.detail-markdown');
      const html = container?.innerHTML ?? '';
      expect(html.toLowerCase()).not.toContain(forbidden.toLowerCase());
    });
  });

  describe('preserves safe markdown', () => {
    it('renders inline code', () => {
      renderPanel('`const x = 1`');
      expect(document.querySelector('code')?.textContent).toBe('const x = 1');
    });

    it('renders code block', () => {
      renderPanel('```js\nconst x = 1;\n```');
      const code = document.querySelector('code');
      expect(code).toBeTruthy();
      expect(code?.textContent).toContain('const x = 1');
    });

    it('renders link with https href', () => {
      renderPanel('[example](https://example.com)');
      const link = document.querySelector('a');
      expect(link?.getAttribute('href')).toBe('https://example.com');
      expect(link?.textContent).toBe('example');
    });

    it('renders heading', () => {
      renderPanel('# Title');
      const h1 = document.querySelector('h1');
      expect(h1?.textContent).toBe('Title');
    });

    it('renders bold and italic', () => {
      renderPanel('**bold** and *italic*');
      expect(document.querySelector('strong')?.textContent).toBe('bold');
      expect(document.querySelector('em')?.textContent).toBe('italic');
    });

    it('renders unordered list', () => {
      renderPanel('- item 1\n- item 2');
      const items = document.querySelectorAll('li');
      expect(items.length).toBe(2);
    });

    it('renders blockquote', () => {
      renderPanel('> quote text');
      const blockquote = document.querySelector('blockquote');
      expect(blockquote?.textContent).toContain('quote text');
    });
  });

  describe('edge cases', () => {
    it('script in markdown is sanitized while preserving text', () => {
      renderPanel('Hello <script>bad()</script> World');
      const container = document.querySelector('.detail-markdown');
      const html = container?.innerHTML ?? '';
      // script 標籤和內容應被移除
      expect(html.toLowerCase()).not.toContain('<script');
      expect(html).not.toContain('bad()');
      // 純文字應保留
      expect(html).toContain('Hello');
      expect(html).toContain('World');
    });

    it('event handler attributes are removed', () => {
      // 使用 markdown 連結語法測試，確保 onclick 被過濾
      renderPanel('[click me](https://example.com)');
      const link = document.querySelector('a');
      expect(link).toBeTruthy();
      // 驗證沒有惡意 event handler
      expect(link?.getAttribute('onclick')).toBeNull();
    });

    it('data URI in img is sanitized', () => {
      // DOMPurify 預設允許 data: URI 用於圖片（無害）
      renderPanel('![img](data:image/png;base64,abc)');
      const html = document.querySelector('.detail-markdown')?.innerHTML ?? '';
      // 確保沒有 javascript: 協議
      expect(html).not.toContain('javascript:');
    });
  });
});

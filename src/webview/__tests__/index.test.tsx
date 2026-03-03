/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createRootMock, renderMock } = vi.hoisted(() => {
  const renderMock = vi.fn();
  const createRootMock = vi.fn(() => ({ render: renderMock }));
  return { createRootMock, renderMock };
});

describe('webview bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
    vi.doMock('react-dom/client', () => ({
      createRoot: createRootMock,
    }));
    vi.doMock('../App', () => ({
      App: 'mock-app',
    }));
  });

  it('uses root dataset mode and locale when rendering the app', async () => {
    document.body.innerHTML = '<div id="root" data-mode="plugin" data-locale="zh-TW"></div>';

    await import('../index');

    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    const [appElement] = renderMock.mock.calls[0];
    expect(appElement.props).toMatchObject({ mode: 'plugin', locale: 'zh-TW' });
  });

  it('falls back to sidebar mode and en locale when dataset attributes are missing', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import('../index');

    const [appElement] = renderMock.mock.calls[0];
    expect(appElement.props).toMatchObject({ mode: 'sidebar', locale: 'en' });
  });

  it('fails fast when the root element does not exist', async () => {
    await expect(import('../index')).rejects.toThrow('Root element not found');
    expect(createRootMock).not.toHaveBeenCalled();
  });
});

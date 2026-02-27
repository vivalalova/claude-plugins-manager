/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

/* ── Mock vscode bridge ── */
const { mockSendRequest, mockOnPushMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
}));
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
  getViewState: (_key: string, fallback: unknown) => fallback,
  setViewState: () => {},
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

import { PluginPage } from '../PluginPage';
import { ToastProvider } from '../../../components/Toast';
import type { PluginListResponse } from '../../../../shared/types';

const renderPage = () => renderWithI18n(<ToastProvider><PluginPage /></ToastProvider>);

const emptyResponse: PluginListResponse = {
  installed: [],
  available: [],
  marketplaceSources: {},
};

describe('PluginPage accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'plugin.listAvailable') return Promise.resolve(emptyResponse);
      if (msg.type === 'workspace.getFolders') return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  afterEach(cleanup);

  it('search input 有 aria-label="Search plugins..."', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Loading plugins...')).toBeNull();
    });

    const searchInput = screen.getByRole('textbox', { name: 'Search plugins...' });
    expect(searchInput).toBeTruthy();
    expect(searchInput.getAttribute('aria-label')).toBe('Search plugins...');
  });

  it('translate dialog 有 role="dialog" + aria-modal + aria-labelledby', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Loading plugins...')).toBeNull();
    });

    // 開啟 translate dialog
    fireEvent.click(screen.getByText('Translate'));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(document.getElementById(titleId!)!.textContent).toBe('Translate');
  });

  it('translate dialog form labels 關聯 input', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Loading plugins...')).toBeNull();
    });

    fireEvent.click(screen.getByText('Translate'));

    // Email label → htmlFor 對應 input id
    const emailLabel = screen.getByText('Email (MyMemory API)');
    const emailInput = screen.getByPlaceholderText('your@email.com');
    expect(emailLabel.getAttribute('for')).toBe(emailInput.id);

    // Language label → htmlFor 對應 select id
    const langLabel = screen.getByText('Language');
    const langSelect = langLabel.closest('.form-row')!.querySelector('select')!;
    expect(langLabel.getAttribute('for')).toBe(langSelect.id);
  });

  it('translate dialog Escape 關閉', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Loading plugins...')).toBeNull();
    });

    fireEvent.click(screen.getByText('Translate'));
    expect(screen.getByRole('dialog')).toBeTruthy();

    // Escape
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

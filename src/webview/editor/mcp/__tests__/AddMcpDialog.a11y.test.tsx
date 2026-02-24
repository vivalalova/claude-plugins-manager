/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const mockSendRequest = vi.fn();
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: vi.fn(() => () => {}),
}));

import { AddMcpDialog } from '../AddMcpDialog';

describe('AddMcpDialog accessibility', () => {
  const onAdded = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendRequest.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('role="dialog" + aria-modal + aria-labelledby', () => {
    renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(document.getElementById(titleId!)!.textContent).toBe('Add MCP Server');
  });

  it('form labels 關聯 input（htmlFor/id）', () => {
    renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

    // Name label → htmlFor 對應 input id
    const nameLabel = screen.getByText('Name');
    const nameInput = screen.getByPlaceholderText('my-server');
    expect(nameLabel.getAttribute('for')).toBe(nameInput.id);

    // Command / URL label → htmlFor 對應 input id
    const cmdLabel = screen.getByText('Command / URL');
    const cmdInput = screen.getByPlaceholderText('npx my-mcp-server or https://...');
    expect(cmdLabel.getAttribute('for')).toBe(cmdInput.id);
  });

  it('Escape 關閉 dialog', () => {
    renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('form labels 包含 Transport 和 Scope', () => {
    renderWithI18n(<AddMcpDialog onAdded={onAdded} onCancel={onCancel} />);

    // Transport label → 關聯 select
    const transportLabel = screen.getByText('Transport');
    const transportSelect = transportLabel.closest('.form-row')!.querySelector('select')!;
    expect(transportLabel.getAttribute('for')).toBe(transportSelect.id);

    // Scope label → 關聯 select
    const scopeLabel = screen.getByText('Scope');
    const scopeSelect = scopeLabel.closest('.form-row')!.querySelector('select')!;
    expect(scopeLabel.getAttribute('for')).toBe(scopeSelect.id);
  });
});

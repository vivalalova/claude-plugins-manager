/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { ScopePicker } from '../ScopePicker';

describe('ScopePicker', () => {
  const onInstall = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('開啟 dropdown 後可安裝到 global scope', () => {
    renderWithI18n(<ScopePicker installing={false} hasWorkspace onInstall={onInstall} />);

    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    fireEvent.click(screen.getByRole('button', { name: 'Global' }));

    expect(onInstall).toHaveBeenCalledWith('global');
    expect(screen.queryByRole('button', { name: 'Project' })).toBeNull();
  });

  it('無 workspace 時 project scope disabled，點外面會關閉 dropdown', () => {
    renderWithI18n(<ScopePicker installing={false} hasWorkspace={false} onInstall={onInstall} />);

    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect((screen.getByRole('button', { name: 'Project' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('button', { name: 'Project' })).toBeNull();
  });

  it('installing 狀態禁用按鈕且不顯示 dropdown', () => {
    renderWithI18n(<ScopePicker installing hasWorkspace onInstall={onInstall} />);

    const button = screen.getByRole('button', { name: 'Installing...' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);

    expect(screen.queryByRole('button', { name: 'Global' })).toBeNull();
  });
});

/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BulkEnableScopeDialog } from '../BulkEnableScopeDialog';
import type { PluginScope } from '../../../../shared/types';

const noWorkspace: [] = [];
const withWorkspace = [{ name: 'my-project', path: '/path/to/project' }];

describe('BulkEnableScopeDialog', () => {
  const onScopeChange = vi.fn();
  const onCancel = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('顯示 marketplace 名稱和 item 數量', () => {
    renderWithI18n(
      <BulkEnableScopeDialog
        marketplace="mp1"
        itemCount={5}
        scope="user"
        workspaceFolders={noWorkspace}
        onScopeChange={onScopeChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Enable All — mp1')).toBeTruthy();
    expect(screen.getByText(/5 plugins/)).toBeTruthy();
  });

  it('無 workspace 時只顯示 User scope 按鈕', () => {
    renderWithI18n(
      <BulkEnableScopeDialog
        marketplace="mp1"
        itemCount={3}
        scope="user"
        workspaceFolders={noWorkspace}
        onScopeChange={onScopeChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('User')).toBeTruthy();
    expect(screen.queryByText('Project')).toBeNull();
    expect(screen.queryByText('Local')).toBeNull();
  });

  it('有 workspace 時顯示三個 scope 按鈕', () => {
    renderWithI18n(
      <BulkEnableScopeDialog
        marketplace="mp1"
        itemCount={3}
        scope="user"
        workspaceFolders={withWorkspace}
        onScopeChange={onScopeChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('User')).toBeTruthy();
    expect(screen.getByText('Project')).toBeTruthy();
    expect(screen.getByText('Local')).toBeTruthy();
  });

  it('點擊 scope 按鈕 → onScopeChange 帶正確 scope', () => {
    renderWithI18n(
      <BulkEnableScopeDialog
        marketplace="mp1"
        itemCount={3}
        scope="user"
        workspaceFolders={withWorkspace}
        onScopeChange={onScopeChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByText('Project'));
    expect(onScopeChange).toHaveBeenCalledWith('project' as PluginScope);
  });

  it('Cancel 按鈕 → onCancel', () => {
    renderWithI18n(
      <BulkEnableScopeDialog
        marketplace="mp1"
        itemCount={3}
        scope="user"
        workspaceFolders={noWorkspace}
        onScopeChange={onScopeChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Enable All 按鈕 → onConfirm', () => {
    renderWithI18n(
      <BulkEnableScopeDialog
        marketplace="mp1"
        itemCount={3}
        scope="user"
        workspaceFolders={noWorkspace}
        onScopeChange={onScopeChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByText('Enable All'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('點擊 overlay 背景 → onCancel', () => {
    const { container } = renderWithI18n(
      <BulkEnableScopeDialog
        marketplace="mp1"
        itemCount={3}
        scope="user"
        workspaceFolders={noWorkspace}
        onScopeChange={onScopeChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const overlay = container.querySelector('.confirm-overlay')!;
    fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('active scope 有 filter-chip--active class', () => {
    const { container } = renderWithI18n(
      <BulkEnableScopeDialog
        marketplace="mp1"
        itemCount={3}
        scope="project"
        workspaceFolders={withWorkspace}
        onScopeChange={onScopeChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const chips = container.querySelectorAll('.filter-chip');
    const projectChip = [...chips].find((c) => c.textContent === 'Project');
    expect(projectChip?.className).toContain('filter-chip--active');

    const userChip = [...chips].find((c) => c.textContent === 'User');
    expect(userChip?.className).not.toContain('filter-chip--active');
  });

  it('ESC 鍵 → onCancel', () => {
    const { container } = renderWithI18n(
      <BulkEnableScopeDialog
        marketplace="mp1"
        itemCount={3}
        scope="user"
        workspaceFolders={noWorkspace}
        onScopeChange={onScopeChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const dialog = container.querySelector('.confirm-dialog')!;
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('dialog 有 aria-labelledby 指向 title', () => {
    const { container } = renderWithI18n(
      <BulkEnableScopeDialog
        marketplace="mp1"
        itemCount={3}
        scope="user"
        workspaceFolders={noWorkspace}
        onScopeChange={onScopeChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const dialog = container.querySelector('[role="dialog"]')!;
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(labelledById).toBeTruthy();
    const titleEl = container.querySelector(`[id="${labelledById}"]`)!;
    expect(titleEl.textContent).toContain('Enable All — mp1');
  });
});

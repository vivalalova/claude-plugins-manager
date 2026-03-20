/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { I18nProvider } from '../../../i18n/I18nContext';
import { AddSkillDialog, RemoveConfirmDialog } from '../SkillDialogs';

describe('AddSkillDialog', () => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('關閉時不渲染任何內容', () => {
    renderWithI18n(
      <AddSkillDialog
        open={false}
        adding={false}
        hasWorkspace
        cachedAgents={['claude-code']}
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('空白 source 提交時顯示驗證錯誤且不送出', () => {
    renderWithI18n(
      <AddSkillDialog
        open
        adding={false}
        hasWorkspace
        cachedAgents={['claude-code']}
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Source is required')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('支援 initialSource、scope 與隱藏 agents 一起送出', () => {
    renderWithI18n(
      <AddSkillDialog
        open
        adding={false}
        hasWorkspace
        cachedAgents={['claude-code']}
        initialSource="  owner/repo  "
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );

    expect((screen.getByPlaceholderText('owner/repo or GitHub URL') as HTMLInputElement).value).toBe('  owner/repo  ');

    fireEvent.click(screen.getByRole('radio', { name: 'Project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show all agents...' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Amp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [source, scope, agents] = onSubmit.mock.calls[0] as [string, string, string[]];
    expect(source).toBe('owner/repo');
    expect(scope).toBe('project');
    expect(agents).toEqual(expect.arrayContaining(['claude-code', 'amp']));
  });

  it('無 workspace 時 project scope disabled，重新開啟會重置驗證與 source', () => {
    const { rerender } = render(
      <I18nProvider locale="en">
        <AddSkillDialog
          open
          adding={false}
          hasWorkspace={false}
          cachedAgents={['claude-code']}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      </I18nProvider>,
    );

    expect((screen.getByRole('radio', { name: 'Project' }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Source is required')).toBeTruthy();

    rerender(
      <I18nProvider locale="en">
        <AddSkillDialog
          open={false}
          adding={false}
          hasWorkspace={false}
          cachedAgents={['claude-code']}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      </I18nProvider>,
    );

    rerender(
      <I18nProvider locale="en">
        <AddSkillDialog
          open
          adding={false}
          hasWorkspace={false}
          cachedAgents={['claude-code']}
          initialSource="fresh/source"
          onSubmit={onSubmit}
          onClose={onClose}
        />
      </I18nProvider>,
    );

    expect(screen.queryByText('Source is required')).toBeNull();
    expect((screen.getByPlaceholderText('owner/repo or GitHub URL') as HTMLInputElement).value).toBe('fresh/source');
  });
});

describe('RemoveConfirmDialog', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('顯示 skill 名稱與 scope，並正確觸發 confirm/cancel', () => {
    renderWithI18n(
      <RemoveConfirmDialog
        skillName="lint-skill"
        skillScope="global"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('Remove "lint-skill" from global?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import { CompanyAnnouncementsEditor } from '../CompanyAnnouncementsEditor';

vi.mock('../../../../vscode', () => ({ vscode: { postMessage: vi.fn() } }));

const mockAddToast = vi.fn();
vi.mock('../../../../components/Toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../components/Toast')>();
  return {
    ...actual,
    useToast: () => ({ addToast: mockAddToast }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderEditor = (
  announcements: string[] = [],
  onSave = vi.fn().mockResolvedValue(undefined),
) =>
  renderWithI18n(
    <ToastProvider>
      <CompanyAnnouncementsEditor scope="user" announcements={announcements} onSave={onSave} />
    </ToastProvider>,
  );

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('CompanyAnnouncementsEditor — 初始渲染', () => {
  it('無公告時顯示 empty state', async () => {
    renderEditor([]);
    await waitFor(() => {
      expect(screen.getByText('No announcements configured')).toBeTruthy();
    });
  });

  it('顯示已有的公告列表', async () => {
    renderEditor(['Welcome!', 'Read the docs']);
    await waitFor(() => {
      const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
      const readOnlyTextareas = textareas.filter((ta) => ta.readOnly && ta.value !== '');
      const values = readOnlyTextareas.map((ta) => ta.value);
      expect(values).toContain('Welcome!');
      expect(values).toContain('Read the docs');
    });
  });
});

// ---------------------------------------------------------------------------
// 新增
// ---------------------------------------------------------------------------

describe('CompanyAnnouncementsEditor — 新增公告', () => {
  it('新增公告 → onSave 被呼叫（含新項目）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(['Existing'], onSave);
    await waitFor(() => screen.getByPlaceholderText('e.g. Welcome to our Claude Code setup!'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome to our Claude Code setup!'), {
      target: { value: 'New Announcement' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('companyAnnouncements', ['Existing', 'New Announcement']);
    });
  });

  it('空白輸入不觸發新增', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor([], onSave);
    await waitFor(() => screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome to our Claude Code setup!'), {
      target: { value: '   ' },
    });
    // Button disabled when trimmed value is empty
    expect((screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('重複公告顯示錯誤訊息', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(['Welcome!'], onSave);
    await waitFor(() => screen.getByPlaceholderText('e.g. Welcome to our Claude Code setup!'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Welcome to our Claude Code setup!'), {
      target: { value: 'Welcome!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByRole('alert').textContent).toContain('Announcement already in list');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// 刪除
// ---------------------------------------------------------------------------

describe('CompanyAnnouncementsEditor — 刪除公告', () => {
  it('刪除公告 → onSave 被呼叫（過濾後陣列）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(['Keep this', 'Delete this'], onSave);
    await waitFor(() => screen.getByRole('button', { name: 'Remove "Delete this"' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove "Delete this"' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('companyAnnouncements', ['Keep this']);
    });
  });

  it('刪除既有公告時保留未送出的草稿輸入', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(['Keep this', 'Delete this'], onSave);
    await waitFor(() => screen.getByPlaceholderText('e.g. Welcome to our Claude Code setup!'));

    const input = screen.getByPlaceholderText('e.g. Welcome to our Claude Code setup!') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Draft announcement' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove "Delete this"' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('companyAnnouncements', ['Keep this']);
    });
    expect(input.value).toBe('Draft announcement');
  });
});

/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

/* ── Mock vscode bridge ── */
const { mockSendRequest, mockOnPushMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
}));
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
}));

import { SkillsPage } from '../SkillsPage';
import { ToastProvider } from '../../../components/Toast';
import type { AgentSkill } from '../../../../shared/types';

const renderPage = () => renderWithI18n(<ToastProvider><SkillsPage /></ToastProvider>);

function makeSkill(name: string, scope: AgentSkill['scope'] = 'global', desc?: string): AgentSkill {
  return {
    name,
    path: `/mock/.claude/skills/${name}`,
    scope,
    agents: ['Claude Code'],
    description: desc,
  };
}

describe('SkillsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('loading 狀態 → skeleton 顯示', () => {
    mockSendRequest.mockImplementation(() => new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('空狀態 → empty state 顯示', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') return [];
      if (req.type === 'workspace.getFolders') return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No skills installed')).toBeTruthy();
    });
  });

  it('有 skills → SkillCard 正確渲染（name、scope badge、agents）', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') {
        return [
          makeSkill('test-skill', 'global', 'A test skill'),
          makeSkill('project-skill', 'project', 'Project skill'),
        ];
      }
      if (req.type === 'workspace.getFolders') return [{ name: 'ws' }];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('test-skill')).toBeTruthy();
      expect(screen.getByText('project-skill')).toBeTruthy();
    });

    // description 顯示
    expect(screen.getByText('A test skill')).toBeTruthy();
    expect(screen.getByText('Project skill')).toBeTruthy();

    // scope badges
    expect(screen.getByText('global')).toBeTruthy();
    expect(screen.getByText('project')).toBeTruthy();

    // agents tags
    const agentTags = screen.getAllByText('Claude Code');
    expect(agentTags.length).toBe(2);

    // sections
    expect(screen.getByText(/Global Skills/)).toBeTruthy();
    expect(screen.getByText(/Project Skills/)).toBeTruthy();
  });

  it('search 過濾 → 依 name 過濾', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') {
        return [
          makeSkill('find-skills', 'global'),
          makeSkill('browser-tool', 'global'),
        ];
      }
      if (req.type === 'workspace.getFolders') return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('find-skills')).toBeTruthy();
      expect(screen.getByText('browser-tool')).toBeTruthy();
    });

    // 搜尋 "find"
    const searchInput = screen.getByPlaceholderText('Search skills...');
    fireEvent.change(searchInput, { target: { value: 'find' } });

    expect(screen.getByText('find-skills')).toBeTruthy();
    expect(screen.queryByText('browser-tool')).toBeNull();
  });

  it('Add Skill dialog → 正確送出 skill.add message', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') return [];
      if (req.type === 'workspace.getFolders') return [{ name: 'ws' }];
      if (req.type === 'skill.add') return undefined;
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No skills installed')).toBeTruthy();
    });

    // 點擊 Add Skill 按鈕（page header 的）
    const addButtons = screen.getAllByText('Add Skill');
    fireEvent.click(addButtons[0]);

    // dialog 出現
    await waitFor(() => {
      expect(screen.getByText('Source')).toBeTruthy();
    });

    // 輸入 source
    const sourceInput = screen.getByPlaceholderText('owner/repo or GitHub URL');
    fireEvent.change(sourceInput, { target: { value: 'vercel-labs/skills' } });

    // 提交
    const confirmBtn = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'skill.add', source: 'vercel-labs/skills', scope: 'global' }),
        90_000,
      );
    });
  });

  it('Remove 按鈕 → confirm dialog → skill.remove message', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') return [makeSkill('my-skill', 'global')];
      if (req.type === 'workspace.getFolders') return [];
      if (req.type === 'skill.remove') return undefined;
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('my-skill')).toBeTruthy();
    });

    // 點擊 Remove
    fireEvent.click(screen.getByText('Remove'));

    // confirm dialog 出現
    await waitFor(() => {
      expect(screen.getByText(/Remove "my-skill"/)).toBeTruthy();
    });

    // 確認
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'skill.remove', name: 'my-skill', scope: 'global' }),
      );
    });
  });

  it('skill.refresh push → 觸發 re-fetch', async () => {
    let pushHandler: ((msg: { type: string }) => void) | null = null;
    mockOnPushMessage.mockImplementation((handler: (msg: { type: string }) => void) => {
      pushHandler = handler;
      return () => {};
    });

    let callCount = 0;
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') {
        callCount++;
        return callCount === 1 ? [] : [makeSkill('new-skill', 'global')];
      }
      if (req.type === 'workspace.getFolders') return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No skills installed')).toBeTruthy();
    });

    // 觸發 push
    pushHandler?.({ type: 'skill.refresh' });

    await waitFor(() => {
      expect(screen.getByText('new-skill')).toBeTruthy();
    });
  });

  it('fetch 失敗 → 顯示 error banner', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'skill.list') throw new Error('Network error');
      if (req.type === 'workspace.getFolders') return [];
      return undefined;
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });
});

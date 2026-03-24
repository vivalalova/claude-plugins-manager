/**
 * @vitest-environment jsdom
 */
 
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { SkillCard } from '../SkillCard';
import type { AgentSkill } from '../../../../shared/types';

vi.mock('../../../vscode', () => ({ vscode: { postMessage: vi.fn() } }));

function makeSkill(overrides: Partial<AgentSkill> = {}): AgentSkill {
  return {
    name: 'lint',
    path: '/tmp/lint',
    scope: 'global',
    agents: ['Claude Code'],
    description: 'Lint all the things',
    ...overrides,
  };
}

describe('SkillCard', () => {
  const onRemove = vi.fn();
  const onOpenFile = vi.fn();
  const onViewDetail = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('顯示 skill 名稱與描述', () => {
    renderWithI18n(
      <SkillCard
        skill={makeSkill()}
        removing={false}
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    expect(screen.getByText('lint')).toBeTruthy();
    expect(screen.getByText('Lint all the things')).toBeTruthy();
  });

  it('無描述時顯示 "No description"', () => {
    renderWithI18n(
      <SkillCard
        skill={makeSkill({ description: undefined })}
        removing={false}
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    expect(screen.getByText('No description')).toBeTruthy();
  });

  it('不顯示 scope badge（section header 已標示）', () => {
    const { container } = renderWithI18n(
      <SkillCard
        skill={makeSkill({ scope: 'global' })}
        removing={false}
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    expect(container.querySelector('.scope-badge')).toBeNull();
  });

  it('點擊 View Detail 觸發 onViewDetail', () => {
    renderWithI18n(
      <SkillCard
        skill={makeSkill()}
        removing={false}
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(onViewDetail).toHaveBeenCalledTimes(1);
  });

  it('點擊 Open File 觸發 onOpenFile', () => {
    renderWithI18n(
      <SkillCard
        skill={makeSkill()}
        removing={false}
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open SKILL.md' }));
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  it('點擊 Remove 觸發 onRemove', () => {
    renderWithI18n(
      <SkillCard
        skill={makeSkill()}
        removing={false}
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('removing 為 true 時 remove 按鈕 disabled 且顯示 "Removing..."', () => {
    renderWithI18n(
      <SkillCard
        skill={makeSkill()}
        removing
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    const button = screen.getByRole('button', { name: 'Removing...' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

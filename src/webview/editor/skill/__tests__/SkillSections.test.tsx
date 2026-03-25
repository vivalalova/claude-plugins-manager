/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { SkillSections } from '../SkillSections';
import type { AgentSkill } from '../../../../shared/types';

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

describe('SkillSections', () => {
  const onRemove = vi.fn();
  const onOpenFile = vi.fn();
  const onViewDetail = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('依 scope 分組並支援 section 摺疊', () => {
    const { container } = renderWithI18n(
      <SkillSections
        globalSkills={[makeSkill({ name: 'lint' })]}
        projectSkills={[makeSkill({ name: 'deploy', scope: 'project', path: '/tmp/deploy' })]}
        removingSkills={new Set()}
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    expect(screen.getByText('Global Skills')).toBeTruthy();
    expect(screen.getByText('Project Skills')).toBeTruthy();

    const globalSection = screen.getByText('Global Skills').closest('.plugin-section');
    const globalBody = globalSection?.querySelector('.section-body');
    // 預設收合
    expect(globalBody?.className).toContain('section-body--collapsed');

    fireEvent.click(screen.getByText('Global Skills').closest('button') as HTMLButtonElement);
    expect(globalBody?.className).not.toContain('section-body--collapsed');

    expect(container.querySelectorAll('.plugin-section')).toHaveLength(2);
  });

  it('卡片操作會把對應 skill 資訊傳回上層，removing skill 顯示 disabled 狀態', () => {
    const skill = makeSkill({ description: undefined });

    renderWithI18n(
      <SkillSections
        globalSkills={[skill]}
        projectSkills={[]}
        removingSkills={new Set()}
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    expect(screen.getByText('No description')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open SKILL.md' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onViewDetail).toHaveBeenCalledWith(skill);
    expect(onOpenFile).toHaveBeenCalledWith('/tmp/lint');
    expect(onRemove).toHaveBeenCalledWith('lint', 'global');
  });

  it('removing skill 會顯示 disabled 按鈕文案', () => {
    renderWithI18n(
      <SkillSections
        globalSkills={[makeSkill()]}
        projectSkills={[]}
        removingSkills={new Set(['global:lint'])}
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    const button = screen.getByRole('button', { name: 'Removing...' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('空 section 不渲染，避免顯示空標題', () => {
    renderWithI18n(
      <SkillSections
        globalSkills={[]}
        projectSkills={[makeSkill({ name: 'deploy', scope: 'project', path: '/tmp/deploy' })]}
        removingSkills={new Set()}
        onRemove={onRemove}
        onOpenFile={onOpenFile}
        onViewDetail={onViewDetail}
      />,
    );

    expect(screen.queryByText('Global Skills')).toBeNull();
    expect(screen.getByText('Project Skills')).toBeTruthy();
  });
});

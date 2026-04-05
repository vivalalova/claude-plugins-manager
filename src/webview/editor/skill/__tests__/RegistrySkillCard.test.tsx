/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { RegistrySkillCard } from '../RegistrySkillCard';
import type { RegistrySkill, SkillScope } from '../../../../shared/types';

vi.mock('../../../vscode', () => ({ vscode: { postMessage: vi.fn() } }));

function makeRegistrySkill(overrides: Partial<RegistrySkill> = {}): RegistrySkill {
  return {
    rank: 1,
    name: 'lint-skill',
    repo: 'owner/lint-skill',
    installs: '9999',
    url: 'https://skills.sh/owner/lint-skill',
    ...overrides,
  };
}

const EMPTY_SCOPES = new Set<SkillScope>();

describe('RegistrySkillCard', () => {
  const onScopeToggle = vi.fn();
  const onViewOnline = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('顯示排名、名稱、repo', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill({ rank: 3 })}
        installedScopes={EMPTY_SCOPES}
        loadingScopes={EMPTY_SCOPES}
        installing={false}
        hasWorkspace
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    expect(screen.getByText('#3')).toBeTruthy();
    expect(screen.getByText('lint-skill')).toBeTruthy();
    expect(screen.getByText('owner/lint-skill')).toBeTruthy();
  });

  it('顯示安裝數', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill({ installs: '42000' })}
        installedScopes={EMPTY_SCOPES}
        loadingScopes={EMPTY_SCOPES}
        installing={false}
        hasWorkspace
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    expect(screen.getByText('42000 installs')).toBeTruthy();
  });

  it('未安裝時 global 和 project checkbox 均未勾選', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill()}
        installedScopes={EMPTY_SCOPES}
        loadingScopes={EMPTY_SCOPES}
        installing={false}
        hasWorkspace
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.every((cb) => !cb.checked)).toBe(true);
  });

  it('global 已安裝時 global checkbox 勾選', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill()}
        installedScopes={new Set<SkillScope>(['global'])}
        loadingScopes={EMPTY_SCOPES}
        installing={false}
        hasWorkspace
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // global label comes first
    expect(checkboxes[0]!.checked).toBe(true);
    expect(checkboxes[1]!.checked).toBe(false);
  });

  it('project 已安裝時 project checkbox 勾選', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill()}
        installedScopes={new Set<SkillScope>(['project'])}
        loadingScopes={EMPTY_SCOPES}
        installing={false}
        hasWorkspace
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0]!.checked).toBe(false);
    expect(checkboxes[1]!.checked).toBe(true);
  });

  it('點擊未勾 global checkbox 呼叫 onScopeToggle(repo, name, global, true)', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill({ repo: 'owner/lint-skill', name: 'lint-skill' })}
        installedScopes={EMPTY_SCOPES}
        loadingScopes={EMPTY_SCOPES}
        installing={false}
        hasWorkspace
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[0]!);
    expect(onScopeToggle).toHaveBeenCalledWith('owner/lint-skill', 'lint-skill', 'global', true);
  });

  it('點擊已勾 project checkbox 呼叫 onScopeToggle(repo, name, project, false)', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill({ repo: 'owner/lint-skill', name: 'lint-skill' })}
        installedScopes={new Set<SkillScope>(['project'])}
        loadingScopes={EMPTY_SCOPES}
        installing={false}
        hasWorkspace
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[1]!);
    expect(onScopeToggle).toHaveBeenCalledWith('owner/lint-skill', 'lint-skill', 'project', false);
  });

  it('installing=true 時 scope controls disabled', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill()}
        installedScopes={EMPTY_SCOPES}
        loadingScopes={EMPTY_SCOPES}
        installing
        hasWorkspace
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.every((cb) => cb.disabled)).toBe(true);
  });

  it('無 workspace 時 project checkbox disabled', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill()}
        installedScopes={EMPTY_SCOPES}
        loadingScopes={EMPTY_SCOPES}
        installing={false}
        hasWorkspace={false}
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0]!.disabled).toBe(false);
    expect(checkboxes[1]!.disabled).toBe(true);
  });

  it('loadingScopes 有 global 時顯示 spinner 取代 global checkbox', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill()}
        installedScopes={EMPTY_SCOPES}
        loadingScopes={new Set<SkillScope>(['global'])}
        installing={false}
        hasWorkspace
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    // global spinner 顯示，只有一個 checkbox (project)
    expect(screen.getAllByRole('checkbox').length).toBe(1);
    expect(document.querySelector('.scope-spinner')).toBeTruthy();
  });

  it('點擊 View Online 傳 url', () => {
    const url = 'https://skills.sh/owner/lint-skill';
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill({ url })}
        installedScopes={EMPTY_SCOPES}
        loadingScopes={EMPTY_SCOPES}
        installing={false}
        hasWorkspace
        onScopeToggle={onScopeToggle}
        onViewOnline={onViewOnline}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View on skills.sh' }));
    expect(onViewOnline).toHaveBeenCalledWith(url);
  });
});

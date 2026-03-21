/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { RegistrySkillCard } from '../RegistrySkillCard';
import type { RegistrySkill } from '../../../../shared/types';

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

describe('RegistrySkillCard', () => {
  const onInstall = vi.fn();
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
        isInstalled={false}
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    expect(screen.getByText('#3')).toBeTruthy();
    expect(screen.getByText('lint-skill')).toBeTruthy();
    expect(screen.getByText('owner/lint-skill')).toBeTruthy();
  });

  it('已安裝時顯示 "Installed" badge 且不顯示 Install 按鈕', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill()}
        isInstalled
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    expect(screen.getByText('Installed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
  });

  it('未安裝時顯示 Install 按鈕', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill()}
        isInstalled={false}
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    expect(screen.queryByText('Installed')).toBeNull();
    expect(screen.getByRole('button', { name: 'Install' })).toBeTruthy();
  });

  it('點擊 Install 傳 repo', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill({ repo: 'owner/lint-skill' })}
        isInstalled={false}
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onInstall).toHaveBeenCalledWith('owner/lint-skill');
  });

  it('installing 時按鈕 disabled', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill()}
        isInstalled={false}
        installing
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    const button = screen.getByRole('button', { name: 'Installing...' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('點擊 View Online 傳 url', () => {
    const url = 'https://skills.sh/owner/lint-skill';
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill({ url })}
        isInstalled={false}
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View on skills.sh' }));
    expect(onViewOnline).toHaveBeenCalledTimes(1);
    expect(onViewOnline).toHaveBeenCalledWith(url);
  });

  it('顯示安裝數', () => {
    renderWithI18n(
      <RegistrySkillCard
        skill={makeRegistrySkill({ installs: '42000' })}
        isInstalled={false}
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    expect(screen.getByText('42000 installs')).toBeTruthy();
  });
});

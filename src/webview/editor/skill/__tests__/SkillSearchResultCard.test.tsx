/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { SkillSearchResultCard } from '../SkillSearchResultCard';
import type { SkillSearchResult } from '../../../../shared/types';

vi.mock('../../../vscode', () => ({ vscode: { postMessage: vi.fn() } }));

function makeResult(overrides: Partial<SkillSearchResult> = {}): SkillSearchResult {
  return {
    name: 'lint-skill',
    repo: 'owner/lint-skill',
    fullId: 'owner/lint-skill@latest',
    installs: '1234',
    url: 'https://skills.sh/owner/lint-skill',
    ...overrides,
  };
}

describe('SkillSearchResultCard', () => {
  const onInstall = vi.fn();
  const onViewOnline = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('顯示名稱與 repo', () => {
    renderWithI18n(
      <SkillSearchResultCard
        result={makeResult()}
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    expect(screen.getByText('lint-skill')).toBeTruthy();
    expect(screen.getByText('owner/lint-skill')).toBeTruthy();
  });

  it('有 url 時顯示 View Online 按鈕', () => {
    renderWithI18n(
      <SkillSearchResultCard
        result={makeResult({ url: 'https://skills.sh/owner/lint-skill' })}
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    expect(screen.getByRole('button', { name: 'View on skills.sh' })).toBeTruthy();
  });

  it('無 url 時不顯示 View Online 按鈕', () => {
    renderWithI18n(
      <SkillSearchResultCard
        result={makeResult({ url: undefined })}
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    expect(screen.queryByRole('button', { name: 'View on skills.sh' })).toBeNull();
  });

  it('點擊 Install 傳 fullId', () => {
    renderWithI18n(
      <SkillSearchResultCard
        result={makeResult()}
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onInstall).toHaveBeenCalledWith('owner/lint-skill@latest');
  });

  it('installing 時按鈕 disabled', () => {
    renderWithI18n(
      <SkillSearchResultCard
        result={makeResult()}
        installing
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    const button = screen.getByRole('button', { name: 'Installing...' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('顯示安裝數', () => {
    renderWithI18n(
      <SkillSearchResultCard
        result={makeResult({ installs: '5678' })}
        installing={false}
        hasWorkspace
        onInstall={onInstall}
        onViewOnline={onViewOnline}
      />,
    );

    expect(screen.getByText('5678 installs')).toBeTruthy();
  });
});

/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { I18nProvider } from '../../../i18n/I18nContext';
import { SkillDetailPanel } from '../SkillDetailPanel';

describe('SkillDetailPanel', () => {
  const onClose = vi.fn();
  const onOpenInEditor = vi.fn();
  const onCopyPath = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('loading 與 no-content 狀態各自顯示正確提示', () => {
    const { rerender } = render(
      <I18nProvider locale="en">
        <SkillDetailPanel
          skillName="lint"
          skillPath="/tmp/lint/SKILL.md"
          detail={null}
          loading
          onClose={onClose}
          onOpenInEditor={onOpenInEditor}
          onCopyPath={onCopyPath}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('Loading...')).toBeTruthy();

    rerender(
      <I18nProvider locale="en">
        <SkillDetailPanel
          skillName="lint"
          skillPath="/tmp/lint/SKILL.md"
          detail={null}
          loading={false}
          onClose={onClose}
          onOpenInEditor={onOpenInEditor}
          onCopyPath={onCopyPath}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('No content available')).toBeTruthy();
  });

  it('frontmatter 依固定欄位順序顯示，額外欄位排在後面，操作按鈕可用', () => {
    const { container } = renderWithI18n(
      <SkillDetailPanel
        skillName="lint"
        skillPath="/tmp/lint/SKILL.md"
        detail={{
          frontmatter: {
            custom: 'extra',
            description: 'Run lint checks',
            name: 'lint',
            model: 'sonnet',
          },
          body: '# Lint\n\nRun every check.',
        }}
        loading={false}
        onClose={onClose}
        onOpenInEditor={onOpenInEditor}
        onCopyPath={onCopyPath}
      />,
    );

    expect(screen.getByText('Configuration')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByText(/# Lint/)).toBeTruthy();

    const labels = Array.from(container.querySelectorAll('.skill-detail-label')).map((node) => node.textContent);
    expect(labels).toEqual(['name', 'description', 'model', 'custom']);

    fireEvent.click(screen.getByRole('button', { name: 'Open in Editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Path' }));

    expect(onOpenInEditor).toHaveBeenCalledTimes(1);
    expect(onCopyPath).toHaveBeenCalledTimes(1);
  });

  it('點 overlay 會關閉，點 dialog 內容不會誤關閉', () => {
    const { container } = renderWithI18n(
      <SkillDetailPanel
        skillName="lint"
        skillPath="/tmp/lint/SKILL.md"
        detail={{ frontmatter: {}, body: 'body' }}
        loading={false}
        onClose={onClose}
        onOpenInEditor={onOpenInEditor}
        onCopyPath={onCopyPath}
      />,
    );

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('.confirm-overlay') as HTMLDivElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

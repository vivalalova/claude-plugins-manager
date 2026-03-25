/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { I18nProvider } from '../../../i18n/I18nContext';
import { SkillDetailPanel } from '../SkillDetailPanel';

vi.mock('marked', () => ({
  marked: {
    parse: (md: string) => `<p>${md}</p>`,
  },
}));

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

  it('frontmatter 以 tag 呈現，description 為副標題，body 渲染 markdown，按鈕可用', () => {
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

    // description 顯示為副標題
    expect(screen.getByText('Run lint checks')).toBeTruthy();

    // model 以 tag 呈現
    const tags = Array.from(container.querySelectorAll('.skill-detail-tag'));
    const tagTexts = tags.map((node) => node.textContent);
    expect(tagTexts).toContain('model: sonnet');
    expect(tagTexts).toContain('custom: extra');

    // body 渲染為 markdown HTML
    expect(container.querySelector('.skill-detail-markdown')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open in Editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Path' }));

    expect(onOpenInEditor).toHaveBeenCalledTimes(1);
    expect(onCopyPath).toHaveBeenCalledTimes(1);
  });

  it('allowed-tools 拆成多個 tag', () => {
    const { container } = renderWithI18n(
      <SkillDetailPanel
        skillName="test"
        skillPath="/tmp/test/SKILL.md"
        detail={{
          frontmatter: { 'allowed-tools': 'Read, Write, Bash' },
          body: '',
        }}
        loading={false}
        onClose={onClose}
        onOpenInEditor={onOpenInEditor}
        onCopyPath={onCopyPath}
      />,
    );

    const toolTags = Array.from(container.querySelectorAll('.skill-detail-tag--tool'));
    expect(toolTags.map((n) => n.textContent)).toEqual(['Read', 'Write', 'Bash']);
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

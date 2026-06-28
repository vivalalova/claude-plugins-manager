/**
 * @vitest-environment jsdom
 *
 * 批次 C：footerLinksRegexes（先紅）
 *
 * footerLinksRegexes is a controlType===Object field in the advanced section.
 * It is dispatched via ObjectFieldEditor as a TextSetting (JSON textarea),
 * matching the sshConfigs/autoMode pattern.
 *
 * The PermissionsSection.render-coverage.test.tsx already has a gate that
 * asserts every Object key in advanced has a renderer. That gate will also
 * turn RED once footerLinksRegexes is added to the schema (OBJECT_EDITOR_KEYS
 * picks it up automatically) but has no dispatcher case yet. This file adds
 * the interaction tests (save valid JSON / clear).
 *
 * Value schema (from spec):
 *   Array of { type?: 'regex', pattern: string, url: string, label?: string }
 *
 * Tests are RED until schema + ObjectFieldEditor dispatcher + i18n are added.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../components/Toast';
import { AdvancedSection } from '../AdvancedSection';

vi.mock('../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderAdvanced = (
  settings: Record<string, unknown> = {},
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
) =>
  renderWithI18n(
    <ToastProvider>
      <AdvancedSection
        scope="user"
        settings={settings as any}
        onSave={onSave}
        onDelete={onDelete}
      />
    </ToastProvider>,
  );

// Valid footerLinksRegexes value per spec:
// pattern uses a named capture group; url uses {key} placeholder.
// In JS source the backslash is doubled: "\\b" in string = \b in regex.
const VALID_FOOTER_JSON = JSON.stringify([
  { type: 'regex', pattern: 'PROJ-\\d+', url: 'https://issues.example.com/browse/{0}' },
]);

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

describe('footerLinksRegexes — AdvancedSection render（先紅，批次 C）', () => {
  it('AdvancedSection 渲染 footerLinksRegexes 控件（非 null）', async () => {
    const { container } = renderAdvanced();
    // RED: footerLinksRegexes not yet in schema; ObjectFieldEditor has no case for it.
    // Once added, a .settings-key-hint "(footerLinksRegexes)" or a label appears.
    await waitFor(() => {
      const hints = Array.from(container.querySelectorAll('.settings-key-hint'))
        .map((el) => el.textContent ?? '');
      const hasHint = hints.some((t) => t.includes('footerLinksRegexes'));
      // Also accept a label match (TextSetting renders a <label>)
      const hasLabel = !!screen.queryByText(/footer.link/i);
      expect(hasHint || hasLabel).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// save valid JSON
// ---------------------------------------------------------------------------

describe('footerLinksRegexes — save JSON（先紅，批次 C）', () => {
  it('貼上合法 JSON → 點 Save → onSave("footerLinksRegexes", parsedArray)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderAdvanced({}, onSave);

    // RED: placeholder i18n key not yet added
    // i18n key: settings.advanced.footerLinksRegexes.placeholder
    await waitFor(() => {
      expect(screen.queryByText(/footer.link/i)).not.toBeNull();
    });

    // Locate the textarea by placeholder text (mirrors sshConfigs pattern)
    const ta = screen.queryByPlaceholderText(/footerLinks|footer.link|PROJ/i) as HTMLTextAreaElement | null;
    // RED if ta is null — placeholder not rendered
    expect(ta).not.toBeNull();

    fireEvent.change(ta!, { target: { value: VALID_FOOTER_JSON } });

    const field = ta!.closest('.settings-field') as HTMLElement;
    // i18n key: settings.advanced.footerLinksRegexes.save
    const saveBtn = within(field).queryByRole('button', { name: /save/i });
    expect(saveBtn).not.toBeNull();
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'footerLinksRegexes',
        [{ type: 'regex', pattern: 'PROJ-\\d+', url: 'https://issues.example.com/browse/{0}' }],
      );
    });
  });

  it('有值時 Clear 按鈕存在 → 點 Clear → onDelete("footerLinksRegexes")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderAdvanced(
      { footerLinksRegexes: [{ pattern: 'PROJ-\\d+', url: 'https://x/{0}' }] },
      vi.fn(),
      onDelete,
    );

    await waitFor(() => {
      expect(screen.queryByText(/footer.link/i)).not.toBeNull();
    });

    const ta = screen.queryByPlaceholderText(/footerLinks|footer.link|PROJ/i) as HTMLTextAreaElement | null;
    expect(ta).not.toBeNull();

    const field = ta!.closest('.settings-field') as HTMLElement;
    // i18n key: settings.advanced.footerLinksRegexes.clear
    const clearBtn = within(field).queryByRole('button', { name: /clear/i });
    expect(clearBtn).not.toBeNull();
    fireEvent.click(clearBtn!);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('footerLinksRegexes');
    });
  });

  it('空 textarea → 點 Save → onDelete("footerLinksRegexes")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderAdvanced({}, onSave, onDelete);

    await waitFor(() => {
      expect(screen.queryByText(/footer.link/i)).not.toBeNull();
    });

    const ta = screen.queryByPlaceholderText(/footerLinks|footer.link|PROJ/i) as HTMLTextAreaElement | null;
    expect(ta).not.toBeNull();

    const field = ta!.closest('.settings-field') as HTMLElement;
    const saveBtn = within(field).queryByRole('button', { name: /save/i });
    expect(saveBtn).not.toBeNull();
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('footerLinksRegexes');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

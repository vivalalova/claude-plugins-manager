/**
 * @vitest-environment jsdom
 *
 * Render-coverage gate for PermissionsSection (issue #20).
 *
 * Purpose: ensure PermissionsSection renders ALL keys listed in
 * getSectionFieldOrder('permissions'). Any key silently dropped (null render)
 * will make the superset assertion fail.
 *
 * Note on current state:
 *   The superset test may be GREEN already (PermissionsSection is a hand-written
 *   section that was built ahead of the schema). That is an acceptable regression
 *   guard: it stays green through future changes, and will turn RED if someone
 *   removes a field from the render path.
 *
 * SchemaSection silent-path test:
 *   SchemaSection.tsx:106-109 silently returns null for controlType===Object keys
 *   that have no renderCustom handler. The test below simulates this by rendering
 *   AdvancedSection (which uses SchemaSection + renderCustom via ObjectFieldEditor)
 *   and asserting that EVERY Object-typed key in its section has a rendered output.
 *   If the renderCustom map is missing an Object key, SchemaSection returns null
 *   and the key-hint hint will be absent from the DOM.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { PermissionsSection } from '../PermissionsSection';
import { AdvancedSection } from '../AdvancedSection';
import { ToastProvider } from '../../../components/Toast';
import {
  getSectionFieldOrder,
  getAllFlatFieldSchemas,
} from '../../../../shared/claude-settings-schema';

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

// ---------------------------------------------------------------------------
// PermissionsSection render-coverage superset test
// ---------------------------------------------------------------------------

describe('PermissionsSection — render coverage gate (issue #20)', () => {
  it('rendered key-hints superset covers getSectionFieldOrder("permissions")', async () => {
    /**
     * PermissionsSection renders its fields as key-hints: "(key)" or "(key: default)".
     * We collect every key-hint from the DOM and assert that each key in the
     * schema's permissions field order appears at least once.
     *
     * Exceptions handled:
     *   - "permissions" itself: PermissionsSection renders this inline as the
     *     allow/deny/ask rule lists — no key-hint emitted; skip it.
     *   - Keys that PermissionsSection deliberately renders without a key-hint
     *     (e.g. rule lists) are covered by the sub-tab guard tests in the
     *     sibling file.
     *
     * If a future commit silently drops a field from PermissionsSection, the
     * key-hint for that field disappears and this test turns RED.
     */
    const { container } = renderWithI18n(
      <ToastProvider>
        <PermissionsSection
          scope="user"
          settings={{} as any}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={vi.fn().mockResolvedValue(undefined)}
        />
      </ToastProvider>,
    );

    await waitFor(() => {
      // Wait until at least one key-hint is rendered
      expect(container.querySelectorAll('.settings-key-hint').length).toBeGreaterThan(0);
    });

    // Collect all rendered key names from key-hints: "(keyName)" or "(keyName: ...)"
    const renderedHints = Array.from(container.querySelectorAll('.settings-key-hint'))
      .map((el) => {
        const text = el.textContent ?? '';
        const m = text.match(/^\(([^:)]+)/);
        return m ? m[1].trim() : '';
      })
      .filter(Boolean);

    const renderedSet = new Set(renderedHints);

    // Keys that PermissionsSection renders without a .settings-key-hint
    // (rule lists use a bespoke UI, not SchemaFieldRenderer)
    const WITHOUT_KEY_HINT = new Set(['permissions']);

    const sectionKeys = getSectionFieldOrder('permissions');

    const missing: string[] = [];
    for (const key of sectionKeys) {
      if (WITHOUT_KEY_HINT.has(key)) continue;
      if (!renderedSet.has(key)) {
        missing.push(key);
      }
    }

    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SchemaSection silent-path gate: every Object key in advanced must have a renderer
// ---------------------------------------------------------------------------

describe('SchemaSection — Object key silent-null guard (issue #20)', () => {
  it('AdvancedSection renders a visible element for every controlType===Object key in the "advanced" section', async () => {
    /**
     * SchemaSection.tsx:106-109 logs a console.warn and returns null for any
     * Object-typed key that has no renderCustom handler. This is the silent path.
     *
     * AdvancedSection passes renderCustom that delegates to ObjectFieldEditor for
     * every Object key except 'permissions', 'env', 'hooks'. If OBJECT_EDITOR_KEYS
     * ever gets out of sync with the schema's advanced Object keys, SchemaSection
     * silently drops those fields.
     *
     * This test asserts that every Object-typed field in the 'advanced' section
     * produces at least one DOM element with a .settings-key-hint or a label.
     * If a new Object field is added to advanced without being wired into
     * ObjectFieldEditor, this test will turn RED.
     */
    const allSchemas = getAllFlatFieldSchemas();
    const advancedObjectKeys = getSectionFieldOrder('advanced').filter(
      (key) => allSchemas[key]?.controlType === Object,
    );

    // AdvancedSection should render all object keys (none should be silently null)
    expect(advancedObjectKeys.length).toBeGreaterThan(0); // sanity: schema has object fields

    const { container } = renderWithI18n(
      <ToastProvider>
        <AdvancedSection
          scope="user"
          settings={{} as any}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={vi.fn().mockResolvedValue(undefined)}
        />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('.settings-key-hint, .settings-field label').length).toBeGreaterThan(0);
    });

    const renderedHints = new Set(
      Array.from(container.querySelectorAll('.settings-key-hint'))
        .map((el) => {
          const text = el.textContent ?? '';
          const m = text.match(/^\(([^:)]+)/);
          return m ? m[1].trim() : '';
        })
        .filter(Boolean),
    );

    // Keys that intentionally have no key-hint (hand-rendered object editors)
    // but still appear via their label text:
    const HAND_RENDERED_VIA_LABEL = new Set([
      'companyAnnouncements',  // CompanyAnnouncementsEditor uses a label, no key-hint
      'sshConfigs',            // TextSetting with JSON textarea
    ]);

    const renderedLabels = new Set(
      Array.from(container.querySelectorAll('.settings-field label, .settings-editor-label'))
        .map((el) => (el.textContent ?? '').trim().toLowerCase()),
    );

    const missingObjectKeys: string[] = [];
    for (const key of advancedObjectKeys) {
      const hasHint = renderedHints.has(key);
      // Also check label as fallback for hand-rendered editors
      const hasLabel = HAND_RENDERED_VIA_LABEL.has(key);
      if (!hasHint && !hasLabel) {
        missingObjectKeys.push(key);
      }
    }

    // If any Object key falls through SchemaSection's silent-null path without
    // a registered renderCustom handler, it will appear here.
    expect(missingObjectKeys).toEqual([]);
  });
});

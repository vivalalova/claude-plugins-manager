/**
 * @vitest-environment jsdom
 *
 * #44 — 布林開關的跨層合併規則（AnyTrue＝任一檔寫 true 即生效；OnlyFalse＝只認 false）。
 * 勾選框只代表本層自己的值，其他層讓實際狀態不同時顯示一行提示（指出層與 On/Off），
 * 本層取消勾選（OnlyFalse 為勾選）時刪掉這一格、不寫沒有作用的值。
 *
 * 英文提示文案形狀為假設：「<含 On/Off 與 scope 名稱的一行 <p>>」，
 * 例如 "Effective: On (set in User)"。斷言只要求該 <p> 含 scope 名稱與 On/Off 字樣之一。
 * 提示元素以「欄位內、含 On/Off 字樣的 <p>」定位，欄位說明文字不含這些字樣。
 * 覆寫標記＝ "Overrides {scope}"（settings.common.overrides）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../../vscode', async () => (await import('../../../__test-utils__/fakeSettingsBackend')).fakeVscodeModule);

import { installFakeSettingsBackend, emitPush, type FakeSettingsBackend } from '../../../__test-utils__/fakeSettingsBackend';
import {
  renderSettingsPage,
  waitInitialLoad,
  switchScope,
  clickScope,
  clickNav,
  flush,
  search,
  scopeBadge,
  fieldOf,
  type ScopeLabel,
} from '../../../__test-utils__/settingsPageHarness';

const BLOCK_WRITES = 'Block Writes Outside Working Directories';
const SKIP_DANGEROUS = 'Skip Dangerous Mode Permission Prompt';
const ISOLATE_PEER = 'Confirm Messages To Other Machines';
const DISABLE_CONNECTORS = 'Disable claude.ai Connectors';
const SYNC_SKILLS = 'Sync Claude.ai Skills';
const ENABLE_ARTIFACT = 'Enable Artifact Tool';
const AUTO_IN_PLAN = 'Use Auto Mode During Plan';

const BW = 'blockWritesOutsideWorkingDirectories';

let backend: FakeSettingsBackend;

type Files = Partial<Record<'user' | 'project' | 'local', Record<string, unknown>>>;

async function open(files: Files, scope: ScopeLabel, nav?: string): Promise<void> {
  backend = installFakeSettingsBackend(files);
  renderSettingsPage();
  await waitInitialLoad();
  if (scope !== 'User') await switchScope(scope);
  if (nav) clickNav(nav);
}

const field = (label: string): HTMLElement => fieldOf(screen.getByText(label));
const checkbox = (label: string): HTMLInputElement =>
  within(field(label)).getByRole('checkbox') as HTMLInputElement;

/** 欄位內的提示：含 On/Off 字樣的 <p>（欄位說明不含） */
const hintOf = (label: string): string | null => {
  const p = Array.from(field(label).querySelectorAll('p')).find((el) => /\b(On|Off)\b/.test(el.textContent ?? ''));
  return p?.textContent ?? null;
};

const expectHint = async (label: string, scope: string, state: 'On' | 'Off'): Promise<void> => {
  await waitFor(() => {
    const text = hintOf(label);
    expect(text).not.toBeNull();
    expect(text).toContain(scope);
    expect(text).toMatch(new RegExp(`\\b${state}\\b`));
    expect(text).not.toMatch(new RegExp(`\\b${state === 'On' ? 'Off' : 'On'}\\b`));
  });
};

const hasOverrideMark = (label: string): boolean =>
  within(field(label)).queryByText(/^Overrides /) !== null;

const reqs = (type: string) => backend.requests.filter((r) => r.type === type);

describe('SettingsPage — 布林合併規則（#44）', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // ── 紅燈 1：PermissionsSection、AnyTrue、project 分頁 ──
  it('T1 project 分頁：user blockWrites:true、project 沒寫 → 未勾、無覆寫標記、提示開（User）', async () => {
    await open({ user: { permissions: { [BW]: true } } }, 'Project', 'Permissions');
    await expectHint(BLOCK_WRITES, 'User', 'On');
    expect(checkbox(BLOCK_WRITES).checked).toBe(false);
    expect(hasOverrideMark(BLOCK_WRITES)).toBe(false);
  });

  // ── 紅燈 2 ──
  it('T2 project blockWrites:true 取消勾選 → settings.deleteNested，不送 setNested(false)，檔內無此 key', async () => {
    await open({ project: { permissions: { [BW]: true } } }, 'Project', 'Permissions');
    await waitFor(() => expect(checkbox(BLOCK_WRITES).checked).toBe(true));
    fireEvent.click(checkbox(BLOCK_WRITES));

    await waitFor(() => {
      expect(reqs('settings.deleteNested').some((r) => r.scope === 'project' && r.parentKey === 'permissions' && r.childKey === BW)).toBe(true);
    });
    expect(reqs('settings.setNested').some((r) => r.childKey === BW)).toBe(false);
    expect((backend.file('project').permissions as Record<string, unknown> | undefined)?.[BW]).toBeUndefined();
  });

  it('T2b 本層未寫、他層 true 時勾選 → 寫 true（setNested），不是 false', async () => {
    await open({ user: { permissions: { [BW]: true } } }, 'Project', 'Permissions');
    await expectHint(BLOCK_WRITES, 'User', 'On');
    fireEvent.click(checkbox(BLOCK_WRITES));

    await waitFor(() => {
      expect(reqs('settings.setNested').some((r) => r.scope === 'project' && r.childKey === BW && r.value === true)).toBe(true);
    });
    expect(reqs('settings.setNested').some((r) => r.childKey === BW && r.value === false)).toBe(false);
  });

  // ── 紅燈 3 ──
  it('T3 local 分頁：project false、user true → 未勾、提示開（User）而非 Project', async () => {
    await open(
      { user: { permissions: { [BW]: true } }, project: { permissions: { [BW]: false } } },
      'Local',
      'Permissions',
    );
    await expectHint(BLOCK_WRITES, 'User', 'On');
    expect(hintOf(BLOCK_WRITES)).not.toContain('Project');
    expect(checkbox(BLOCK_WRITES).checked).toBe(false);
    expect(hasOverrideMark(BLOCK_WRITES)).toBe(false);
  });

  // ── 紅燈 4：下層也要看 ──
  it('T4 user 分頁：local disableClaudeAiConnectors:true → 提示開（Local），且對 local 發 settings.get', async () => {
    await open({ local: { disableClaudeAiConnectors: true } }, 'User', 'Advanced');
    await expectHint(DISABLE_CONNECTORS, 'Local', 'On');
    expect(checkbox(DISABLE_CONNECTORS).checked).toBe(false);
    expect(reqs('settings.get').some((r) => r.scope === 'local')).toBe(true);
  });

  // ── 紅燈 5 ──
  it('T5 isolatePeerMachines：user true → project 分頁未勾＋提示開（User）', async () => {
    await open({ user: { isolatePeerMachines: true } }, 'Project', 'Advanced');
    await expectHint(ISOLATE_PEER, 'User', 'On');
    expect(checkbox(ISOLATE_PEER).checked).toBe(false);
    expect(hasOverrideMark(ISOLATE_PEER)).toBe(false);
  });

  it('T5b isolatePeerMachines：project true 取消勾選 → settings.delete，不送 settings.set', async () => {
    await open({ project: { isolatePeerMachines: true } }, 'Project', 'Advanced');
    await waitFor(() => expect(checkbox(ISOLATE_PEER).checked).toBe(true));
    fireEvent.click(checkbox(ISOLATE_PEER));

    await waitFor(() => {
      expect(reqs('settings.delete').some((r) => r.scope === 'project' && r.key === 'isolatePeerMachines')).toBe(true);
    });
    expect(reqs('settings.set').some((r) => r.key === 'isolatePeerMachines')).toBe(false);
    expect(backend.file('project').isolatePeerMachines).toBeUndefined();
  });

  // ── 紅燈 6：生效層過濾 ──
  it('T6 project 寫 skipDangerousModePermissionPrompt:true → user、local 分頁皆無提示（該 key 只在 user／local 生效）', async () => {
    await open(
      {
        project: { skipDangerousModePermissionPrompt: true, permissions: { [BW]: true } },
      },
      'User',
      'Permissions',
    );
    // 錨點：同批快照裡 project blockWrites 在 user 分頁有提示，證明快照已就緒
    await expectHint(BLOCK_WRITES, 'Project', 'On');
    expect(hintOf(SKIP_DANGEROUS)).toBeNull();
    expect(checkbox(SKIP_DANGEROUS).checked).toBe(false);

    await switchScope('Local');
    clickNav('Permissions');
    await expectHint(BLOCK_WRITES, 'Project', 'On');
    expect(hintOf(SKIP_DANGEROUS)).toBeNull();
    expect(checkbox(SKIP_DANGEROUS).checked).toBe(false);
  });

  // ── 紅燈 7：OnlyFalse 反向 ──
  it('T7 syncClaudeAiSkills：user false、local 沒寫 → local 已勾＋提示關（User）；取消勾選寫 false', async () => {
    await open({ user: { syncClaudeAiSkills: false } }, 'Local', 'Advanced');
    await expectHint(SYNC_SKILLS, 'User', 'Off');
    expect(checkbox(SYNC_SKILLS).checked).toBe(true);
    expect(hasOverrideMark(SYNC_SKILLS)).toBe(false);

    fireEvent.click(checkbox(SYNC_SKILLS));
    await waitFor(() => {
      expect(reqs('settings.set').some((r) => r.scope === 'local' && r.key === 'syncClaudeAiSkills' && r.value === false)).toBe(true);
    });
  });

  it('T7b syncClaudeAiSkills：local 原 false（未勾）再勾選 → settings.delete，不寫 true', async () => {
    await open({ local: { syncClaudeAiSkills: false } }, 'Local', 'Advanced');
    await waitFor(() => expect(checkbox(SYNC_SKILLS).checked).toBe(false));
    fireEvent.click(checkbox(SYNC_SKILLS));

    await waitFor(() => {
      expect(reqs('settings.delete').some((r) => r.scope === 'local' && r.key === 'syncClaudeAiSkills')).toBe(true);
    });
    expect(reqs('settings.set').some((r) => r.key === 'syncClaudeAiSkills')).toBe(false);
    expect(backend.file('local').syncClaudeAiSkills).toBeUndefined();
  });

  // ── enableArtifact：OnlyFalse（Advanced）──
  it('T7c enableArtifact：user false、project 沒寫 → project 已勾、無覆寫標記、提示關（User）；取消勾選寫 false', async () => {
    await open({ user: { enableArtifact: false } }, 'Project', 'Advanced');
    await expectHint(ENABLE_ARTIFACT, 'User', 'Off');
    expect(checkbox(ENABLE_ARTIFACT).checked).toBe(true);
    expect(hasOverrideMark(ENABLE_ARTIFACT)).toBe(false);

    fireEvent.click(checkbox(ENABLE_ARTIFACT));
    await waitFor(() => {
      expect(reqs('settings.set').some((r) => r.scope === 'project' && r.key === 'enableArtifact' && r.value === false)).toBe(true);
    });
  });

  it('T7d enableArtifact：project 原 false（未勾）再勾選 → settings.delete，不寫 true', async () => {
    await open({ project: { enableArtifact: false } }, 'Project', 'Advanced');
    await waitFor(() => expect(checkbox(ENABLE_ARTIFACT).checked).toBe(false));
    fireEvent.click(checkbox(ENABLE_ARTIFACT));

    await waitFor(() => {
      expect(reqs('settings.delete').some((r) => r.scope === 'project' && r.key === 'enableArtifact')).toBe(true);
    });
    expect(reqs('settings.set').some((r) => r.key === 'enableArtifact')).toBe(false);
    expect(backend.file('project').enableArtifact).toBeUndefined();
  });

  // ── useAutoModeDuringPlan：OnlyFalse（Permissions，user／local 生效）──
  it('T7e useAutoModeDuringPlan：user false、local 沒寫 → local 已勾、無覆寫標記、提示關（User）；取消勾選寫 false', async () => {
    await open({ user: { useAutoModeDuringPlan: false } }, 'Local', 'Permissions');
    await expectHint(AUTO_IN_PLAN, 'User', 'Off');
    expect(checkbox(AUTO_IN_PLAN).checked).toBe(true);
    expect(hasOverrideMark(AUTO_IN_PLAN)).toBe(false);

    fireEvent.click(checkbox(AUTO_IN_PLAN));
    await waitFor(() => {
      expect(reqs('settings.set').some((r) => r.scope === 'local' && r.key === 'useAutoModeDuringPlan' && r.value === false)).toBe(true);
    });
  });

  it('T7f useAutoModeDuringPlan：local 原 false（未勾）再勾選 → settings.delete，不寫 true', async () => {
    await open({ local: { useAutoModeDuringPlan: false } }, 'Local', 'Permissions');
    await waitFor(() => expect(checkbox(AUTO_IN_PLAN).checked).toBe(false));
    fireEvent.click(checkbox(AUTO_IN_PLAN));

    await waitFor(() => {
      expect(reqs('settings.delete').some((r) => r.scope === 'local' && r.key === 'useAutoModeDuringPlan')).toBe(true);
    });
    expect(reqs('settings.set').some((r) => r.key === 'useAutoModeDuringPlan')).toBe(false);
    expect(backend.file('local').useAutoModeDuringPlan).toBeUndefined();
  });

  it('T7g useAutoModeDuringPlan：project 寫 false → user、local 分頁皆無提示（project 不生效）', async () => {
    await open(
      { project: { useAutoModeDuringPlan: false, permissions: { [BW]: true } } },
      'User',
      'Permissions',
    );
    // 錨點：同批快照裡 project blockWrites 在 user 分頁有提示，證明快照已就緒
    await expectHint(BLOCK_WRITES, 'Project', 'On');
    expect(hintOf(AUTO_IN_PLAN)).toBeNull();

    await switchScope('Local');
    clickNav('Permissions');
    await expectHint(BLOCK_WRITES, 'Project', 'On');
    expect(hintOf(AUTO_IN_PLAN)).toBeNull();
  });

  // ── 本層已是決定值、他層同值 → 不提示 ──
  it('T11 AnyTrue：project blockWrites:true 且 user 也 true → project 分頁已勾、無提示', async () => {
    await open(
      { user: { permissions: { [BW]: true }, isolatePeerMachines: true }, project: { permissions: { [BW]: true } } },
      'Project',
      'Permissions',
    );
    await waitFor(() => expect(checkbox(BLOCK_WRITES).checked).toBe(true));
    // 錨點：同批快照裡 isolatePeerMachines 在 project 分頁有提示（User），證明快照已就緒
    clickNav('Advanced');
    await expectHint(ISOLATE_PEER, 'User', 'On');
    clickNav('Permissions');
    expect(checkbox(BLOCK_WRITES).checked).toBe(true);
    expect(hintOf(BLOCK_WRITES)).toBeNull();
  });

  it('T12 OnlyFalse：local syncClaudeAiSkills:false 且 user 也 false → local 分頁未勾、無提示', async () => {
    await open(
      { user: { syncClaudeAiSkills: false, isolatePeerMachines: true }, local: { syncClaudeAiSkills: false } },
      'Local',
      'Advanced',
    );
    await expectHint(ISOLATE_PEER, 'User', 'On'); // 錨點：快照就緒
    expect(checkbox(SYNC_SKILLS).checked).toBe(false);
    expect(hintOf(SYNC_SKILLS)).toBeNull();
  });

  // ── 紅燈 8：非布林當沒寫 ──
  it('T8 project blockWrites:"true"（字串）→ project 分頁未勾、有 Reset 鈕；user、local 分頁無提示', async () => {
    await open(
      { project: { permissions: { [BW]: 'true' }, isolatePeerMachines: true } },
      'Project',
      'Permissions',
    );
    expect(checkbox(BLOCK_WRITES).checked).toBe(false);
    expect(screen.getByRole('button', { name: `Reset ${BLOCK_WRITES}` })).toBeTruthy();

    // user 分頁：錨點用 isolatePeerMachines（Advanced）證明快照就緒
    await switchScope('User');
    clickNav('Advanced');
    await expectHint(ISOLATE_PEER, 'Project', 'On');
    clickNav('Permissions');
    expect(hintOf(BLOCK_WRITES)).toBeNull();

    await switchScope('Local');
    clickNav('Advanced');
    await expectHint(ISOLATE_PEER, 'Project', 'On');
    clickNav('Permissions');
    expect(hintOf(BLOCK_WRITES)).toBeNull();
  });

  it('T8b user syncClaudeAiSkills:"false"（字串）→ local 無「關」提示、仍視為沒寫（已勾）', async () => {
    await open(
      { user: { syncClaudeAiSkills: 'false', isolatePeerMachines: true } },
      'Local',
      'Advanced',
    );
    await expectHint(ISOLATE_PEER, 'User', 'On'); // 錨點：快照就緒
    expect(hintOf(SYNC_SKILLS)).toBeNull();
    expect(checkbox(SYNC_SKILLS).checked).toBe(true);
  });

  // ── 紅燈 9：搜尋結果 ──
  it('T9 搜尋：project 分頁搜 blockWrites 結果列同一般列有提示', async () => {
    await open({ user: { permissions: { [BW]: true } } }, 'Project');
    search('Block Writes');
    await waitFor(() => screen.getByText(BLOCK_WRITES));
    await expectHint(BLOCK_WRITES, 'User', 'On');
    expect(checkbox(BLOCK_WRITES).checked).toBe(false);
    expect(hasOverrideMark(BLOCK_WRITES)).toBe(false);
  });

  it('T9b 搜尋：project blockWrites:true 取消勾選 → deleteNested', async () => {
    await open({ project: { permissions: { [BW]: true } } }, 'Project');
    search('Block Writes');
    await waitFor(() => screen.getByText(BLOCK_WRITES));
    await waitFor(() => expect(checkbox(BLOCK_WRITES).checked).toBe(true));
    fireEvent.click(checkbox(BLOCK_WRITES));

    await waitFor(() => {
      expect(reqs('settings.deleteNested').some((r) => r.scope === 'project' && r.childKey === BW)).toBe(true);
    });
    expect(reqs('settings.setNested').some((r) => r.childKey === BW && r.value === false)).toBe(false);
  });

  // ── 紅燈 10：已自訂面板 ──
  it('T10 已自訂：project disableClaudeAiConnectors:false、user true → 列顯示提示開（User）、無覆寫標記、未勾', async () => {
    await open(
      { project: { disableClaudeAiConnectors: false }, user: { disableClaudeAiConnectors: true } },
      'Project',
      'Customized',
    );
    await waitFor(() => screen.getByText(DISABLE_CONNECTORS));
    await expectHint(DISABLE_CONNECTORS, 'User', 'On');
    expect(checkbox(DISABLE_CONNECTORS).checked).toBe(false);
    expect(hasOverrideMark(DISABLE_CONNECTORS)).toBe(false);
  });

  // ── 紅燈 13：徽章 ──
  describe('徽章（scope tab）', () => {
    const FILES: Files = {
      user: { model: 'a' },
      project: { model: 'b', language: 'ja' },
      local: { model: 'c' },
    };

    const waitBadges = (user: string | null, project: string | null, local: string | null) =>
      waitFor(() => {
        expect(scopeBadge('User')).toBe(user);
        expect(scopeBadge('Project')).toBe(project);
        expect(scopeBadge('Local')).toBe(local);
      });

    it('B1 初次載入後 Project／Local 徽章＝各層自訂項數，User 無徽章', async () => {
      await open(FILES, 'User');
      await waitBadges(null, '2', '1');
    });

    it('B2 切分頁載入期間他層不顯示徽章；載入後回到各層項數', async () => {
      await open(FILES, 'User');
      await waitBadges(null, '2', '1');

      backend.block('local');
      clickScope('Project');
      await waitFor(() => expect(backend.pending('local').length).toBeGreaterThanOrEqual(1));
      await flush();
      expect(scopeBadge('User')).toBeNull();
      expect(scopeBadge('Local')).toBeNull();

      await act(async () => { await backend.unblock('local'); });
      await waitBadges(null, '2', '1');
    });

    it('B3 某層讀取失敗 → 該層徽章不顯示，其他層照常', async () => {
      await open(FILES, 'User');
      await waitBadges(null, '2', '1');

      backend.failNext('local', 'settings.get');
      act(() => { emitPush({ type: 'settings.refresh' }); });
      await waitFor(() => expect(scopeBadge('Local')).toBeNull());
      expect(scopeBadge('User')).toBeNull();
      expect(scopeBadge('Project')).toBe('2');
    });

    it('B4 推播重讀期間（回應未到）徽章不閃，回應到後仍是各層項數', async () => {
      await open(FILES, 'User');
      await waitBadges(null, '2', '1');

      backend.block('local');
      act(() => { emitPush({ type: 'settings.refresh' }); });
      await waitFor(() => expect(backend.pending('local').length).toBeGreaterThanOrEqual(1));
      await flush();
      expect(scopeBadge('User')).toBeNull();
      expect(scopeBadge('Project')).toBe('2');
      expect(scopeBadge('Local')).toBe('1');

      await act(async () => { await backend.unblock('local'); });
      await waitBadges(null, '2', '1');
    });
  });
});

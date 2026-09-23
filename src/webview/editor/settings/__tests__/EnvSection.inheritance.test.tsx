/**
 * @vitest-environment jsdom
 */
// #28 — 環境變數分頁選到已知變數預設值時的繼承感知刪／寫判斷（比對單位：env[變數名]）。
// 「刪」＝onSave('env', 物件中沒有 X)；「寫」＝onSave('env', 物件含 X=預設值)。
// 布林 DISABLE_TELEMETRY（default '0'）、數字 MCP_TIMEOUT（default 5000）、
// 文字 ANTHROPIC_BASE_URL（default https://api.anthropic.com）。
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { EnvSection } from '../EnvSection';
import { ToastProvider } from '../../../components/Toast';

vi.mock('../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

type Scope = 'user' | 'project' | 'local';

const renderSection = (
  settings: Record<string, unknown>,
  scope: Scope,
  parentSettings: Partial<Record<Scope, Record<string, unknown>>> | undefined,
  onSave = vi.fn().mockResolvedValue(undefined),
) => {
  const result = renderWithI18n(
    <ToastProvider>
      <EnvSection
        scope={scope}
        settings={settings as any}
        parentSettings={parentSettings as any}
        onSave={onSave}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />
    </ToastProvider>,
  );
  return { ...result, onSave };
};

const getEnvCheckbox = (name: string): HTMLInputElement => {
  const label = screen.getAllByText(name).map((el) => el.closest('label')).find((l) => l?.querySelector('input[type="checkbox"]'));
  if (!label) throw new Error(`checkbox for ${name} not found`);
  return label.querySelector('input[type="checkbox"]') as HTMLInputElement;
};

const getFieldById = (container: HTMLElement, id: string): { input: HTMLInputElement; field: HTMLElement } => {
  const input = container.querySelector(`#${id}`) as HTMLInputElement;
  if (!input) throw new Error(`#${id} not found`);
  return { input, field: input.closest('.settings-field') as HTMLElement };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EnvSection — 選到已知變數預設值的繼承感知判斷（#28）', () => {
  // B1：上層有設（值相同也算）→ 明確寫入本層預設值
  it.each(['1', '0'])('B1 local、project env.DISABLE_TELEMETRY=%s、本層=1 → 取消勾選（預設值）→ 寫入 DISABLE_TELEMETRY=0，不刪', async (parentVal) => {
    const { onSave } = renderSection(
      { env: { DISABLE_TELEMETRY: '1' } },
      'local',
      { project: { env: { DISABLE_TELEMETRY: parentVal } }, user: {} },
    );
    await waitFor(() => getEnvCheckbox('DISABLE_TELEMETRY'));
    fireEvent.click(getEnvCheckbox('DISABLE_TELEMETRY'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', { DISABLE_TELEMETRY: '0' }));
  });

  it('B1 local、只有 user env 有設 → 選預設值 → 寫入', async () => {
    const { onSave } = renderSection(
      { env: { DISABLE_TELEMETRY: '1' } },
      'local',
      { project: {}, user: { env: { DISABLE_TELEMETRY: '1' } } },
    );
    await waitFor(() => getEnvCheckbox('DISABLE_TELEMETRY'));
    fireEvent.click(getEnvCheckbox('DISABLE_TELEMETRY'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', { DISABLE_TELEMETRY: '0' }));
  });

  it('B2（守衛）local、project 與 user 都沒設該變數（上層 env 有其他變數）→ 選預設值 → 刪', async () => {
    const { onSave } = renderSection(
      { env: { DISABLE_TELEMETRY: '1', OTHER: 'x' } },
      'local',
      { project: { env: { OTHER: 'y' } }, user: {} },
    );
    await waitFor(() => getEnvCheckbox('DISABLE_TELEMETRY'));
    fireEvent.click(getEnvCheckbox('DISABLE_TELEMETRY'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', { OTHER: 'x' }));
  });

  it('B3 local、上層快照未知（parentSettings=undefined）→ 選預設值 → 寫入', async () => {
    const { onSave } = renderSection({ env: { DISABLE_TELEMETRY: '1' } }, 'local', undefined);
    await waitFor(() => getEnvCheckbox('DISABLE_TELEMETRY'));
    fireEvent.click(getEnvCheckbox('DISABLE_TELEMETRY'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', { DISABLE_TELEMETRY: '0' }));
  });

  it.each([undefined, {}])('B4（守衛）user scope（parentSettings=%o）→ 選預設值 → 刪', async (parents) => {
    const { onSave } = renderSection({ env: { DISABLE_TELEMETRY: '1' } }, 'user', parents as any);
    await waitFor(() => getEnvCheckbox('DISABLE_TELEMETRY'));
    fireEvent.click(getEnvCheckbox('DISABLE_TELEMETRY'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', {}));
  });

  it('B7（守衛）上層有設、Number 變數本層有值 → 按清除（Reset） → 刪', async () => {
    const { container, onSave } = renderSection(
      { env: { MCP_TIMEOUT: '8000' } },
      'local',
      { project: { env: { MCP_TIMEOUT: '9000' } }, user: {} },
    );
    await waitFor(() => getFieldById(container, 'MCP_TIMEOUT'));
    const { field } = getFieldById(container, 'MCP_TIMEOUT');
    fireEvent.click(field.querySelector('.btn-secondary') as HTMLButtonElement);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', {}));
  });

  it('B7（守衛）上層有設、Text 變數本層有值 → 按清除（Reset） → 刪', async () => {
    const { container, onSave } = renderSection(
      { env: { ANTHROPIC_BASE_URL: 'https://own.example' } },
      'local',
      { project: { env: { ANTHROPIC_BASE_URL: 'https://parent.example' } }, user: {} },
    );
    await waitFor(() => getFieldById(container, 'ANTHROPIC_BASE_URL'));
    const { field } = getFieldById(container, 'ANTHROPIC_BASE_URL');
    fireEvent.click(field.querySelector('.btn-secondary') as HTMLButtonElement);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', {}));
  });

  it('B9 上層有設、Number 變數存預設值 5000 → 寫入 MCP_TIMEOUT=5000', async () => {
    const { container, onSave } = renderSection(
      { env: {} },
      'local',
      { project: { env: { MCP_TIMEOUT: '8000' } }, user: {} },
    );
    await waitFor(() => getFieldById(container, 'MCP_TIMEOUT'));
    const { input, field } = getFieldById(container, 'MCP_TIMEOUT');
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', { MCP_TIMEOUT: '5000' }));
  });

  it('B9 上層有設、Text 變數存預設值 → 寫入 ANTHROPIC_BASE_URL=預設值', async () => {
    const { container, onSave } = renderSection(
      { env: {} },
      'project',
      { user: { env: { ANTHROPIC_BASE_URL: 'https://parent.example' } } },
    );
    await waitFor(() => getFieldById(container, 'ANTHROPIC_BASE_URL'));
    const { input, field } = getFieldById(container, 'ANTHROPIC_BASE_URL');
    fireEvent.change(input, { target: { value: 'https://api.anthropic.com' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', { ANTHROPIC_BASE_URL: 'https://api.anthropic.com' }));
  });

  it('B9（守衛）上層都沒設、Number 變數存預設值 → 刪（本層原有其他變數保留）', async () => {
    const { container, onSave } = renderSection(
      { env: { MCP_TIMEOUT: '8000', OTHER: 'x' } },
      'local',
      { project: {}, user: {} },
    );
    await waitFor(() => getFieldById(container, 'MCP_TIMEOUT'));
    const { input, field } = getFieldById(container, 'MCP_TIMEOUT');
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', { OTHER: 'x' }));
  });
});

describe('EnvSection — 布林變數顯示繼承的勾選狀態（#28 I5、F28-1）', () => {
  it.each(['1', 'true'])('B8 本層未設、project env.DISABLE_TELEMETRY=%s → checkbox 勾選', async (parentVal) => {
    renderSection({ env: {} }, 'local', { project: { env: { DISABLE_TELEMETRY: parentVal } }, user: {} });
    await waitFor(() => expect(getEnvCheckbox('DISABLE_TELEMETRY').checked).toBe(true));
  });

  it('B8 local、project 未設、user env.DISABLE_TELEMETRY=1 → checkbox 勾選', async () => {
    renderSection({ env: {} }, 'local', { project: {}, user: { env: { DISABLE_TELEMETRY: '1' } } });
    await waitFor(() => expect(getEnvCheckbox('DISABLE_TELEMETRY').checked).toBe(true));
  });

  it('B8 local、project=0 蓋過 user=1（最近層）→ checkbox 未勾', async () => {
    renderSection(
      { env: {} },
      'local',
      { project: { env: { DISABLE_TELEMETRY: '0' } }, user: { env: { DISABLE_TELEMETRY: '1' } } },
    );
    await waitFor(() => getEnvCheckbox('DISABLE_TELEMETRY'));
    expect(getEnvCheckbox('DISABLE_TELEMETRY').checked).toBe(false);
  });

  it('F28-1 布林繼承只反映勾選、不加「Inherited from」字樣', async () => {
    renderSection({ env: {} }, 'local', { project: { env: { DISABLE_TELEMETRY: '1' } }, user: {} });
    await waitFor(() => expect(getEnvCheckbox('DISABLE_TELEMETRY').checked).toBe(true));
    const field = getEnvCheckbox('DISABLE_TELEMETRY').closest('.settings-field') as HTMLElement;
    expect(field.textContent).not.toMatch(/Inherited from/);
  });

  it('本層未設、繼承勾選 → 點擊（取消，預設值）→ 上層有設 → 寫入 DISABLE_TELEMETRY=0', async () => {
    const { onSave } = renderSection({ env: {} }, 'local', { project: { env: { DISABLE_TELEMETRY: '1' } }, user: {} });
    await waitFor(() => expect(getEnvCheckbox('DISABLE_TELEMETRY').checked).toBe(true));
    fireEvent.click(getEnvCheckbox('DISABLE_TELEMETRY'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('env', { DISABLE_TELEMETRY: '0' }));
  });
});

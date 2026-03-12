/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { NumberSetting } from '../SettingControls';
import { ToastProvider } from '../../../../components/Toast';

vi.mock('../../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

const renderNumberSetting = (
  overrides: Partial<{
    value: number | undefined;
    min: number;
    max: number;
    step: number;
    scope: 'user' | 'project' | 'local';
    onSave: (key: string, value: unknown) => Promise<void>;
    onDelete: (key: string) => Promise<void>;
  }> = {},
) => {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
  const onDelete = overrides.onDelete ?? vi.fn().mockResolvedValue(undefined);
  return renderWithI18n(
    <ToastProvider>
      <NumberSetting
        label="Cleanup Period"
        description="Days to keep old data"
        value={overrides.value}
        placeholder="e.g. 30"
        saveLabel="Save"
        clearLabel="Clear"
        settingKey="cleanupPeriodDays"
        scope={overrides.scope ?? 'user'}
        min={overrides.min}
        max={overrides.max}
        step={overrides.step}
        onSave={onSave}
        onDelete={onDelete}
      />
    </ToastProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('NumberSetting — 渲染', () => {
  it('顯示 label', async () => {
    renderNumberSetting();
    await waitFor(() => expect(screen.getByText('Cleanup Period')).toBeTruthy());
  });

  it('顯示 description', async () => {
    renderNumberSetting();
    await waitFor(() => expect(screen.getByText('Days to keep old data')).toBeTruthy());
  });

  it('value=undefined → input 為空', async () => {
    renderNumberSetting({ value: undefined });
    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. 30') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  it('value=30 → input 顯示 30', async () => {
    renderNumberSetting({ value: 30 });
    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. 30') as HTMLInputElement;
      expect(input.value).toBe('30');
    });
  });

  it('value 有值時顯示 Clear 按鈕', async () => {
    renderNumberSetting({ value: 30 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy());
  });

  it('value=undefined → 不顯示 Clear 按鈕', async () => {
    renderNumberSetting({ value: undefined });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    });
  });

  it('input type=number', async () => {
    renderNumberSetting();
    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. 30') as HTMLInputElement;
      expect(input.type).toBe('number');
    });
  });
});

// ---------------------------------------------------------------------------
// 驗收條件
// ---------------------------------------------------------------------------

describe('NumberSetting — 驗收條件', () => {
  it('min=0, 輸入 -1 → save 按鈕 disabled 且顯示 validation error', async () => {
    renderNumberSetting({ min: 0 });

    await waitFor(() => screen.getByPlaceholderText('e.g. 30'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 30'), { target: { value: '-1' } });

    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('min=0, 輸入 -1 → 不呼叫 onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderNumberSetting({ min: 0, onSave });

    await waitFor(() => screen.getByPlaceholderText('e.g. 30'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 30'), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('value=30, 點擊 Clear → 呼叫 onDelete("cleanupPeriodDays")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderNumberSetting({ value: 30, onDelete });

    await waitFor(() => screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('cleanupPeriodDays');
    });
  });

  it('value=undefined, 輸入 60 並 Save → 呼叫 onSave("cleanupPeriodDays", 60) (number)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderNumberSetting({ onSave });

    await waitFor(() => screen.getByPlaceholderText('e.g. 30'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 30'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('cleanupPeriodDays', 60);
      const [, arg] = onSave.mock.calls[0];
      expect(typeof arg).toBe('number');
    });
  });
});

// ---------------------------------------------------------------------------
// 邊界值
// ---------------------------------------------------------------------------

describe('NumberSetting — 邊界值', () => {
  it('max=100, 輸入 101 → save 按鈕 disabled 且顯示 validation error', async () => {
    renderNumberSetting({ max: 100 });

    await waitFor(() => screen.getByPlaceholderText('e.g. 30'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 30'), { target: { value: '101' } });

    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('min=0, 輸入 0 → 有效，save 按鈕不 disabled', async () => {
    renderNumberSetting({ min: 0 });

    await waitFor(() => screen.getByPlaceholderText('e.g. 30'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 30'), { target: { value: '0' } });

    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(false);
    });
  });

  it('空 input 點擊 Save → 呼叫 onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderNumberSetting({ value: 30, onDelete });

    await waitFor(() => screen.getByPlaceholderText('e.g. 30'));
    fireEvent.change(screen.getByPlaceholderText('e.g. 30'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('cleanupPeriodDays');
    });
  });

  it('scope 切換 → input 重設為新 value', async () => {
    const { rerender } = renderNumberSetting({ value: 30, scope: 'user' });

    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. 30') as HTMLInputElement;
      expect(input.value).toBe('30');
    });

    rerender(
      <ToastProvider>
        <NumberSetting
          label="Cleanup Period"
          value={60}
          placeholder="e.g. 30"
          saveLabel="Save"
          clearLabel="Clear"
          settingKey="cleanupPeriodDays"
          scope="project"
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      </ToastProvider>,
    );

    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. 30') as HTMLInputElement;
      expect(input.value).toBe('60');
    });
  });
});

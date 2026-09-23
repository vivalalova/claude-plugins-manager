/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SettingLabelText, getOverriddenScope } from '../SettingControls';

afterEach(() => {
  cleanup();
});

describe('SettingLabelText', () => {
  it('primitive defaultValue → 顯示 key 與值', () => {
    render(<SettingLabelText label="Fast Mode" settingKey="fastMode" defaultValue={false} />);
    expect(screen.getByText('(fastMode: false)')).toBeTruthy();
  });

  it('defaultValue 未提供 → 只顯示 key', () => {
    render(<SettingLabelText label="Language" settingKey="language" />);
    expect(screen.getByText('(language)')).toBeTruthy();
  });

  it('defaultValue=null → 只顯示 key', () => {
    render(<SettingLabelText label="Sandbox" settingKey="sandbox" defaultValue={null} />);
    expect(screen.getByText('(sandbox)')).toBeTruthy();
  });

  it('defaultValue 為 array/object/空字串 → 只顯示 key', () => {
    const { rerender } = render(<SettingLabelText label="Models" settingKey="availableModels" defaultValue={[]} />);
    expect(screen.getByText('(availableModels)')).toBeTruthy();

    rerender(<SettingLabelText label="Sandbox" settingKey="sandbox" defaultValue={{ mode: 'workspace-write' }} />);
    expect(screen.getByText('(sandbox)')).toBeTruthy();

    rerender(<SettingLabelText label="Language" settingKey="language" defaultValue="" />);
    expect(screen.getByText('(language)')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// #24 — getOverriddenScope 必須跳過「該 key 在該父層不生效」的 scope，不能只看
// parentSettings 裡有沒有這個 key（project 檔案裡即使寫了 user+local-only 的
// key，那份值本來就不會被 Claude Code 讀到，override badge 不該指向它）。
// ---------------------------------------------------------------------------

describe('getOverriddenScope — #24 跳過不生效的父層 scope', () => {
  it('（回歸錨）未受限 key：project 有值 → local 視角回報 project 覆寫', () => {
    // model 未登錄 effectiveScopes，行為不受本次改動影響。
    const result = getOverriddenScope(
      'local',
      { project: { model: 'x' }, user: { model: 'y' } },
      'model',
      'z',
    );
    expect(result).toBe('project');
  });

  it('useAutoModeDuringPlan（user+local）：project 有值但不生效 → local 視角跳過 project，回報 user', () => {
    const result = getOverriddenScope(
      'local',
      { project: { useAutoModeDuringPlan: false }, user: { useAutoModeDuringPlan: true } },
      'useAutoModeDuringPlan',
      true,
    );
    expect(result).toBe('user');
  });

  it('useAutoModeDuringPlan：project 有值、user 沒有值 → local 視角完全跳過 project，回報 undefined', () => {
    const result = getOverriddenScope(
      'local',
      { project: { useAutoModeDuringPlan: false } },
      'useAutoModeDuringPlan',
      true,
    );
    expect(result).toBeUndefined();
  });
});

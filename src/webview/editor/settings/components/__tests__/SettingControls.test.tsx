/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SettingLabelText } from '../SettingControls';

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

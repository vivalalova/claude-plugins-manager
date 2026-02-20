/**
 * @vitest-environment jsdom
 */
import React, { createRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TranslateDialog } from '../TranslateDialog';

describe('TranslateDialog', () => {
  const onEmailChange = vi.fn();
  const onLangChange = vi.fn();
  const onCancel = vi.fn();
  const onConfirm = vi.fn();

  const defaultProps = {
    trapRef: createRef<HTMLDivElement>(),
    titleId: 'translate-title',
    emailId: 'translate-email',
    langId: 'translate-lang',
    draftEmail: '',
    draftLang: '',
    onEmailChange,
    onLangChange,
    onCancel,
    onConfirm,
  };

  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('顯示 Translate 標題', () => {
    render(<TranslateDialog {...defaultProps} />);
    expect(screen.getByText('Translate')).toBeTruthy();
  });

  it('email 空 + lang 空 → OK 按鈕 disabled', () => {
    render(<TranslateDialog {...defaultProps} draftEmail="" draftLang="" />);
    const okBtn = screen.getByText('OK') as HTMLButtonElement;
    expect(okBtn.disabled).toBe(true);
  });

  it('email 有值但 lang 空 → OK 按鈕 disabled', () => {
    render(<TranslateDialog {...defaultProps} draftEmail="a@b.com" draftLang="" />);
    const okBtn = screen.getByText('OK') as HTMLButtonElement;
    expect(okBtn.disabled).toBe(true);
  });

  it('email + lang 都有值 → OK 按鈕可點', () => {
    render(<TranslateDialog {...defaultProps} draftEmail="a@b.com" draftLang="zh-TW" />);
    const okBtn = screen.getByText('OK') as HTMLButtonElement;
    expect(okBtn.disabled).toBe(false);
  });

  it('Cancel 按鈕 → onCancel', () => {
    render(<TranslateDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('OK 按鈕點擊 → onConfirm（有值時）', () => {
    render(<TranslateDialog {...defaultProps} draftEmail="a@b.com" draftLang="zh-TW" />);
    fireEvent.click(screen.getByText('OK'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('email input 變更 → onEmailChange', () => {
    render(<TranslateDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText('your@email.com');
    fireEvent.change(input, { target: { value: 'test@test.com' } });
    expect(onEmailChange).toHaveBeenCalledWith('test@test.com');
  });

  it('lang select 變更 → onLangChange', () => {
    render(<TranslateDialog {...defaultProps} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'ja' } });
    expect(onLangChange).toHaveBeenCalledWith('ja');
  });

  it('點擊 overlay 背景 → onCancel', () => {
    const { container } = render(<TranslateDialog {...defaultProps} />);
    const overlay = container.querySelector('.confirm-overlay')!;
    fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('TRANSLATE_LANGS 選項存在（如繁體中文）', () => {
    render(<TranslateDialog {...defaultProps} />);
    expect(screen.getByText('繁體中文')).toBeTruthy();
  });

  it('email input 有 aria-describedby 指向 hint span', () => {
    const { container } = render(<TranslateDialog {...defaultProps} emailId="test-email" />);
    const input = container.querySelector('#test-email')!;
    const hintId = input.getAttribute('aria-describedby');
    expect(hintId).toBeTruthy();
    const hint = container.querySelector(`[id="${hintId}"]`)!;
    expect(hint.textContent).toContain('MyMemory');
  });
});

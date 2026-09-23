/**
 * #33 C0：巢狀子欄位共用純函式（擴展端、webview 樂觀更新、測試 fake backend 三方共用）。
 * 契約（I9）：不修改輸入、回傳 { next, changed }；父 key 缺席建 {}；
 * 父 key 存在但為 null／陣列／非 plain object → 拋錯（F3a）；刪到父物件變空 → next 不含父 key（I2）。
 */
import { describe, it, expect } from 'vitest';
import { applySetNested, applyDeleteNested, isNestedParentShape } from '../nestedSettings';

/** 深拷貝，用來比對呼叫前後輸入是否被改動 */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('applySetNested', () => {
  it('只改 [P][C]，P 的其他子欄位與其他頂層 key 不動', () => {
    const input = { model: 'x', permissions: { allow: ['Bash'], defaultMode: 'plan' } };
    const { next, changed } = applySetNested(input, 'permissions', 'disableAutoMode', 'disable');
    expect(changed).toBe(true);
    expect(next).toEqual({
      model: 'x',
      permissions: { allow: ['Bash'], defaultMode: 'plan', disableAutoMode: 'disable' },
    });
  });

  it('父 key 缺席 → 建立 { C: v }', () => {
    const { next, changed } = applySetNested({ model: 'x' }, 'remote', 'defaultEnvironmentId', 'env-1');
    expect(changed).toBe(true);
    expect(next).toEqual({ model: 'x', remote: { defaultEnvironmentId: 'env-1' } });
  });

  it('I9：不修改輸入（含父物件），回傳新物件', () => {
    const input = { permissions: { allow: ['Bash'] }, env: { A: '1' } };
    const before = clone(input);
    const parentRef = input.permissions;
    const { next } = applySetNested(input, 'permissions', 'defaultMode', 'plan');
    expect(input).toEqual(before);
    expect(parentRef).toEqual(before.permissions);
    expect(next).not.toBe(input);
  });

  it.each([
    ['字串', 'x'],
    ['null', null],
    ['陣列', []],
  ])('F3a：父 key 存在但為%s → 拋錯，輸入不變', (_label, parent) => {
    const input = { permissions: parent };
    const before = clone(input);
    expect(() => applySetNested(input, 'permissions', 'defaultMode', 'plan')).toThrow();
    expect(input).toEqual(before);
  });
});

describe('applyDeleteNested', () => {
  it('刪掉指定子欄位，保留其他子欄位', () => {
    const input = { remote: { defaultEnvironmentId: 'e', x: 1 } };
    const { next, changed } = applyDeleteNested(input, 'remote', 'defaultEnvironmentId');
    expect(changed).toBe(true);
    expect(next).toEqual({ remote: { x: 1 } });
  });

  it('I2：刪到父物件變空 → next 不含父 key（不留 {}）', () => {
    const { next, changed } = applyDeleteNested(
      { model: 'x', env: { ONLY: '1' } },
      'env',
      'ONLY',
    );
    expect(changed).toBe(true);
    expect(next).toEqual({ model: 'x' });
    expect('env' in next).toBe(false);
  });

  it('父 key 不存在 → changed=false', () => {
    const { changed } = applyDeleteNested({ model: 'x' }, 'permissions', 'defaultMode');
    expect(changed).toBe(false);
  });

  it('子 key 不存在 → changed=false，父物件原樣保留', () => {
    const { next, changed } = applyDeleteNested(
      { permissions: { allow: ['Bash'] } },
      'permissions',
      'defaultMode',
    );
    expect(changed).toBe(false);
    expect(next).toEqual({ permissions: { allow: ['Bash'] } });
  });

  it('I9：不修改輸入（含父物件），回傳新物件', () => {
    const input = { env: { A: '1', B: '2' } };
    const before = clone(input);
    const { next } = applyDeleteNested(input, 'env', 'A');
    expect(input).toEqual(before);
    expect(next).not.toBe(input);
  });

  it.each([
    ['字串', 'x'],
    ['null', null],
    ['陣列', ['a']],
  ])('F3a：父 key 存在但為%s → 拋錯', (_label, parent) => {
    expect(() => applyDeleteNested({ permissions: parent }, 'permissions', 'defaultMode')).toThrow();
  });
});

describe('isNestedParentShape', () => {
  it('plain object → true', () => {
    expect(isNestedParentShape({})).toBe(true);
    expect(isNestedParentShape({ a: 1 })).toBe(true);
  });

  it.each([
    ['字串', 'x'],
    ['null', null],
    ['陣列', []],
    ['數字', 1],
  ])('%s → false', (_label, value) => {
    expect(isNestedParentShape(value)).toBe(false);
  });
});

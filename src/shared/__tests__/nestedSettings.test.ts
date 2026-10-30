/**
 * #33 C0：巢狀子欄位共用純函式（擴展端、webview 樂觀更新、測試 fake backend 三方共用）。
 * 契約（I9）：不修改輸入、回傳 { next, changed }；父 key 缺席建 {}；
 * 父 key 存在但為 null／陣列／非 plain object → 拋錯（F3a）；刪到父物件變空 → next 不含父 key（I2）。
 */
import { describe, it, expect } from 'vitest';
import {
  applySetNested,
  applyDeleteNested,
  applyAddPermissionsListItem,
  applyRemovePermissionsListItem,
  isNestedParentShape,
} from '../nestedSettings';

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

  it.each(['allow', 'deny', 'ask', 'additionalDirectories'] as const)(
    '#34：permissions.%s 整份清單寫入 → 拋錯（訊息含 key 名），輸入不變',
    (listKey) => {
      const input = { permissions: { [listKey]: ['old'] } };
      const before = clone(input);
      expect(() => applySetNested(input, 'permissions', listKey, ['x'])).toThrow(new RegExp(listKey));
      expect(input).toEqual(before);
    },
  );

  it('#34：permissions 缺席時寫清單 key 一樣拋錯', () => {
    expect(() => applySetNested({ model: 'x' }, 'permissions', 'allow', ['x'])).toThrow(/allow/);
  });

  it('#34：permissions.defaultMode 非清單子欄位 → 照舊寫入', () => {
    const { next, changed } = applySetNested({ permissions: { allow: ['Bash'] } }, 'permissions', 'defaultMode', 'plan');
    expect(changed).toBe(true);
    expect(next).toEqual({ permissions: { allow: ['Bash'], defaultMode: 'plan' } });
  });

  it.each(['allow', 'deny', 'ask', 'additionalDirectories'] as const)(
    '#34：env 底下名為 %s 的變數 → 照舊寫入（只擋 permissions）',
    (name) => {
      const { next, changed } = applySetNested({ env: { A: '1' } }, 'env', name, 'v');
      expect(changed).toBe(true);
      expect(next).toEqual({ env: { A: '1', [name]: 'v' } });
    },
  );
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

// #34 R7：permissions 清單「加一條／刪一條」純函式（擴展端、webview patch、fake backend 共用）。
// 契約：不收 parentKey（固定 permissions）；清單缺席或為 null 視為沒有清單；其他非陣列值與非物件父層拋錯；
// 加一條已存在 → changed:false，否則接尾端；刪一條濾掉全部相同字串，刪到空留 []（不刪 key）；不修改輸入。
describe('applyAddPermissionsListItem（#34 R7）', () => {
  it.each(['allow', 'deny', 'ask', 'additionalDirectories'] as const)('%s：清單有值 → 接在尾端', (listKey) => {
    const { next, changed } = applyAddPermissionsListItem({ permissions: { [listKey]: ['a'] } }, listKey, 'b');
    expect(changed).toBe(true);
    expect(next).toEqual({ permissions: { [listKey]: ['a', 'b'] } });
  });

  it('父 key 缺席 → 建立 permissions 與清單，其他頂層 key 不動', () => {
    const { next, changed } = applyAddPermissionsListItem({ model: 'x' }, 'allow', 'WebFetch');
    expect(changed).toBe(true);
    expect(next).toEqual({ model: 'x', permissions: { allow: ['WebFetch'] } });
  });

  it('父物件存在、清單缺席 → 建立 [item]，其他子欄位與其他清單不動', () => {
    const { next, changed } = applyAddPermissionsListItem(
      { permissions: { defaultMode: 'plan', deny: ['Bash'] } },
      'allow',
      'WebFetch',
    );
    expect(changed).toBe(true);
    expect(next).toEqual({ permissions: { defaultMode: 'plan', deny: ['Bash'], allow: ['WebFetch'] } });
  });

  it('清單為 null → 視為沒有清單，建立 [item]', () => {
    const { next, changed } = applyAddPermissionsListItem({ permissions: { allow: null } }, 'allow', 'WebFetch');
    expect(changed).toBe(true);
    expect(next).toEqual({ permissions: { allow: ['WebFetch'] } });
  });

  it('清單已有完全相同字串 → changed:false、內容不變（不重複）', () => {
    const input = { permissions: { allow: ['Bash', 'WebFetch'] } };
    const { next, changed } = applyAddPermissionsListItem(input, 'allow', 'WebFetch');
    expect(changed).toBe(false);
    expect(next).toEqual(input);
  });

  it('去重只比對完全相同字串（大小寫、前後空白不同視為不同條）', () => {
    const { next, changed } = applyAddPermissionsListItem({ permissions: { allow: ['Bash'] } }, 'allow', 'bash');
    expect(changed).toBe(true);
    expect(next).toEqual({ permissions: { allow: ['Bash', 'bash'] } });
  });

  it('I9：不修改輸入（含父物件與清單），回傳新物件', () => {
    const input = { permissions: { allow: ['Bash'] }, env: { A: '1' } };
    const before = clone(input);
    const listRef = input.permissions.allow;
    const { next } = applyAddPermissionsListItem(input, 'allow', 'WebFetch');
    expect(input).toEqual(before);
    expect(listRef).toEqual(['Bash']);
    expect(next).not.toBe(input);
  });

  it.each([
    ['字串', 'x'],
    ['物件', { a: 1 }],
    ['數字', 1],
  ])('清單為%s → 拋錯，輸入不變', (_label, list) => {
    const input = { permissions: { allow: list } };
    const before = clone(input);
    expect(() => applyAddPermissionsListItem(input, 'allow', 'WebFetch')).toThrow();
    expect(input).toEqual(before);
  });

  it.each([
    ['字串', 'x'],
    ['null', null],
    ['陣列', []],
  ])('父 key 存在但為%s → 拋錯，輸入不變', (_label, parent) => {
    const input = { permissions: parent };
    const before = clone(input);
    expect(() => applyAddPermissionsListItem(input, 'allow', 'WebFetch')).toThrow();
    expect(input).toEqual(before);
  });
});

describe('applyRemovePermissionsListItem（#34 R7）', () => {
  it.each(['allow', 'deny', 'ask', 'additionalDirectories'] as const)('%s：刪掉該條，其餘保持順序', (listKey) => {
    const { next, changed } = applyRemovePermissionsListItem(
      { permissions: { [listKey]: ['a', 'b', 'c'] } },
      listKey,
      'b',
    );
    expect(changed).toBe(true);
    expect(next).toEqual({ permissions: { [listKey]: ['a', 'c'] } });
  });

  it('刪到空 → 留 []，不刪清單 key、不刪父 key', () => {
    const { next, changed } = applyRemovePermissionsListItem({ permissions: { allow: ['Bash'] } }, 'allow', 'Bash');
    expect(changed).toBe(true);
    expect(next).toEqual({ permissions: { allow: [] } });
    expect(Object.hasOwn((next.permissions as Record<string, unknown>), 'allow')).toBe(true);
  });

  it('清單內有重複相同字串 → 全部濾掉', () => {
    const { next, changed } = applyRemovePermissionsListItem({ permissions: { allow: ['a', 'b', 'a'] } }, 'allow', 'a');
    expect(changed).toBe(true);
    expect(next).toEqual({ permissions: { allow: ['b'] } });
  });

  it('清單沒有該字串 → changed:false、內容不變', () => {
    const input = { permissions: { allow: ['Bash'], defaultMode: 'plan' } };
    const { next, changed } = applyRemovePermissionsListItem(input, 'allow', 'WebFetch');
    expect(changed).toBe(false);
    expect(next).toEqual(input);
  });

  it('父 key 缺席 → changed:false，不建立 permissions', () => {
    const { next, changed } = applyRemovePermissionsListItem({ model: 'x' }, 'allow', 'Bash');
    expect(changed).toBe(false);
    expect(next).toEqual({ model: 'x' });
    expect('permissions' in next).toBe(false);
  });

  it.each([
    ['缺席', {}],
    ['null', { allow: null }],
  ])('清單%s → changed:false，不建立清單', (_label, perms) => {
    const { next, changed } = applyRemovePermissionsListItem({ permissions: perms }, 'allow', 'Bash');
    expect(changed).toBe(false);
    expect(next).toEqual({ permissions: perms });
  });

  it('I9：不修改輸入，回傳新物件', () => {
    const input = { permissions: { allow: ['Bash', 'WebFetch'] } };
    const before = clone(input);
    const listRef = input.permissions.allow;
    const { next } = applyRemovePermissionsListItem(input, 'allow', 'Bash');
    expect(input).toEqual(before);
    expect(listRef).toEqual(['Bash', 'WebFetch']);
    expect(next).not.toBe(input);
  });

  it.each([
    ['字串', 'x'],
    ['物件', { a: 1 }],
  ])('清單為%s → 拋錯，輸入不變', (_label, list) => {
    const input = { permissions: { allow: list } };
    const before = clone(input);
    expect(() => applyRemovePermissionsListItem(input, 'allow', 'Bash')).toThrow();
    expect(input).toEqual(before);
  });

  it.each([
    ['字串', 'x'],
    ['null', null],
    ['陣列', []],
  ])('父 key 存在但為%s → 拋錯', (_label, parent) => {
    expect(() => applyRemovePermissionsListItem({ permissions: parent }, 'allow', 'Bash')).toThrow();
  });
});

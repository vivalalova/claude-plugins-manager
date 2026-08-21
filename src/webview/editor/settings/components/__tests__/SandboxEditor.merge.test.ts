/**
 * SandboxEditor 的兩個純合併函式（複審輪 P2-1／P3-1／P3-2 迴歸守門）
 *
 * 契約：
 *   - mergeCredentialEntries：同 id 折疊成一筆，且 deny 勝出（docs credentials.envVars：
 *     「Arrays are merged across all settings scopes, and `deny` takes precedence when the
 *     same variable appears with both modes」）
 *   - mergeDraftRows：props 回灌時列身分對位——已存檔列不重複、順序穩定、半填列不消失
 */
import { describe, it, expect } from 'vitest';
import { mergeCredentialEntries, mergeDraftRows } from '../SandboxEditor';

describe('mergeCredentialEntries', () => {
  it('同名 entry 折疊成一筆且 deny 勝出（不因後蓋前把 deny 降級成 mask）', () => {
    const existing = [
      { name: 'X', mode: 'deny' as const },
      { name: 'X', mode: 'mask' as const, injectHosts: ['a.example.com'] },
    ];
    expect(mergeCredentialEntries(existing, ['X', 'X', 'NEW_VAR'], 'name')).toEqual([
      { name: 'X', mode: 'deny' },
      { name: 'NEW_VAR', mode: 'deny' },
    ]);
  });

  it('單筆既有 entry 的選填欄位原封保留，新名稱建 deny 預設', () => {
    const existing = [{ name: 'X', mode: 'mask' as const, injectHosts: ['a.example.com'] }];
    expect(mergeCredentialEntries(existing, ['X', 'Y'], 'name')).toEqual([
      { name: 'X', mode: 'mask', injectHosts: ['a.example.com'] },
      { name: 'Y', mode: 'deny' },
    ]);
  });

  it('files 以 path 為 id，同 path deny 勝出', () => {
    const existing = [
      { path: '~/.aws/credentials', mode: 'mask' as const },
      { path: '~/.aws/credentials', mode: 'deny' as const },
    ];
    expect(mergeCredentialEntries(existing, ['~/.aws/credentials'], 'path')).toEqual([
      { path: '~/.aws/credentials', mode: 'deny' },
    ]);
  });
});

const row = (a: string, s: string, t = '') => ({ accessKeyIdVar: a, secretAccessKeyVar: s, sessionTokenVar: t });

describe('mergeDraftRows', () => {
  it('props 帶半填列時不複製成兩列', () => {
    const incoming = [row('A', '')];
    expect(mergeDraftRows(incoming, incoming)).toEqual([row('A', '')]);
  });

  it('清空非最後一列的必填欄位後，被編輯的列留在原位置', () => {
    const prev = [row('X1', ''), row('X2', 'Y2')];
    expect(mergeDraftRows(prev, [row('X2', 'Y2')])).toEqual([row('X1', ''), row('X2', 'Y2')]);
  });

  it('別列存檔造成的回灌不抹掉半填列', () => {
    const prev = [row('X1', 'Y1'), row('B', '')];
    expect(mergeDraftRows(prev, [row('X1', 'Y1')])).toEqual([row('X1', 'Y1'), row('B', '')]);
  });

  it('外部新增的列接在後面', () => {
    expect(mergeDraftRows([row('B', '')], [row('N', 'M')])).toEqual([row('B', ''), row('N', 'M')]);
  });

  it('外部刪除的已存檔列跟著消失', () => {
    expect(mergeDraftRows([row('A', 'B'), row('C', 'D')], [row('C', 'D')])).toEqual([row('C', 'D')]);
  });

  it('兩列內容相同的半填列不會被折掉', () => {
    const prev = [row('A', ''), row('A', '')];
    expect(mergeDraftRows(prev, [row('A', '')])).toEqual([row('A', ''), row('A', '')]);
  });
});

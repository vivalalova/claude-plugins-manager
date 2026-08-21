/**
 * Managed-settings-only 的 sandbox 巢狀 key 必須被 value schema 容忍（CLAUDE.md：
 * 「Managed settings only 的 key 不做 first-party UI…只保持 unknown/raw JSON 容忍」）。
 *
 * 拒收會讓既有設定含這些 key 的使用者整個 sandbox 區鎖死——structured 模式的 saveSandbox
 * 驗證整份展開後的 draft，連原封不動存回都被擋。
 */
import { describe, it, expect } from 'vitest';
import { validateJsonSettingValue } from '../jsonSettingValidation';

describe('sandbox managed-only nested keys', () => {
  const cases: Array<[string, unknown]> = [
    ['bwrapPath', { bwrapPath: '/usr/bin/bwrap' }],
    ['socatPath', { socatPath: '/usr/bin/socat' }],
    ['filesystem.allowManagedReadPathsOnly', { filesystem: { allowManagedReadPathsOnly: true } }],
    ['network.allowManagedDomainsOnly', { network: { allowManagedDomainsOnly: true } }],
  ];

  for (const [name, value] of cases) {
    it(`容忍 sandbox.${name}`, () => {
      expect(() => validateJsonSettingValue('sandbox', value)).not.toThrow();
    });
  }

  it('型別仍然嚴格（字串 key 收到 boolean 要拋錯）', () => {
    expect(() => validateJsonSettingValue('sandbox', { bwrapPath: true })).toThrow();
  });
});

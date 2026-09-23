// #31 — 10 個 key 在沒有任何設定檔設值時，Claude Code 會改讀 ~/.claude.json 的舊值。
// schema 以靜態旗標標記這批 key（清單只此一處），本檔鎖定列舉結果與拍板清單一致（A1），
// 並確認它們仍是一般設定檔 key、沒被改標成 storageFile='globalConfig'（A2／I4）。
import { describe, it, expect } from 'vitest';
import {
  getGlobalConfigFallbackSettingKeys,
  getGlobalConfigSettingKeys,
  getFlatFieldSchema,
} from '../claude-settings-schema';

/** issue #31 拍板 P1 的 10 個 key（docs 同型寫法全數納入）。 */
const EXPECTED_FALLBACK_KEYS = [
  'agentPushNotifEnabled',
  'inputNeededNotifEnabled',
  'preferredNotifChannel',
  'remoteControlAtStartup',
  'respectGitignore',
  'showTurnDuration',
  'teammateMode',
  'terminalProgressBarEnabled',
  'theme',
  'verbose',
];

describe('schema — ~/.claude.json 備援標記（#31）', () => {
  it('A1：列舉函式回傳剛好拍板的 10 個 key', () => {
    expect([...getGlobalConfigFallbackSettingKeys()].sort()).toEqual(EXPECTED_FALLBACK_KEYS);
  });

  it('A2（I4）：標記 key 都不是 storageFile="globalConfig"，且與 globalConfig 清單無交集', () => {
    for (const key of getGlobalConfigFallbackSettingKeys()) {
      const field = getFlatFieldSchema(key);
      expect(field, key).toBeDefined();
      expect(field?.storageFile, key).not.toBe('globalConfig');
    }
    const globalConfigKeys = new Set(getGlobalConfigSettingKeys());
    expect(getGlobalConfigFallbackSettingKeys().filter((k) => globalConfigKeys.has(k))).toEqual([]);
  });
});

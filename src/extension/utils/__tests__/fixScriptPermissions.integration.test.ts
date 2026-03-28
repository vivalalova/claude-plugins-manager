/**
 * fixScriptPermissions 整合測試。
 * 真實 filesystem，驗證遞迴修正 .sh 檔案執行權限。
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, chmodSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';
import { fixScriptPermissions } from '../fixScriptPermissions';

const SUITE_TMP = mkdtempSync(join(tmpdir(), 'fix-perm-'));

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

/** 取得檔案 Unix permission bits（低 12 bits） */
function getMode(filePath: string): number {
  return statSync(filePath).mode & 0o7777;
}

describe('fixScriptPermissions', () => {
  let testDir: string;
  let testIdx = 0;

  beforeEach(() => {
    testIdx++;
    testDir = join(SUITE_TMP, `dir-${testIdx}`);
    mkdirSync(testDir, { recursive: true });
  });

  it('.sh 檔案缺少執行權限 → 修正為 755', async () => {
    const sh = join(testDir, 'hook.sh');
    writeFileSync(sh, '#!/bin/bash\necho hello');
    chmodSync(sh, 0o644);

    await fixScriptPermissions(testDir);

    expect(getMode(sh)).toBe(0o755);
  });

  it('巢狀目錄中的 .sh 也會被修正', async () => {
    const nested = join(testDir, 'hooks', 'lib');
    mkdirSync(nested, { recursive: true });
    const sh = join(nested, 'guard.sh');
    writeFileSync(sh, '#!/bin/bash');
    chmodSync(sh, 0o644);

    await fixScriptPermissions(testDir);

    expect(getMode(sh)).toBe(0o755);
  });

  it('已是 755 的 .sh 不會被改動', async () => {
    const sh = join(testDir, 'ok.sh');
    writeFileSync(sh, '#!/bin/bash');
    chmodSync(sh, 0o755);

    await fixScriptPermissions(testDir);

    expect(getMode(sh)).toBe(0o755);
  });

  it('非 .sh 檔案不受影響', async () => {
    const md = join(testDir, 'README.md');
    writeFileSync(md, '# docs');
    chmodSync(md, 0o644);

    const json = join(testDir, 'config.json');
    writeFileSync(json, '{}');
    chmodSync(json, 0o644);

    await fixScriptPermissions(testDir);

    expect(getMode(md)).toBe(0o644);
    expect(getMode(json)).toBe(0o644);
  });

  it('目錄不存在 → 靜默完成，不拋錯', async () => {
    await expect(fixScriptPermissions(join(SUITE_TMP, 'nonexistent'))).resolves.toBeUndefined();
  });

  it('空目錄 → 靜默完成', async () => {
    await expect(fixScriptPermissions(testDir)).resolves.toBeUndefined();
  });

  it('多個 .sh 散布在不同深度 → 全部修正', async () => {
    const paths = [
      join(testDir, 'a.sh'),
      join(testDir, 'sub', 'b.sh'),
      join(testDir, 'sub', 'deep', 'c.sh'),
    ];
    for (const p of paths) {
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, '#!/bin/bash');
      chmodSync(p, 0o644);
    }

    await fixScriptPermissions(testDir);

    for (const p of paths) {
      expect(getMode(p)).toBe(0o755);
    }
  });
});

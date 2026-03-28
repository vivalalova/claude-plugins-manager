import { readdir, chmod, stat } from 'fs/promises';
import { join } from 'path';

/**
 * 遞迴修正目錄內所有 .sh 檔案的執行權限為 0o755。
 * 目錄不存在時靜默返回。
 */
export async function fixScriptPermissions(dir: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await fixScriptPermissions(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.sh')) {
        const s = await stat(fullPath);
        if ((s.mode & 0o111) === 0) {
          await chmod(fullPath, 0o755);
        }
      }
    }),
  );
}

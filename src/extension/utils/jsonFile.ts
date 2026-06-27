import { readFile, writeFile, rename } from 'fs/promises';
import { toErrorMessage } from '../../shared/errorUtils';

/**
 * 讀取 JSON 檔案並解析為指定型別。
 * - ENOENT → 回傳 defaultValue
 * - JSON parse 失敗 → 拋 `Invalid JSON in <filePath>` 錯誤（fail-fast）
 */
export async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultValue;
    }
    throw err;
  }
  try {
    return JSON.parse(content) as T;
  } catch (cause) {
    throw new Error(`Invalid JSON in ${filePath}: ${toErrorMessage(cause)}`, { cause });
  }
}

/**
 * 原子寫入 JSON 檔:先寫暫存檔再 rename。
 * 避免 writeFile 的 O_TRUNC 在截斷後、flush 前被行程中止而留下空白/半寫檔。
 * POSIX 同檔系統 rename 為原子操作。呼叫端須自行序列化同一 filePath 的並發寫入
 * (暫存檔固定為 `<filePath>.tmp`)。
 */
export async function writeJsonFileAtomic<T>(filePath: string, data: T): Promise<void> {
  const tmpPath = filePath + '.tmp';
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n');
  await rename(tmpPath, filePath);
}

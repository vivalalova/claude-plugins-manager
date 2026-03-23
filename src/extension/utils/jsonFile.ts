import { readFile } from 'fs/promises';

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
    throw new Error(`Invalid JSON in ${filePath}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}

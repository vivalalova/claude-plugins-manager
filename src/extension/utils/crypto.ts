import { createHash } from 'crypto';

/** SHA-256 hash 取前 16 字元（用於 cache key） */
export function hashShort(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

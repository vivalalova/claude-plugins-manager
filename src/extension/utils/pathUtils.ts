import { join } from 'path';
import { homedir } from 'os';

/** 展開 `~/` 開頭的路徑為絕對路徑 */
export function expandTildePath(p: string): string {
  return p.startsWith('~/') ? join(homedir(), p.slice(2)) : p;
}

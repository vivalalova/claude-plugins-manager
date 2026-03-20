/**
 * 解析 shell command 中的第一個 token，支援 quoted/unquoted 與 shell escaped quote。
 * 回傳解析出的 token 與剩餘字串；空字串或無法解析回傳 null。
 */
export function parseShellToken(raw: string): { token: string; rest: string } | null {
  if (!raw) return null;

  // 跳過前導空白，讓函式自足不依賴呼叫端 trim
  let i = 0;
  while (i < raw.length && /\s/.test(raw[i])) i++;
  if (i >= raw.length) return null;

  let token = '';

  while (i < raw.length) {
    const ch = raw[i];
    if (/\s/.test(ch)) break;

    if (ch === '\'') {
      i++;
      while (i < raw.length && raw[i] !== '\'') {
        token += raw[i];
        i++;
      }
      if (i >= raw.length) {
        throw new Error('Unterminated single-quoted string');
      }
      i++;
      continue;
    }

    if (ch === '"') {
      i++;
      while (i < raw.length && raw[i] !== '"') {
        if (raw[i] === '\\' && i + 1 < raw.length) {
          i++;
        }
        token += raw[i];
        i++;
      }
      if (i >= raw.length) {
        throw new Error('Unterminated double-quoted string');
      }
      i++;
      continue;
    }

    if (ch === '\\' && i + 1 < raw.length) {
      token += raw[i + 1];
      i += 2;
      continue;
    }

    token += ch;
    i++;
  }

  return token ? { token, rest: raw.slice(i) } : null;
}

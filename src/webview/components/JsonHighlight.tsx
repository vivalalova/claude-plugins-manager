import React, { useMemo } from 'react';

/** JSON token 類型 */
type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation';

interface Token {
  type: TokenType;
  value: string;
}

/**
 * 簡易 JSON tokenizer。
 * 將 JSON 字串拆成有類型的 token 序列，供 CSS 上色。
 */
export function tokenizeJson(json: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < json.length) {
    const ch = json[i];

    // whitespace — 直接加為 punctuation（保留格式）
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      let ws = '';
      while (i < json.length && (json[i] === ' ' || json[i] === '\t' || json[i] === '\n' || json[i] === '\r')) {
        ws += json[i];
        i++;
      }
      tokens.push({ type: 'punctuation', value: ws });
      continue;
    }

    // punctuation: { } [ ] , :
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === ',' || ch === ':') {
      tokens.push({ type: 'punctuation', value: ch });
      i++;
      continue;
    }

    // string (key or value — disambiguate after)
    if (ch === '"') {
      let str = '"';
      i++;
      while (i < json.length && json[i] !== '"') {
        if (json[i] === '\\' && i + 1 < json.length) {
          str += json[i] + json[i + 1];
          i += 2;
        } else {
          str += json[i];
          i++;
        }
      }
      if (i < json.length) {
        str += '"';
        i++; // skip closing quote
      }

      // Look ahead past whitespace for ':' → this is a key
      let lookAhead = i;
      while (lookAhead < json.length && (json[lookAhead] === ' ' || json[lookAhead] === '\t' || json[lookAhead] === '\n' || json[lookAhead] === '\r')) {
        lookAhead++;
      }
      const isKey = json[lookAhead] === ':';
      tokens.push({ type: isKey ? 'key' : 'string', value: str });
      continue;
    }

    // number
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let num = '';
      while (i < json.length && /[\d.eE+\-]/.test(json[i])) {
        num += json[i];
        i++;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // boolean / null
    if (json.slice(i, i + 4) === 'true') {
      tokens.push({ type: 'boolean', value: 'true' });
      i += 4;
      continue;
    }
    if (json.slice(i, i + 5) === 'false') {
      tokens.push({ type: 'boolean', value: 'false' });
      i += 5;
      continue;
    }
    if (json.slice(i, i + 4) === 'null') {
      tokens.push({ type: 'null', value: 'null' });
      i += 4;
      continue;
    }

    // fallback — unknown char
    tokens.push({ type: 'punctuation', value: ch });
    i++;
  }

  return tokens;
}

interface JsonHighlightProps {
  /** JSON string to highlight */
  json: string;
}

/**
 * JSON 語法高亮顯示元件。
 * 純 CSS + 簡易 tokenizer，附行號。
 * 顏色透過 CSS variables 適配 VSCode light/dark theme。
 */
export function JsonHighlight({ json }: JsonHighlightProps): React.ReactElement {
  const lines = useMemo(() => {
    const tokens = tokenizeJson(json);
    const result: Token[][] = [[]];
    for (const token of tokens) {
      if (token.type === 'punctuation' && token.value.includes('\n')) {
        const parts = token.value.split('\n');
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) result.push([]);
          if (parts[i]) {
            result[result.length - 1].push({ type: 'punctuation', value: parts[i] });
          }
        }
      } else {
        result[result.length - 1].push(token);
      }
    }
    return result;
  }, [json]);

  return (
    <div className="json-highlight">
      <table className="json-highlight-table" role="presentation">
        <tbody>
          {lines.map((lineTokens, lineIdx) => (
            <tr key={lineIdx}>
              <td className="json-line-number" aria-hidden="true">
                {lineIdx + 1}
              </td>
              <td className="json-line-content">
                {lineTokens.map((token, tokenIdx) => (
                  <span key={tokenIdx} className={`json-token--${token.type}`}>
                    {token.value}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

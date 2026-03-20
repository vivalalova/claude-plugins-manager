import { describe, it, expect } from 'vitest';
import { parseShellToken } from '../shellTokenParser';

describe('parseShellToken', () => {
  it('空字串回傳 null', () => {
    expect(parseShellToken('')).toBeNull();
  });

  it('unquoted token', () => {
    expect(parseShellToken('hello world')).toEqual({ token: 'hello', rest: ' world' });
  });

  it('unquoted token 無 rest', () => {
    expect(parseShellToken('hello')).toEqual({ token: 'hello', rest: '' });
  });

  it('single-quoted token', () => {
    expect(parseShellToken("'hello world' rest")).toEqual({ token: 'hello world', rest: ' rest' });
  });

  it('double-quoted token', () => {
    expect(parseShellToken('"hello world" rest')).toEqual({ token: 'hello world', rest: ' rest' });
  });

  it('double-quote 內 backslash escape', () => {
    expect(parseShellToken('"hello\\"world"')).toEqual({ token: 'hello"world', rest: '' });
  });

  it('shell-escaped single quote: \'team\'\\\'\'s-plugin\'', () => {
    const input = "'team'\\''s-plugin' --scope project";
    expect(parseShellToken(input)).toEqual({ token: "team's-plugin", rest: ' --scope project' });
  });

  it('backslash escape outside quotes', () => {
    expect(parseShellToken('hello\\ world rest')).toEqual({ token: 'hello world', rest: ' rest' });
  });

  it('unterminated single quote → throw', () => {
    expect(() => parseShellToken("'unterminated")).toThrow('Unterminated single-quoted');
  });

  it('unterminated double quote → throw', () => {
    expect(() => parseShellToken('"unterminated')).toThrow('Unterminated double-quoted');
  });

  it('只有空白 → null', () => {
    expect(parseShellToken('   ')).toBeNull();
  });

  it('前導空白自動跳過', () => {
    expect(parseShellToken('  hello world')).toEqual({ token: 'hello', rest: ' world' });
  });

  it('混合引號串接：double + single', () => {
    expect(parseShellToken('"hello"\'world\'')).toEqual({ token: 'helloworld', rest: '' });
  });

  it('末尾反斜線當普通字元處理', () => {
    expect(parseShellToken('hello\\')).toEqual({ token: 'hello\\', rest: '' });
  });
});

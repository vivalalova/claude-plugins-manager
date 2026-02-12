import { describe, it, expect } from 'vitest';
import { parseMcpJson } from '../parseMcpJson';

describe('parseMcpJson', () => {
  /* ═══════ 正常解析 ═══════ */

  it('解析 mcpServers wrapper 格式', () => {
    const json = JSON.stringify({
      mcpServers: {
        'my-server': { command: 'npx', args: ['-y', 'my-mcp'] },
      },
    });
    const result = parseMcpJson(json);
    expect(result).toEqual({
      name: 'my-server',
      commandOrUrl: 'npx',
      args: ['-y', 'my-mcp'],
      transport: 'stdio',
      env: undefined,
      headers: undefined,
    });
  });

  it('解析無 wrapper 的直接格式', () => {
    const json = JSON.stringify({
      'my-server': { command: 'node', args: ['server.js'] },
    });
    const result = parseMcpJson(json);
    expect(result.name).toBe('my-server');
    expect(result.commandOrUrl).toBe('node');
    expect(result.args).toEqual(['server.js']);
    expect(result.transport).toBe('stdio');
  });

  it('解析 URL 型 server，預設 transport 為 http', () => {
    const json = JSON.stringify({
      'remote': { url: 'https://mcp.example.com/sse' },
    });
    const result = parseMcpJson(json);
    expect(result.commandOrUrl).toBe('https://mcp.example.com/sse');
    expect(result.transport).toBe('http');
  });

  it('偵測 JSON 中的 type 欄位決定 transport', () => {
    const json = JSON.stringify({
      'remote': { url: 'https://mcp.example.com/sse', type: 'sse' },
    });
    expect(parseMcpJson(json).transport).toBe('sse');
  });

  it('偵測 JSON 中的 transport 欄位', () => {
    const json = JSON.stringify({
      'remote': { url: 'https://mcp.example.com', transport: 'http' },
    });
    expect(parseMcpJson(json).transport).toBe('http');
  });

  it('解析 env 並轉為 string', () => {
    const json = JSON.stringify({
      's': { command: 'cmd', env: { KEY: 'val', NUM: 42 } },
    });
    const result = parseMcpJson(json);
    expect(result.env).toEqual({ KEY: 'val', NUM: '42' });
  });

  it('解析 headers object 轉為 "Key: value" 陣列', () => {
    const json = JSON.stringify({
      's': {
        url: 'https://example.com',
        headers: { Authorization: 'Bearer token', 'X-Custom': 'val' },
      },
    });
    const result = parseMcpJson(json);
    expect(result.headers).toEqual([
      'Authorization: Bearer token',
      'X-Custom: val',
    ]);
  });

  it('headers 中 null 值被過濾', () => {
    const json = JSON.stringify({
      's': {
        url: 'https://example.com',
        headers: { Good: 'ok', Bad: null },
      },
    });
    const result = parseMcpJson(json);
    expect(result.headers).toEqual(['Good: ok']);
  });

  it('非 string 的 args 元素會被 String() 轉換', () => {
    const json = JSON.stringify({
      's': { command: 'cmd', args: ['a', 123, true] },
    });
    const result = parseMcpJson(json);
    expect(result.args).toEqual(['a', '123', 'true']);
  });

  it('空 args 回傳 undefined', () => {
    const json = JSON.stringify({
      's': { command: 'cmd', args: [] },
    });
    expect(parseMcpJson(json).args).toBeUndefined();
  });

  it('空 env 回傳 undefined', () => {
    const json = JSON.stringify({
      's': { command: 'cmd', env: {} },
    });
    expect(parseMcpJson(json).env).toBeUndefined();
  });

  /* ═══════ 錯誤處理 ═══════ */

  it('非 object JSON → 拋錯', () => {
    expect(() => parseMcpJson('"string"')).toThrow('JSON must be an object');
    expect(() => parseMcpJson('[1,2]')).toThrow('JSON must be an object');
    expect(() => parseMcpJson('null')).toThrow('JSON must be an object');
  });

  it('mcpServers 為非 object → 拋錯', () => {
    const json = JSON.stringify({ mcpServers: 'bad' });
    expect(() => parseMcpJson(json)).toThrow('mcpServers must be an object');
  });

  it('mcpServers 為 array → 拋錯', () => {
    const json = JSON.stringify({ mcpServers: [1, 2] });
    expect(() => parseMcpJson(json)).toThrow('mcpServers must be an object');
  });

  it('空 object → 拋錯', () => {
    expect(() => parseMcpJson('{}')).toThrow('No MCP server found');
  });

  it('多個 server → 拋錯提示一次一個', () => {
    const json = JSON.stringify({
      a: { command: 'cmd1' },
      b: { command: 'cmd2' },
    });
    expect(() => parseMcpJson(json)).toThrow('Please paste one server at a time');
  });

  it('config 為 array → 拋錯', () => {
    const json = JSON.stringify({ 'bad': [1, 2, 3] });
    expect(() => parseMcpJson(json)).toThrow('Invalid config for "bad"');
  });

  it('config 為 primitive → 拋錯', () => {
    const json = JSON.stringify({ 'bad': 'string' });
    expect(() => parseMcpJson(json)).toThrow('Invalid config for "bad"');
  });

  it('缺少 command 和 url → 拋錯', () => {
    const json = JSON.stringify({ 's': { args: ['a'] } });
    expect(() => parseMcpJson(json)).toThrow('must contain "command" or "url"');
  });

  it('不合法 JSON → 拋錯', () => {
    expect(() => parseMcpJson('not json')).toThrow();
  });

  it('headers 為 array 時忽略（非 object）', () => {
    const json = JSON.stringify({
      's': { command: 'cmd', headers: ['bad'] },
    });
    expect(parseMcpJson(json).headers).toBeUndefined();
  });

  it('env 為 array 時忽略（非 object）', () => {
    const json = JSON.stringify({
      's': { command: 'cmd', env: ['bad'] },
    });
    expect(parseMcpJson(json).env).toBeUndefined();
  });
});

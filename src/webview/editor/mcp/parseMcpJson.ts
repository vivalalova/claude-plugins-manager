import type { McpAddParams } from '../../../shared/types';

/**
 * 解析使用者貼入的 MCP JSON 設定。
 * 接受兩種格式：
 *   1. `{ "mcpServers": { "name": { ... } } }`
 *   2. `{ "name": { ... } }`
 */
export function parseMcpJson(raw: string): Omit<McpAddParams, 'scope'> {
  const parsed = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON must be an object');
  }

  // 若有 mcpServers wrapper 就解包
  const servers = parsed.mcpServers ?? parsed;
  if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) {
    throw new Error('mcpServers must be an object');
  }

  const entries = Object.entries(servers);
  if (entries.length === 0) {
    throw new Error('No MCP server found in JSON');
  }
  if (entries.length > 1) {
    throw new Error(`Found ${entries.length} servers. Please paste one server at a time.`);
  }

  const [name, config] = entries[0] as [string, unknown];
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error(`Invalid config for "${name}"`);
  }
  const cfg = config as Record<string, unknown>;

  // stdio: command + args
  const command = typeof cfg.command === 'string' ? cfg.command : undefined;
  const rawArgs = cfg.args;
  let args: string[] | undefined;
  if (Array.isArray(rawArgs)) {
    args = rawArgs.every((a) => typeof a === 'string')
      ? (rawArgs as string[])
      : rawArgs.map(String);
  }

  // http/sse: url
  const url = typeof cfg.url === 'string' ? cfg.url : undefined;

  if (!command && !url) {
    throw new Error('JSON must contain "command" or "url"');
  }

  // transport：偵測 JSON 中的 type 欄位，fallback 為 url → http、command → stdio
  let transport: McpAddParams['transport'];
  const rawType = cfg.type ?? cfg.transport;
  if (rawType === 'stdio' || rawType === 'sse' || rawType === 'http') {
    transport = rawType;
  } else {
    transport = url ? 'http' : 'stdio';
  }
  const commandOrUrl = url ?? command!;

  // env（驗證 key/value 皆為 string）
  let env: Record<string, string> | undefined;
  if (cfg.env && typeof cfg.env === 'object' && !Array.isArray(cfg.env)) {
    env = {};
    for (const [k, v] of Object.entries(cfg.env as Record<string, unknown>)) {
      env[k] = String(v);
    }
  }

  // headers（object → "Key: value" array，驗證非 array）
  let headers: string[] | undefined;
  if (cfg.headers && typeof cfg.headers === 'object' && !Array.isArray(cfg.headers)) {
    headers = Object.entries(cfg.headers as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${String(v)}`);
  }

  return {
    name,
    commandOrUrl,
    args: args?.length ? args : undefined,
    transport,
    env: env && Object.keys(env).length > 0 ? env : undefined,
    headers: headers?.length ? headers : undefined,
  };
}

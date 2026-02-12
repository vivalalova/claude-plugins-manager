import { describe, it, expect, vi } from 'vitest';
import type { McpServer } from '../../../../shared/types';

// Mock vscode webview API（McpPage.tsx 間接 import）
vi.mock('../../../vscode', () => ({
  sendRequest: vi.fn(),
  onPushMessage: vi.fn(() => () => {}),
}));

// 必須在 mock 之後 import
const { buildEditServerInfo } = await import('../McpPage');

describe('buildEditServerInfo', () => {
  it('有 config 時優先用結構化的 command/args', () => {
    const server: McpServer = {
      name: 'XcodeBuildMCP',
      fullName: 'XcodeBuildMCP',
      command: 'npx -y xcodebuildmcp@latest mcp',
      status: 'connected',
      scope: 'local',
      config: { command: 'npx', args: ['-y', 'xcodebuildmcp@latest', 'mcp'] },
    };

    expect(buildEditServerInfo(server)).toEqual({
      name: 'XcodeBuildMCP',
      commandOrUrl: 'npx',
      args: ['-y', 'xcodebuildmcp@latest', 'mcp'],
      scope: 'local',
    });
  });

  it('無 config 時 fallback 到 command 字串', () => {
    const server: McpServer = {
      name: 'my-server',
      fullName: 'my-server',
      command: 'npx -y @upstash/context7-mcp',
      status: 'connected',
      scope: 'user',
    };

    expect(buildEditServerInfo(server)).toEqual({
      name: 'my-server',
      commandOrUrl: 'npx -y @upstash/context7-mcp',
      args: undefined,
      scope: 'user',
    });
  });

  it('plugin 來源 server：name 取 shortName', () => {
    const server: McpServer = {
      name: 'context7',
      fullName: 'plugin:context7:context7',
      command: 'npx -y @upstash/context7-mcp',
      status: 'connected',
      scope: 'local',
    };

    const result = buildEditServerInfo(server);
    expect(result.name).toBe('context7');
    expect(result.commandOrUrl).toBe('npx -y @upstash/context7-mcp');
    expect(result.scope).toBe('local');
  });

  it('scope undefined 時保留 undefined', () => {
    const server: McpServer = {
      name: 'orphan',
      fullName: 'orphan',
      command: 'node server.js',
      status: 'failed',
    };

    expect(buildEditServerInfo(server)).toEqual({
      name: 'orphan',
      commandOrUrl: 'node server.js',
      args: undefined,
      scope: undefined,
    });
  });

  it('HTTP URL command 完整保留', () => {
    const server: McpServer = {
      name: 'remote',
      fullName: 'remote',
      command: 'https://api.example.com/mcp',
      status: 'connected',
      scope: 'project',
    };

    expect(buildEditServerInfo(server)).toEqual({
      name: 'remote',
      commandOrUrl: 'https://api.example.com/mcp',
      args: undefined,
      scope: 'project',
    });
  });

  it('config 有 args=[] 時保留空陣列', () => {
    const server: McpServer = {
      name: 'simple',
      fullName: 'simple',
      command: 'node server.js',
      status: 'connected',
      scope: 'user',
      config: { command: 'node', args: [] },
    };

    expect(buildEditServerInfo(server)).toEqual({
      name: 'simple',
      commandOrUrl: 'node',
      args: [],
      scope: 'user',
    });
  });
});

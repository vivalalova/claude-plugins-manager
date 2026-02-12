import React, { useState } from 'react';
import type { McpAddParams, McpScope } from '../../../shared/types';
import { sendRequest } from '../../vscode';
import { parseMcpJson } from './parseMcpJson';

type InputMode = 'form' | 'json';

interface AddMcpDialogProps {
  onAdded: () => void;
  onCancel: () => void;
}

/**
 * 新增 MCP Server 對話框。
 * 支援 Form 手動填寫與 JSON 貼上兩種模式。
 */
export function AddMcpDialog({
  onAdded,
  onCancel,
}: AddMcpDialogProps): React.ReactElement {
  const [mode, setMode] = useState<InputMode>('form');

  // Form mode state
  const [name, setName] = useState('');
  const [commandOrUrl, setCommandOrUrl] = useState('');
  const [transport, setTransport] = useState('stdio');
  const [envText, setEnvText] = useState('');
  const [headersText, setHeadersText] = useState('');

  // JSON mode state
  const [jsonText, setJsonText] = useState('');

  // Shared state
  const [scope, setScope] = useState('project');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Form mode → 組裝 params */
  const buildFormParams = (): McpAddParams => {
    if (!name.trim() || !commandOrUrl.trim()) {
      throw new Error('Name and Command/URL are required');
    }

    const env: Record<string, string> = {};
    for (const line of envText.split('\n').filter(Boolean)) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }

    const headers = headersText
      .split('\n')
      .map((h) => h.trim())
      .filter(Boolean);

    return {
      name: name.trim(),
      commandOrUrl: commandOrUrl.trim(),
      transport: transport as McpAddParams['transport'],
      scope: scope as McpScope,
      env: Object.keys(env).length > 0 ? env : undefined,
      headers: headers.length > 0 ? headers : undefined,
    };
  };

  /** JSON mode → 解析 JSON + scope */
  const buildJsonParams = (): McpAddParams => {
    if (!jsonText.trim()) {
      throw new Error('Please paste MCP server JSON');
    }
    const parsed = parseMcpJson(jsonText);
    return { ...parsed, scope: scope as McpScope };
  };

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    let params: McpAddParams;
    try {
      params = mode === 'form' ? buildFormParams() : buildJsonParams();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }

    setAdding(true);
    try {
      await sendRequest({ type: 'mcp.add', params });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAdding(false);
    }
  };

  const canSubmit = mode === 'form'
    ? !adding && !!name.trim() && !!commandOrUrl.trim()
    : !adding && !!jsonText.trim();

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className="confirm-dialog"
        style={{ maxWidth: 500 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-title">Add MCP Server</div>

        <div className="tabs">
          <button
            className={`tab${mode === 'form' ? ' tab-active' : ''}`}
            onClick={() => { setMode('form'); setError(null); }}
          >
            Form
          </button>
          <button
            className={`tab${mode === 'json' ? ' tab-active' : ''}`}
            onClick={() => { setMode('json'); setError(null); }}
          >
            JSON
          </button>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 12 }}>
            <span>{error}</span>
            <button className="btn-dismiss" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {mode === 'form' ? (
          <>
            <div className="form-row">
              <label className="form-label">Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-server"
              />
            </div>

            <div className="form-row">
              <label className="form-label">Command / URL</label>
              <input
                className="input"
                value={commandOrUrl}
                onChange={(e) => setCommandOrUrl(e.target.value)}
                placeholder="npx my-mcp-server or https://..."
              />
            </div>

            <div className="form-row">
              <label className="form-label">Transport</label>
              <select className="select" value={transport} onChange={(e) => setTransport(e.target.value)}>
                <option value="stdio">stdio</option>
                <option value="http">http</option>
                <option value="sse">sse</option>
              </select>
            </div>

            <div className="form-row">
              <label className="form-label">Scope</label>
              <select className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="project">project (shared)</option>
                <option value="local">local (private)</option>
                <option value="user">user (global)</option>
              </select>
            </div>

            <div className="form-row" style={{ alignItems: 'flex-start' }}>
              <label className="form-label">Env vars</label>
              <textarea
                className="input"
                rows={3}
                value={envText}
                onChange={(e) => setEnvText(e.target.value)}
                placeholder={"KEY=value\nANOTHER_KEY=value"}
                style={{ resize: 'vertical' }}
              />
            </div>

            {(transport === 'http' || transport === 'sse') && (
              <div className="form-row" style={{ alignItems: 'flex-start' }}>
                <label className="form-label">Headers</label>
                <textarea
                  className="input"
                  rows={2}
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  placeholder={"Authorization: Bearer token\nX-Custom: value"}
                  style={{ resize: 'vertical' }}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="form-row" style={{ alignItems: 'flex-start' }}>
              <label className="form-label">Config</label>
              <textarea
                className="input"
                rows={8}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={'{\n  "mcpServers": {\n    "my-server": {\n      "command": "npx",\n      "args": ["-y", "my-mcp-server"]\n    }\n  }\n}'}
                style={{ resize: 'vertical', fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 12 }}
              />
            </div>

            <div className="form-row">
              <label className="form-label">Scope</label>
              <select className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="project">project (shared)</option>
                <option value="local">local (private)</option>
                <option value="user">user (global)</option>
              </select>
            </div>
          </>
        )}

        <div className="confirm-dialog-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {adding ? 'Adding...' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  );
}

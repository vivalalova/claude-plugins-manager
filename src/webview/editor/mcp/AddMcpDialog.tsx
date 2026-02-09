import React, { useState } from 'react';
import { sendRequest } from '../../vscode';

interface AddMcpDialogProps {
  onAdded: () => void;
  onCancel: () => void;
}

/**
 * 新增 MCP Server 對話框。
 * 表單：name, command/URL, transport, scope, env, headers。
 */
export function AddMcpDialog({
  onAdded,
  onCancel,
}: AddMcpDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [commandOrUrl, setCommandOrUrl] = useState('');
  const [transport, setTransport] = useState('stdio');
  const [scope, setScope] = useState('local');
  const [envText, setEnvText] = useState('');
  const [headersText, setHeadersText] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim() || !commandOrUrl.trim()) {
      setError('Name and Command/URL are required');
      return;
    }

    setAdding(true);
    setError(null);

    // 解析 env（KEY=value 格式，每行一組）
    const env: Record<string, string> = {};
    for (const line of envText.split('\n').filter(Boolean)) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }

    // 解析 headers（每行一個 "Header: value"）
    const headers = headersText
      .split('\n')
      .map((h) => h.trim())
      .filter(Boolean);

    try {
      await sendRequest({
        type: 'mcp.add',
        params: {
          name: name.trim(),
          commandOrUrl: commandOrUrl.trim(),
          transport: transport as 'stdio' | 'sse' | 'http',
          scope: scope as 'local' | 'user' | 'project',
          env: Object.keys(env).length > 0 ? env : undefined,
          headers: headers.length > 0 ? headers : undefined,
        },
      });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAdding(false);
    }
  };

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className="confirm-dialog"
        style={{ maxWidth: 500 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-title">Add MCP Server</div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 12 }}>
            <span>{error}</span>
            <button className="btn-dismiss" onClick={() => setError(null)}>×</button>
          </div>
        )}

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
            <option value="local">local (workspace)</option>
            <option value="user">user (global)</option>
            <option value="project">project</option>
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

        <div className="confirm-dialog-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={adding || !name.trim() || !commandOrUrl.trim()}
          >
            {adding ? 'Adding...' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  );
}

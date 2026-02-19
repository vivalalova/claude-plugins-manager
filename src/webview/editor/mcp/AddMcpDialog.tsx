import React, { useId, useState } from 'react';
import type { McpAddParams, McpScope } from '../../../shared/types';
import { sendRequest } from '../../vscode';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { parseMcpJson } from './parseMcpJson';

type InputMode = 'form' | 'json';

/** 編輯模式傳入的 server 資訊 */
export interface EditServerInfo {
  name: string;
  commandOrUrl: string;
  args?: string[];
  scope?: McpScope;
}

interface AddMcpDialogProps {
  onAdded: () => void;
  onCancel: () => void;
  /** 編輯模式：預填現有 server 資訊，submit 時先 remove 再 add */
  editServer?: EditServerInfo;
}

/**
 * 新增 MCP Server 對話框。
 * 支援 Form 手動填寫與 JSON 貼上兩種模式。
 */
export function AddMcpDialog({
  onAdded,
  onCancel,
  editServer,
}: AddMcpDialogProps): React.ReactElement {
  const isEdit = !!editServer;
  const [mode, setMode] = useState<InputMode>('form');

  // Form mode state（編輯模式預填）
  const [name, setName] = useState(editServer?.name ?? '');
  const [commandOrUrl, setCommandOrUrl] = useState(editServer?.commandOrUrl ?? '');
  const [transport, setTransport] = useState('stdio');
  const [envText, setEnvText] = useState('');
  const [headersText, setHeadersText] = useState('');

  // JSON mode state
  const [jsonText, setJsonText] = useState('');

  // Shared state
  const [scope, setScope] = useState<McpScope>(editServer?.scope ?? 'project');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();
  const nameId = useId();
  const commandId = useId();
  const transportId = useId();
  const scopeId = useId();
  const envId = useId();
  const headersId = useId();
  const configId = useId();
  const jsonScopeId = useId();
  const trapRef = useFocusTrap(onCancel);

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
      args: editServer?.args,
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
      // 編輯模式：先移除舊 server
      if (isEdit && editServer) {
        await sendRequest({
          type: 'mcp.remove',
          name: editServer.name,
          scope: editServer.scope,
        });
      }
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
        ref={trapRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: 500 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-title" id={titleId}>
          {isEdit ? 'Edit MCP Server' : 'Add MCP Server'}
        </div>

        {!isEdit && (
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
        )}

        {error && (
          <div style={{ marginBottom: 12 }}>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {mode === 'form' ? (
          <>
            <div className="form-row">
              <label className="form-label" htmlFor={nameId}>Name</label>
              <input
                id={nameId}
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-server"
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor={commandId}>Command / URL</label>
              <input
                id={commandId}
                className="input"
                value={commandOrUrl}
                onChange={(e) => setCommandOrUrl(e.target.value)}
                placeholder="npx my-mcp-server or https://..."
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor={transportId}>Transport</label>
              <select id={transportId} className="select" value={transport} onChange={(e) => setTransport(e.target.value)}>
                <option value="stdio">stdio</option>
                <option value="http">http</option>
                <option value="sse">sse</option>
              </select>
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor={scopeId}>Scope</label>
              <select id={scopeId} className="select" value={scope} onChange={(e) => setScope(e.target.value as McpScope)}>
                <option value="project">project (shared)</option>
                <option value="local">local (private)</option>
                <option value="user">user (global)</option>
              </select>
            </div>

            <div className="form-row" style={{ alignItems: 'flex-start' }}>
              <label className="form-label" htmlFor={envId}>Env vars</label>
              <textarea
                id={envId}
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
                <label className="form-label" htmlFor={headersId}>Headers</label>
                <textarea
                  id={headersId}
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
              <label className="form-label" htmlFor={configId}>Config</label>
              <textarea
                id={configId}
                className="input"
                rows={8}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={'{\n  "mcpServers": {\n    "my-server": {\n      "command": "npx",\n      "args": ["-y", "my-mcp-server"]\n    }\n  }\n}'}
                style={{ resize: 'vertical', fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: 12 }}
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor={jsonScopeId}>Scope</label>
              <select id={jsonScopeId} className="select" value={scope} onChange={(e) => setScope(e.target.value as McpScope)}>
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
            {adding
              ? (isEdit ? 'Updating...' : 'Adding...')
              : (isEdit ? 'Update Server' : 'Add Server')}
          </button>
        </div>
      </div>
    </div>
  );
}

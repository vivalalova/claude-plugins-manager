import React, { useEffect, useState } from 'react';
import { sendRequest } from '../../vscode';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, HookCommand, PluginScope } from '../../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_CMD_LEN = 60;
const FILE_PATH_RE = /^(?:\/|~\/)/;

function truncate(s: string): string {
  return s.length > MAX_CMD_LEN ? `${s.slice(0, MAX_CMD_LEN)}…` : s;
}

function getHookContent(hook: HookCommand): string {
  return hook.type === 'command' ? hook.command :
         hook.type === 'http'    ? hook.url :
         (hook as { prompt: string }).prompt;
}

function extractFilePath(command: string): string | null {
  const firstToken = command.split(' ')[0];
  return FILE_PATH_RE.test(firstToken) ? firstToken : null;
}

function getHookLabel(hook: HookCommand): string {
  switch (hook.type) {
    case 'command': return truncate(hook.command);
    case 'prompt':  return truncate(hook.prompt);
    case 'agent':   return truncate(hook.prompt);
    case 'http':    return truncate(hook.url);
  }
}

function getHookDetail(hook: HookCommand): string | null {
  const parts: string[] = [];
  if ('model' in hook && hook.model) parts.push(hook.model);
  return parts.length ? parts.join(' · ') : null;
}

// ---------------------------------------------------------------------------
// HookItem
// ---------------------------------------------------------------------------

interface HookItemProps {
  hook: HookCommand;
  eventType: string;
  filePath: string | null;
  onOpenFile: (path: string) => Promise<void>;
  openingPath: string | null;
  explainLabel: string;
  explainingLabel: string;
  onExplain: (hookContent: string, eventType: string) => Promise<void>;
  explanation: string | null;
  isExplaining: boolean;
}

function HookItem({ hook, eventType, filePath, onOpenFile, openingPath, explainLabel, explainingLabel, onExplain, explanation, isExplaining }: HookItemProps): React.ReactElement {
  const label = getHookLabel(hook);
  const detail = getHookDetail(hook);
  const fullCmd = getHookContent(hook);
  const isOpening = filePath !== null && openingPath === filePath;

  return (
    <div className="hooks-hook-item-wrapper">
      <div className="hooks-hook-item" title={fullCmd}>
        <span className="hooks-hook-type">{hook.type}</span>
        <span className="hooks-hook-label">{label}</span>
        {detail && <span className="hooks-hook-detail">{detail}</span>}
        {filePath && (
          <button
            className="btn btn-icon"
            title="Open file"
            type="button"
            disabled={isOpening}
            onClick={() => void onOpenFile(filePath)}
          >
            {isOpening ? '⏳' : '📂'}
          </button>
        )}
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          disabled={isExplaining}
          aria-label={isExplaining ? explainingLabel : explainLabel}
          onClick={() => void onExplain(fullCmd, eventType)}
        >
          {isExplaining ? <span className="scope-spinner hooks-explain-spinner" aria-hidden="true" /> : explainLabel}
        </button>
      </div>
      {explanation && (
        <details className="hooks-explanation" open>
          <summary className="hooks-explanation-summary">AI</summary>
          <p className="hooks-explanation-body">{explanation}</p>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HooksSection
// ---------------------------------------------------------------------------

interface HooksSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function HooksSection({ scope, settings, onSave, onDelete }: HooksSectionProps): React.ReactElement {
  const { t, locale } = useI18n();
  const { addToast } = useToast();
  const [toggling, setToggling] = useState(false);
  const [opening, setOpening] = useState(false);
  const [existingPaths, setExistingPaths] = useState<ReadonlySet<string>>(new Set());
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Map<string, string>>(new Map());
  const [explaining, setExplaining] = useState<ReadonlySet<string>>(new Set());

  const hooksData = settings.hooks ?? {};
  const eventTypes = Object.keys(hooksData);
  const disableAllHooks = settings.disableAllHooks ?? false;

  useEffect(() => {
    const allPaths: string[] = [];
    for (const matchers of Object.values(hooksData)) {
      for (const group of matchers) {
        for (const hook of group.hooks) {
          if (hook.type === 'command') {
            const p = extractFilePath(hook.command);
            if (p) allPaths.push(p);
          }
        }
      }
    }
    const uniquePaths = Array.from(new Set(allPaths));
    if (uniquePaths.length === 0) {
      setExistingPaths(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const existing = await sendRequest<string[]>({ type: 'hooks.checkFilePaths', paths: uniquePaths });
        if (!cancelled) setExistingPaths(new Set(existing));
      } catch {
        if (!cancelled) setExistingPaths(new Set());
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.hooks]);

  // mount 時觸發過期快取清理（fire-and-forget）
  useEffect(() => {
    void sendRequest({ type: 'hooks.cleanExpiredExplanations' }).catch(() => {});
  }, []);

  const handleExplain = async (hookContent: string, eventType: string): Promise<void> => {
    const key = `${hookContent}:${eventType}:${locale}`;
    if (explanations.has(key)) return;
    setExplaining((prev) => new Set([...prev, key]));
    try {
      const { explanation } = await sendRequest<{ explanation: string; fromCache: boolean }>({
        type: 'hooks.explain',
        hookContent,
        eventType,
        locale,
      }, 120_000);
      setExplanations((prev) => new Map([...prev, [key, explanation]]));
    } catch {
      addToast(t('settings.hooks.explanationError'), 'error');
    } finally {
      setExplaining((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleOpenFile = async (filePath: string): Promise<void> => {
    setOpeningPath(filePath);
    try {
      await sendRequest({ type: 'hooks.openFile', path: filePath });
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOpeningPath(null);
    }
  };

  const handleToggleDisable = async (): Promise<void> => {
    setToggling(true);
    try {
      if (disableAllHooks) {
        await onDelete('disableAllHooks');
      } else {
        await onSave('disableAllHooks', true);
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setToggling(false);
    }
  };

  const handleOpenInEditor = async (): Promise<void> => {
    setOpening(true);
    try {
      await sendRequest({ type: 'settings.openInEditor', scope });
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.hooks')}</h3>

      {/* Header row: disableAllHooks toggle + openInEditor button */}
      <div className="hooks-header-row">
        <label className="hooks-toggle-label">
          <input
            type="checkbox"
            checked={disableAllHooks}
            onChange={() => void handleToggleDisable()}
            disabled={toggling}
          />
          {t('settings.hooks.disableAll')}
        </label>
        <button
          className="btn btn-secondary"
          onClick={() => void handleOpenInEditor()}
          disabled={opening}
          type="button"
        >
          {t('settings.hooks.openInEditor')}
        </button>
      </div>

      {/* Tree view */}
      {eventTypes.length === 0 ? (
        <div className="hooks-empty">
          <p>{t('settings.hooks.empty')}</p>
          <button
            className="btn btn-secondary"
            onClick={() => void handleOpenInEditor()}
            disabled={opening}
            type="button"
          >
            {t('settings.hooks.emptyAction')}
          </button>
        </div>
      ) : (
        <div className="hooks-tree">
          {eventTypes.map((eventType) => {
            const matchers = hooksData[eventType] ?? [];
            return (
              <div key={eventType} className="hooks-event-node">
                <div className="hooks-event-title">{eventType}</div>
                {matchers.map((matcherGroup, mIdx) => (
                  <div key={mIdx} className="hooks-matcher-node">
                    <span className="hooks-matcher-label">
                      {matcherGroup.matcher || '*'}
                    </span>
                    <div className="hooks-hook-list">
                      {matcherGroup.hooks.map((hook, hIdx) => (
                        <HookItem
                          key={hIdx}
                          hook={hook}
                          eventType={eventType}
                          filePath={hook.type === 'command' && existingPaths.has(extractFilePath(hook.command) ?? '') ? extractFilePath(hook.command) : null}
                          onOpenFile={handleOpenFile}
                          openingPath={openingPath}
                          explainLabel={t('settings.hooks.explain')}
                          explainingLabel={t('settings.hooks.explaining')}
                          onExplain={handleExplain}
                          explanation={explanations.get(`${getHookContent(hook)}:${eventType}:${locale}`) ?? null}
                          isExplaining={explaining.has(`${getHookContent(hook)}:${eventType}:${locale}`)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sendRequest } from '../../vscode';
import { toErrorMessage } from '../../../shared/errorUtils';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import type { HookCommand } from '../../../shared/types';
import type { SectionProps } from './components/SchemaSection';
import { SettingsSectionWrapper } from './components/SettingsSectionWrapper';
import { SETTINGS_FLAT_SCHEMA } from '../../../shared/claude-settings-schema';
import { SchemaFieldRenderer } from './components/SchemaFieldRenderer';
import { getOverriddenScope } from './components/SettingControls';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_CMD_LEN = 60;
const FILE_PATH_RE = /^(?:\/|~\/)/;
const MAX_EXPLAIN_ERROR_LEN = 120;
const LEADING_PATH_RE = /^(?:"([^"]+)"|'([^']+)'|(\S+))/;

function truncate(s: string): string {
  return s.length > MAX_CMD_LEN ? `${s.slice(0, MAX_CMD_LEN)}…` : s;
}

function formatExplainError(baseMessage: string, error: unknown): string {
  const message = toErrorMessage(error);
  const firstLine = message.split(/\r?\n/, 1)[0]?.trim() ?? '';
  if (!firstLine) return baseMessage;

  const timeoutMatch = firstLine.match(/CLI timeout after \d+ms/);
  if (timeoutMatch) {
    return `${baseMessage}: ${timeoutMatch[0]}`;
  }

  if (firstLine.includes('Claude CLI not found')) {
    return `${baseMessage}: Claude CLI not found`;
  }

  const shortReason = firstLine.length > MAX_EXPLAIN_ERROR_LEN
    ? `${firstLine.slice(0, MAX_EXPLAIN_ERROR_LEN).trimEnd()}...`
    : firstLine;

  return `${baseMessage}: ${shortReason}`;
}

function getHookContent(hook: HookCommand): string {
  return hook.type === 'command' ? hook.command :
         hook.type === 'http'    ? hook.url :
         (hook as { prompt: string }).prompt;
}

function extractFilePath(command: string): string | null {
  const match = command.trim().match(LEADING_PATH_RE);
  const firstToken = match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
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

function inlineMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** 只保留已知安全的 HTML tag，strip 其餘（defense-in-depth） */
const ALLOWED_TAG_RE = /^<\/?(strong|em|code|ul|li|p|br\s*\/?)>$/i;
function stripUnallowedTags(html: string): string {
  return html.replace(/<\/?[a-z][a-z0-9]*[^>]*\/?>/gi, (tag) =>
    ALLOWED_TAG_RE.test(tag) ? tag : '',
  );
}

/** 簡易 markdown → HTML：bold, code, list, paragraph */
function renderSimpleMarkdown(text: string): string {
  const raw = text
    .trim()
    .split(/\n\s*\n/)
    .map(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return '';
      if (lines.every(l => /^[-*]\s+/.test(l))) {
        return '<ul>' + lines.map(l =>
          '<li>' + inlineMarkdown(l.replace(/^[-*]\s+/, '')) + '</li>'
        ).join('') + '</ul>';
      }
      return '<p>' + lines.map(l => inlineMarkdown(l)).join('<br/>') + '</p>';
    })
    .filter(Boolean)
    .join('');
  return stripUnallowedTags(raw);
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
  explainTooltip: string;
  onExplain: (hookContent: string, eventType: string, filePath: string | null) => Promise<void>;
  explanation: string | null;
  isExplaining: boolean;
}

function HookItem({ hook, eventType, filePath, onOpenFile, openingPath, explainLabel, explainingLabel, explainTooltip, onExplain, explanation, isExplaining }: HookItemProps): React.ReactElement {
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
          className={`btn btn-sm ${explanation ? 'btn-icon' : 'btn-secondary'}`}
          type="button"
          disabled={isExplaining}
          aria-label={isExplaining ? explainingLabel : explainLabel}
          title={explainTooltip}
          onClick={() => void onExplain(fullCmd, eventType, filePath)}
        >
          {isExplaining
            ? <span className="scope-spinner hooks-explain-spinner" aria-hidden="true" />
            : explanation
              ? <svg className="hooks-refresh-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M13.45 5.17A6 6 0 0 0 2.05 7H.5l2.5 3 2.5-3H3.95a4.5 4.5 0 0 1 8.53-1.33l.97-.5ZM13 6l-2.5 3h1.55a4.5 4.5 0 0 1-8.53 1.33l-.97.5A6 6 0 0 0 13.95 9H15.5L13 6Z" /></svg>
              : explainLabel}
        </button>
      </div>
      {explanation && (
        <div
          className="hooks-explanation-text"
          dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(explanation) }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HooksSection
// ---------------------------------------------------------------------------

export function HooksSection({ scope, settings, userSettings, onSave, onDelete }: SectionProps): React.ReactElement {
  const { t, locale } = useI18n();
  const { addToast } = useToast();
  const [opening, setOpening] = useState(false);
  const [existingPaths, setExistingPaths] = useState<ReadonlySet<string>>(new Set());
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Map<string, string>>(new Map());
  const [explaining, setExplaining] = useState<ReadonlySet<string>>(new Set());

  const hooksData = useMemo(() => settings.hooks ?? {}, [settings.hooks]);
  const eventTypes = Object.keys(hooksData);

  // Fingerprint for deep-equality effect triggering (avoids re-fire on reference-only changes)
  const hooksFingerprint = useMemo(() => {
    const keys = Object.keys(hooksData).sort();
    if (keys.length === 0) return '';
    return keys.map((k) => {
      const matchers = hooksData[k] ?? [];
      return `${k}:${matchers.map((m) =>
        `${m.matcher ?? ''}[${m.hooks.map((h) => getHookContent(h)).join(',')}]`,
      ).join('|')}`;
    }).join(';');
  }, [hooksData]);

  // Ref for locale — effect reads latest value without triggering re-run
  const localeRef = useRef(locale);
  localeRef.current = locale;

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
  }, [hooksFingerprint, hooksData]);

  // mount 時觸發過期快取清理（fire-and-forget）
  useEffect(() => {
    void sendRequest({ type: 'hooks.cleanExpiredExplanations' }).catch(() => {});
  }, []);

  // mount 時載入磁碟快取的解釋
  useEffect(() => {
    const items: Array<{ hookContent: string; locale: string; filePath?: string }> = [];
    for (const matchers of Object.values(hooksData)) {
      for (const group of matchers) {
        for (const hook of group.hooks) {
          const content = getHookContent(hook);
          const fp = hook.type === 'command' ? extractFilePath(hook.command) ?? undefined : undefined;
          items.push({ hookContent: content, locale: localeRef.current, filePath: fp });
        }
      }
    }
    if (items.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const cached = await sendRequest<Record<string, string>>({ type: 'hooks.loadCachedExplanations', items });
        if (!cancelled && Object.keys(cached).length > 0) {
          setExplanations((prev) => new Map([...prev, ...Object.entries(cached)]));
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [hooksFingerprint, hooksData]);

  const handleExplain = async (hookContent: string, eventType: string, filePath: string | null): Promise<void> => {
    const key = `${filePath ?? hookContent}:${locale}`;
    const isRefresh = explanations.has(key);
    setExplaining((prev) => new Set([...prev, key]));
    try {
      const { explanation } = await sendRequest<{ explanation: string; fromCache: boolean }>({
        type: 'hooks.explain',
        hookContent,
        eventType,
        locale,
        filePath: filePath ?? undefined,
        refresh: isRefresh || undefined,
      }, 120_000);
      setExplanations((prev) => new Map([...prev, [key, explanation]]));
    } catch (e) {
      addToast(formatExplainError(t('settings.hooks.explanationError'), e), 'error');
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
      addToast(toErrorMessage(e), 'error');
    } finally {
      setOpeningPath(null);
    }
  };

  const handleOpenInEditor = async (): Promise<void> => {
    setOpening(true);
    try {
      await sendRequest({ type: 'settings.openInEditor', scope });
    } catch (e) {
      addToast(toErrorMessage(e), 'error');
    } finally {
      setOpening(false);
    }
  };

  return (
    <SettingsSectionWrapper>
      <SchemaFieldRenderer
        settingKey="disableAllHooks"
        schema={SETTINGS_FLAT_SCHEMA['disableAllHooks']}
        value={settings.disableAllHooks}
        scope={scope}
        overriddenScope={getOverriddenScope(scope, userSettings as Record<string, unknown>, 'disableAllHooks')}
        onSave={onSave}
        onDelete={onDelete}
      />

      <div className="hooks-header-row">
        <button
          className="btn btn-secondary"
          onClick={() => void handleOpenInEditor()}
          disabled={opening}
          type="button"
        >
          {t('settings.hooks.openInEditor')}
        </button>
      </div>

      <SchemaFieldRenderer
        settingKey="httpHookAllowedEnvVars"
        schema={SETTINGS_FLAT_SCHEMA['httpHookAllowedEnvVars']}
        value={settings.httpHookAllowedEnvVars}
        scope={scope}
        overriddenScope={getOverriddenScope(scope, userSettings as Record<string, unknown>, 'httpHookAllowedEnvVars')}
        onSave={onSave}
        onDelete={onDelete}
      />

      <SchemaFieldRenderer
        settingKey="allowedHttpHookUrls"
        schema={SETTINGS_FLAT_SCHEMA['allowedHttpHookUrls']}
        value={settings.allowedHttpHookUrls}
        scope={scope}
        overriddenScope={getOverriddenScope(scope, userSettings as Record<string, unknown>, 'allowedHttpHookUrls')}
        onSave={onSave}
        onDelete={onDelete}
      />

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
                      {matcherGroup.hooks.map((hook, hIdx) => {
                        const fp = hook.type === 'command' && existingPaths.has(extractFilePath(hook.command) ?? '') ? extractFilePath(hook.command) : null;
                        const uiKey = `${fp ?? getHookContent(hook)}:${locale}`;
                        return (
                          <HookItem
                            key={hIdx}
                            hook={hook}
                            eventType={eventType}
                            filePath={fp}
                            onOpenFile={handleOpenFile}
                            openingPath={openingPath}
                            explainLabel={t('settings.hooks.explain')}
                            explainingLabel={t('settings.hooks.explaining')}
                            explainTooltip={t('settings.hooks.explainTooltip')}
                            onExplain={handleExplain}
                            explanation={explanations.get(uiKey) ?? null}
                            isExplaining={explaining.has(uiKey)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </SettingsSectionWrapper>
  );
}

import React, { useState } from 'react';
import { sendRequest } from '../../vscode';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, HookCommand, PluginScope } from '../../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_CMD_LEN = 60;

function truncate(s: string): string {
  return s.length > MAX_CMD_LEN ? `${s.slice(0, MAX_CMD_LEN)}…` : s;
}

function getHookLabel(hook: HookCommand): string {
  switch (hook.type) {
    case 'command': return truncate(hook.command);
    case 'prompt':  return truncate(hook.prompt);
    case 'agent':   return truncate(hook.prompt);
    case 'http':    return truncate(hook.url);
  }
}

function getHookDetail(hook: HookCommand, timeoutLabel: string): string | null {
  const parts: string[] = [];
  if ('model' in hook && hook.model) parts.push(hook.model);
  if ('timeout' in hook && hook.timeout != null) parts.push(`${timeoutLabel}: ${hook.timeout}s`);
  return parts.length ? parts.join(' · ') : null;
}

// ---------------------------------------------------------------------------
// HookItem
// ---------------------------------------------------------------------------

function HookItem({ hook, timeoutLabel }: { hook: HookCommand; timeoutLabel: string }): React.ReactElement {
  const label = getHookLabel(hook);
  const detail = getHookDetail(hook, timeoutLabel);
  const fullCmd =
    hook.type === 'command' ? hook.command :
    hook.type === 'http'    ? hook.url :
    (hook as { prompt: string }).prompt;

  return (
    <div className="hooks-hook-item" title={fullCmd}>
      <span className="hooks-hook-type">{hook.type}</span>
      <span className="hooks-hook-label">{label}</span>
      {detail && <span className="hooks-hook-detail">{detail}</span>}
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
  const { t } = useI18n();
  const { addToast } = useToast();
  const [toggling, setToggling] = useState(false);
  const [opening, setOpening] = useState(false);

  const hooksData = settings.hooks ?? {};
  const eventTypes = Object.keys(hooksData);
  const disableAllHooks = settings.disableAllHooks ?? false;

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
                          timeoutLabel={t('settings.hooks.timeout')}
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

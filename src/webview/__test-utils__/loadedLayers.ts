import type { ClaudeSettings, PluginScope } from '../../shared/types';
import type { ScopeSettings } from '../editor/settings/components/SchemaSection';

/**
 * 測試用：把「各層原始設定」包成產品碼的 ScopeSettings（每層 `{kind:'loaded', settings}`）。
 * `{}` 表示該層已載入但沒設；缺 key＝沒有這層；整份 undefined＝快照未就緒。
 */
export function loadedLayers(raw: Partial<Record<PluginScope, object>>): ScopeSettings;
export function loadedLayers(raw: Partial<Record<PluginScope, object>> | undefined): ScopeSettings | undefined;
export function loadedLayers(raw: Partial<Record<PluginScope, object>> | undefined): ScopeSettings | undefined {
  if (raw === undefined) return undefined;
  const out: ScopeSettings = {};
  for (const [scope, settings] of Object.entries(raw) as Array<[PluginScope, object]>) {
    out[scope] = { kind: 'loaded', settings: settings as ClaudeSettings };
  }
  return out;
}

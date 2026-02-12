import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendRequest } from '../../vscode';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PluginCard } from './PluginCard';
import type {
  InstalledPlugin,
  AvailablePlugin,
  MergedPlugin,
  PluginListResponse,
  PluginScope,
} from '../../../shared/types';

interface WorkspaceFolder {
  name: string;
  path: string;
}

/**
 * Plugin 管理頁面。
 * Search bar 過濾，按 marketplace 分 section，組內按名稱排序。
 */
export function PluginPage(): React.ReactElement {
  const [plugins, setPlugins] = useState<MergedPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [workspaceFolders, setWorkspaceFolders] = useState<WorkspaceFolder[]>([]);
  // 預設收合，使用者手動展開的 marketplace 加入此 set
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [marketplaceSources, setMarketplaceSources] = useState<Record<string, string>>({});
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translateLang, setTranslateLang] = useState(
    () => localStorage.getItem('plugin.translateLang') ?? '',
  );
  const [pendingTexts, setPendingTexts] = useState<Set<string>>(new Set());
  const translateVersionRef = useRef(0);
  useEffect(() => {
    sendRequest<WorkspaceFolder[]>({ type: 'workspace.getFolders' })
      .then(setWorkspaceFolders)
      .catch(() => {});
  }, []);

  /** 拉取完整列表。showSpinner=false 時靜默刷新，避免畫面閃爍 */
  const fetchAll = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const data = await sendRequest<PluginListResponse>(
        { type: 'plugin.listAvailable' },
      );
      setPlugins(mergePlugins(data.installed, data.available));
      setMarketplaceSources(data.marketplaceSources ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /** 語言變更或 plugins 載入後自動翻譯（分批送出，逐批更新 UI） */
  const doTranslate = useCallback(async (lang: string, items: MergedPlugin[]) => {
    const version = ++translateVersionRef.current;

    if (!lang) {
      setTranslations({});
      setPendingTexts(new Set());
      return;
    }

    const texts = [...new Set(
      items.map((p) => p.description).filter((d): d is string => !!d),
    )];
    if (texts.length === 0) return;

    // 分批：每 5 筆一組，對應後端 450 字元批次
    const CHUNK_SIZE = 5;
    const chunks: string[][] = [];
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      chunks.push(texts.slice(i, i + CHUNK_SIZE));
    }

    setTranslations({});
    setPendingTexts(new Set(texts));

    await Promise.all(chunks.map(async (chunk) => {
      try {
        const result = await sendRequest<Record<string, string>>(
          { type: 'plugin.translate', texts: chunk, targetLang: lang },
        );
        if (translateVersionRef.current !== version) return;
        setTranslations((prev) => ({ ...prev, ...result }));
      } catch {
        // 翻譯失敗不影響主流程
      } finally {
        if (translateVersionRef.current !== version) return;
        setPendingTexts((prev) => {
          const next = new Set(prev);
          for (const t of chunk) next.delete(t);
          return next;
        });
      }
    }));
  }, []);

  useEffect(() => {
    if (plugins.length > 0) doTranslate(translateLang, plugins);
  }, [translateLang, plugins, doTranslate]);

  const handleLangChange = (lang: string): void => {
    setTranslateLang(lang);
    localStorage.setItem('plugin.translateLang', lang);
  };

  /** 過濾 + 按 marketplace 分組 */
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    let filtered = q
      ? plugins.filter((p) =>
        p.name.toLowerCase().includes(q)
        || (p.description?.toLowerCase().includes(q) ?? false),
      )
      : plugins;

    if (filterEnabled) {
      filtered = filtered.filter((p) =>
        p.userInstall?.enabled
        || p.projectInstalls.some((i) => i.enabled)
        || p.localInstall?.enabled,
      );
    }

    const groups = new Map<string, MergedPlugin[]>();
    for (const p of filtered) {
      const key = p.marketplaceName ?? 'other';
      const arr = groups.get(key);
      if (arr) {
        arr.push(p);
      } else {
        groups.set(key, [p]);
      }
    }
    return groups;
  }, [plugins, search, filterEnabled]);

  /** Toggle = 勾 → install + enable，取消勾 → disable */
  const handleToggle = async (
    pluginId: string,
    scope: PluginScope,
    enable: boolean,
  ): Promise<void> => {
    setError(null);
    try {
      if (enable) {
        try {
          await sendRequest({ type: 'plugin.install', plugin: pluginId, scope });
        } catch {
          // 已安裝 → 靜默
        }
        try {
          await sendRequest({ type: 'plugin.enable', plugin: pluginId, scope });
        } catch {
          // install 已自動 enable → 靜默
        }
      } else {
        try {
          await sendRequest({ type: 'plugin.disable', plugin: pluginId, scope });
        } catch {
          // 已 disabled → 靜默
        }
      }
      await fetchAll(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUpdate = async (pluginId: string): Promise<void> => {
    setError(null);
    try {
      await sendRequest({ type: 'plugin.update', plugin: pluginId });
      await fetchAll(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">Plugins Manager</div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={() => fetchAll()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="search-row">
        <input
          className="input search-bar"
          type="text"
          placeholder="Search plugins..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filterEnabled}
            onChange={() => setFilterEnabled((v) => !v)}
          />
          <span>Enabled</span>
        </label>
        <select
          className="input translate-select"
          value={translateLang}
          onChange={(e) => handleLangChange(e.target.value)}
          disabled={pendingTexts.size > 0}
        >
          <option value="">English</option>
          <option value="zh-TW">繁體中文</option>
          <option value="zh-CN">简体中文</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="es">Español</option>
        </select>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingSpinner message="Loading plugins..." />
      ) : grouped.size === 0 ? (
        <div className="empty-state">
          {search ? 'No plugins match your search.' : 'No plugins found. Add a marketplace first.'}
        </div>
      ) : (
        [...grouped.entries()].map(([marketplace, items]) => {
          // 搜尋或 Enabled filter 啟用時強制展開所有 section，方便一覽結果
          const isCollapsed = !filterEnabled && !search && !expanded.has(marketplace);
          const installedCount = items.filter((p) =>
            p.userInstall || p.projectInstalls.length > 0 || p.localInstall,
          ).length;
          return (
            <div key={marketplace} className="plugin-section">
              <button
                className={`section-toggle${isCollapsed ? ' section-toggle--collapsed' : ''}`}
                onClick={() => setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(marketplace)) next.delete(marketplace);
                  else next.add(marketplace);
                  return next;
                })}
              >
                <span className={`section-chevron${isCollapsed ? ' section-chevron--collapsed' : ''}`}>&#9662;</span>
                <span className="section-toggle-label">{marketplace}</span>
                <span className="section-count">{installedCount} / {items.length}</span>
                {marketplaceSources[marketplace] && (
                  <span className="section-source">{marketplaceSources[marketplace]}</span>
                )}
              </button>
              <div className={`section-body${isCollapsed ? ' section-body--collapsed' : ''}`}>
                <div className="section-body-inner">
                  <div className="card-list">
                    {items.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        workspaceName={workspaceFolders[0]?.name}
                        translations={translations}
                        translating={!!translateLang && pendingTexts.has(plugin.description ?? '')}
                        onToggle={(scope, enable) => handleToggle(plugin.id, scope, enable)}
                        onUpdate={() => handleUpdate(plugin.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * 合併 installed + available 為統一列表。
 * 按名稱字母排序。
 */
function mergePlugins(
  installed: InstalledPlugin[],
  available: AvailablePlugin[],
): MergedPlugin[] {
  const map = new Map<string, MergedPlugin>();

  // 先處理已安裝的
  for (const inst of installed) {
    const [name, marketplace] = inst.id.split('@');
    const existing = map.get(inst.id);

    if (existing) {
      if (inst.scope === 'user') {
        existing.userInstall = inst;
      } else if (inst.scope === 'project') {
        existing.projectInstalls.push(inst);
      } else if (inst.scope === 'local') {
        existing.localInstall = inst;
      }
    } else {
      map.set(inst.id, {
        id: inst.id,
        name,
        marketplaceName: marketplace,
        version: inst.version,
        description: inst.description,
        userInstall: inst.scope === 'user' ? inst : null,
        projectInstalls: inst.scope === 'project' ? [inst] : [],
        localInstall: inst.scope === 'local' ? inst : null,
      });
    }
  }

  // 補充 available 的 description，加入未安裝的
  for (const avail of available) {
    const id = avail.pluginId ?? `${avail.name}@${avail.marketplaceName}`;
    const existing = map.get(id);

    if (existing) {
      if (avail.description) existing.description = avail.description;
      if (avail.contents) existing.contents = avail.contents;
      if (!existing.version && avail.version) {
        existing.version = avail.version;
      }
    } else {
      map.set(id, {
        id,
        name: avail.name,
        marketplaceName: avail.marketplaceName,
        description: avail.description,
        version: avail.version,
        contents: avail.contents,
        userInstall: null,
        projectInstalls: [],
        localInstall: null,
      });
    }
  }

  // 按名稱排序
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

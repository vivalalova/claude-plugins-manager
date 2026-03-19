import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendRequest, onPushMessage } from '../../vscode';
import { SkillCardSkeleton } from '../../components/Skeleton';
import { EmptyState, SkillIcon, NoResultsIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkillToolbar } from './SkillToolbar';
import { SkillSections } from './SkillSections';
import { SkillSearchResultCard } from './SkillSearchResultCard';
import { AddSkillDialog, RemoveConfirmDialog } from './SkillDialogs';
import { useToast } from '../../components/Toast';
import { useDebouncedValue } from '../../hooks/useDebounce';
import type { AgentSkill, SkillScope, SkillSearchResult } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

type SearchMode = 'local' | 'online';

/**
 * Skills 管理頁面。
 * Local 模式：已安裝 skills 列表 + add/remove。
 * Online 模式：npx skills find 線上搜尋 + install。
 */
export function SkillsPage(): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();

  // --- Local mode state ---
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<SkillScope | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingSkill, setAddingSkill] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ name: string; scope: SkillScope } | null>(null);
  const [removingSkills, setRemovingSkills] = useState<Set<string>>(new Set());
  const [hasWorkspace, setHasWorkspace] = useState(false);

  // --- Shared state ---
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('local');

  // --- Online mode state ---
  const [onlineResults, setOnlineResults] = useState<SkillSearchResult[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [installingSkills, setInstallingSkills] = useState<Set<string>>(new Set());
  const [debouncedSearch, flushSearch] = useDebouncedValue(search, 500);
  const searchIdRef = useRef(0);

  // --- Fetch installed list ---
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sendRequest<AgentSkill[]>({ type: 'skill.list' });
      setSkills(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
    sendRequest<Array<{ name: string }>>({ type: 'workspace.getFolders' })
      .then((folders) => setHasWorkspace(folders.length > 0))
      .catch(() => {});
  }, [fetchList]);

  useEffect(() => {
    return onPushMessage((msg) => {
      if (msg.type === 'skill.refresh') fetchList();
    });
  }, [fetchList]);

  // --- Online search effect ---
  useEffect(() => {
    if (searchMode !== 'online') return;
    const query = debouncedSearch.trim();
    if (query.length < 2) {
      setOnlineResults([]);
      setOnlineError(null);
      return;
    }

    const id = ++searchIdRef.current;
    setOnlineLoading(true);
    setOnlineError(null);

    sendRequest<SkillSearchResult[]>({ type: 'skill.find', query })
      .then((results) => {
        if (searchIdRef.current === id) {
          setOnlineResults(results);
        }
      })
      .catch((e) => {
        if (searchIdRef.current === id) {
          setOnlineError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (searchIdRef.current === id) {
          setOnlineLoading(false);
        }
      });
  }, [debouncedSearch, searchMode]);

  // --- Mode switch ---
  const handleModeChange = (mode: SearchMode): void => {
    setSearchMode(mode);
    setSearch('');
    flushSearch('');
    setOnlineResults([]);
    setOnlineError(null);
  };

  // --- Local filter ---
  const filtered = useMemo(() => {
    let result = skills;
    if (scopeFilter) {
      result = result.filter((s) => s.scope === scopeFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [skills, scopeFilter, search]);

  const globalSkills = useMemo(() => filtered.filter((s) => s.scope === 'global'), [filtered]);
  const projectSkills = useMemo(() => filtered.filter((s) => s.scope === 'project'), [filtered]);

  // --- Handlers ---
  const handleAdd = async (source: string, scope: SkillScope): Promise<void> => {
    setAddingSkill(true);
    try {
      await sendRequest<void>({ type: 'skill.add', source, scope }, 90_000);
      setShowAddDialog(false);
      await fetchList();
    } catch (e) {
      addToast(t('skill.error.add') + ': ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setAddingSkill(false);
    }
  };

  const handleRemove = async (name: string, scope: SkillScope): Promise<void> => {
    const key = `${scope}:${name}`;
    setRemovingSkills((prev) => new Set(prev).add(key));
    setConfirmRemove(null);
    try {
      await sendRequest<void>({ type: 'skill.remove', name, scope });
      await fetchList();
    } catch (e) {
      addToast(t('skill.error.remove') + ': ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setRemovingSkills((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  const handleInstallFromSearch = async (source: string, scope: SkillScope): Promise<void> => {
    setInstallingSkills((prev) => new Set(prev).add(source));
    try {
      await sendRequest<void>({ type: 'skill.add', source, scope }, 90_000);
      await fetchList();
      addToast(`Installed ${source}`, 'success');
    } catch (e) {
      addToast(t('skill.error.add') + ': ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setInstallingSkills((prev) => { const next = new Set(prev); next.delete(source); return next; });
    }
  };

  const handleViewOnline = (url: string): void => {
    sendRequest<void>({ type: 'openExternal', url }).catch(() => {});
  };

  const handleOpenFile = (path: string): void => {
    sendRequest<void>({ type: 'skill.openFile', path }).catch(() => {});
  };

  // --- Render ---
  const renderOnlineContent = (): React.ReactNode => {
    const query = search.trim();

    if (onlineError) {
      return <ErrorBanner message={onlineError} onDismiss={() => setOnlineError(null)} />;
    }

    if (onlineLoading) {
      return <SkillCardSkeleton />;
    }

    if (query.length < 2) {
      return <div className="skill-search-hint">{t('skill.search.minChars')}</div>;
    }

    if (onlineResults.length === 0) {
      return (
        <EmptyState
          icon={<NoResultsIcon />}
          title={t('skill.search.noResults').replace('{query}', query)}
        />
      );
    }

    return (
      <div className="card-list">
        {onlineResults.map((result) => (
          <SkillSearchResultCard
            key={result.fullId}
            result={result}
            installing={installingSkills.has(result.fullId)}
            hasWorkspace={hasWorkspace}
            onInstall={handleInstallFromSearch}
            onViewOnline={handleViewOnline}
          />
        ))}
      </div>
    );
  };

  const renderLocalContent = (): React.ReactNode => {
    if (loading) return <SkillCardSkeleton />;

    if (skills.length === 0) {
      return (
        <EmptyState
          icon={<SkillIcon />}
          title={t('skill.page.noSkills')}
          description={t('skill.page.noSkillsDesc')}
          action={{ label: t('skill.page.add'), onClick: () => setShowAddDialog(true) }}
        />
      );
    }

    if (filtered.length === 0) {
      return (
        <EmptyState
          icon={<NoResultsIcon />}
          title={t('skill.page.noResults')}
          action={{ label: t('skill.page.clearFilters'), onClick: () => { setSearch(''); setScopeFilter(null); } }}
        />
      );
    }

    return (
      <SkillSections
        globalSkills={globalSkills}
        projectSkills={projectSkills}
        removingSkills={removingSkills}
        onRemove={(name, scope) => setConfirmRemove({ name, scope })}
        onOpenFile={handleOpenFile}
      />
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">{t('skill.page.title')}</h2>
        <button className="btn btn-sm" onClick={fetchList} disabled={loading}>
          {t('skill.page.refresh')}
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <SkillToolbar
        search={search}
        onSearchChange={setSearch}
        searchMode={searchMode}
        onSearchModeChange={handleModeChange}
        scopeFilter={scopeFilter}
        onScopeFilterChange={setScopeFilter}
        onAddClick={() => setShowAddDialog(true)}
      />

      {searchMode === 'online' ? renderOnlineContent() : renderLocalContent()}

      <AddSkillDialog
        open={showAddDialog}
        adding={addingSkill}
        hasWorkspace={hasWorkspace}
        onSubmit={handleAdd}
        onClose={() => setShowAddDialog(false)}
      />

      {confirmRemove && (
        <RemoveConfirmDialog
          skillName={confirmRemove.name}
          skillScope={confirmRemove.scope}
          onConfirm={() => handleRemove(confirmRemove.name, confirmRemove.scope)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

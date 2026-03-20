import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendRequest, onPushMessage, getViewState, setViewState } from '../../vscode';
import { SkillCardSkeleton } from '../../components/Skeleton';
import { EmptyState, SkillIcon, NoResultsIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkillToolbar } from './SkillToolbar';
import type { PageTab } from './SkillToolbar';
import { SkillSections } from './SkillSections';
import { SkillSearchResultCard } from './SkillSearchResultCard';
import { RegistrySkillCard } from './RegistrySkillCard';
import { AddSkillDialog, RemoveConfirmDialog } from './SkillDialogs';
import { SkillDetailPanel } from './SkillDetailPanel';
import { useToast } from '../../components/Toast';
import { useDebouncedValue } from '../../hooks/useDebounce';
import type { AgentSkill, RegistrySkill, RegistrySort, SkillScope, SkillSearchResult } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

/**
 * Skills 管理頁面。
 * Installed：已安裝 skills 列表 + add/remove。
 * Online：npx skills find 線上搜尋 + install。
 * Registry：skills.sh 排行榜 + install。
 */
export function SkillsPage(): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();

  // --- Installed state ---
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<SkillScope | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingSkill, setAddingSkill] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ name: string; scope: SkillScope } | null>(null);
  const [removingSkills, setRemovingSkills] = useState<Set<string>>(new Set());
  const [hasWorkspace, setHasWorkspace] = useState(false);

  // --- Agent selection (persisted in viewState) ---
  const [selectedAgents, setSelectedAgents] = useState<string[]>(() => getViewState<string[]>('skill.agents', ['claude-code']));

  // --- Shared ---
  const [search, setSearch] = useState('');
  const [pageTab, setPageTab] = useState<PageTab>('installed');
  const [installingSkills, setInstallingSkills] = useState<Set<string>>(new Set());
  const [debouncedSearch, flushSearch] = useDebouncedValue(search, 500);
  const searchIdRef = useRef(0);

  // --- Online state ---
  const [onlineResults, setOnlineResults] = useState<SkillSearchResult[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  // --- Check/Update state ---
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  // --- Detail state ---
  const [detailSkill, setDetailSkill] = useState<AgentSkill | null>(null);
  const [detailData, setDetailData] = useState<{ frontmatter: Record<string, string>; body: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // --- Registry state ---
  const [registrySort, setRegistrySort] = useState<RegistrySort>('all-time');
  const [registryResults, setRegistryResults] = useState<RegistrySkill[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const registryCacheRef = useRef<Map<string, RegistrySkill[]>>(new Map());

  // --- Fetch installed ---
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
    if (pageTab !== 'online') return;
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
      .then((results) => { if (searchIdRef.current === id) setOnlineResults(results); })
      .catch((e) => { if (searchIdRef.current === id) setOnlineError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (searchIdRef.current === id) setOnlineLoading(false); });
  }, [debouncedSearch, pageTab]);

  // --- Registry fetch effect ---
  useEffect(() => {
    if (pageTab !== 'registry') return;
    const query = debouncedSearch.trim() || undefined;
    const cacheKey = `${registrySort}:${query ?? ''}`;

    const cached = registryCacheRef.current.get(cacheKey);
    if (cached) {
      setRegistryResults(cached);
      setRegistryLoading(false);
      setRegistryError(null);
      return;
    }

    const id = ++searchIdRef.current;
    setRegistryLoading(true);
    setRegistryError(null);
    sendRequest<RegistrySkill[]>({ type: 'skill.registry', sort: registrySort, query })
      .then((results) => {
        if (searchIdRef.current === id) {
          setRegistryResults(results);
          registryCacheRef.current.set(cacheKey, results);
        }
      })
      .catch((e) => { if (searchIdRef.current === id) setRegistryError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (searchIdRef.current === id) setRegistryLoading(false); });
  }, [debouncedSearch, registrySort, pageTab]);

  // --- Installed skill names (for "Installed" badge in registry) ---
  const installedSkillNames = useMemo(() => new Set(skills.map((s) => s.name)), [skills]);

  // --- Tab switch ---
  const handleTabChange = (tab: PageTab): void => {
    setPageTab(tab);
    setSearch('');
    flushSearch('');
    setOnlineResults([]);
    setOnlineError(null);
    setOnlineLoading(false);
    setRegistryError(null);
    setRegistryLoading(false);
  };

  // --- Local filter ---
  const filtered = useMemo(() => {
    let result = skills;
    if (scopeFilter) result = result.filter((s) => s.scope === scopeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || (s.description?.toLowerCase().includes(q)));
    }
    return result;
  }, [skills, scopeFilter, search]);

  const globalSkills = useMemo(() => filtered.filter((s) => s.scope === 'global'), [filtered]);
  const projectSkills = useMemo(() => filtered.filter((s) => s.scope === 'project'), [filtered]);

  // --- Handlers ---
  const handleAdd = async (source: string, scope: SkillScope, agents: string[]): Promise<void> => {
    setAddingSkill(true);
    setSelectedAgents(agents);
    setViewState('skill.agents', agents);
    try {
      await sendRequest<void>({ type: 'skill.add', source, scope, agents }, 90_000);
      setShowAddDialog(false);
      registryCacheRef.current.clear();
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
      registryCacheRef.current.clear();
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
      await sendRequest<void>({ type: 'skill.add', source, scope, agents: selectedAgents }, 90_000);
      registryCacheRef.current.clear();
      await fetchList();
      addToast(t('skill.search.installDone').replace('{source}', source), 'success');
    } catch (e) {
      addToast(t('skill.error.add') + ': ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setInstallingSkills((prev) => { const next = new Set(prev); next.delete(source); return next; });
    }
  };

  const handleViewOnline = (url: string): void => {
    sendRequest<void>({ type: 'openExternal', url }).catch(() => {});
  };

  const handleOpenFile = (skillDir: string): void => {
    sendRequest<void>({ type: 'skill.openFile', path: skillDir + '/SKILL.md' }).catch(() => {});
  };

  const handleCheckUpdates = async (): Promise<void> => {
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await sendRequest<string>({ type: 'skill.check' });
      if (result.includes('No skills tracked') || result.includes('up to date') || result.includes('up-to-date')) {
        addToast(t('skill.check.upToDate'), 'success');
        setCheckResult(null);
      } else {
        setCheckResult(result);
      }
    } catch (e) {
      addToast(t('skill.check.error') + ': ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleUpdateAll = async (): Promise<void> => {
    setUpdating(true);
    try {
      await sendRequest<void>({ type: 'skill.update' }, 90_000);
      setCheckResult(null);
      registryCacheRef.current.clear();
      await fetchList();
      addToast(t('skill.update.done'), 'success');
    } catch (e) {
      addToast(t('skill.update.error') + ': ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleViewDetail = async (skill: AgentSkill): Promise<void> => {
    setDetailSkill(skill);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const data = await sendRequest<{ frontmatter: Record<string, string>; body: string }>({ type: 'skill.getDetail', path: skill.path });
      setDetailData(data);
    } catch {
      setDetailData({ frontmatter: {}, body: '' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopyPath = (): void => {
    if (detailSkill) {
      const mdPath = detailSkill.path + '/SKILL.md';
      navigator.clipboard.writeText(mdPath).then(() => {
        addToast(t('skill.detail.copied'), 'success');
      }).catch(() => {});
    }
  };

  // --- Render helpers ---
  const renderOnlineContent = (): React.ReactNode => {
    const query = search.trim();
    if (onlineError) return <ErrorBanner message={onlineError} onDismiss={() => setOnlineError(null)} />;
    if (onlineLoading) return <SkillCardSkeleton />;
    if (query.length < 2) return <div className="skill-search-hint">{t('skill.search.minChars')}</div>;
    if (onlineResults.length === 0) return <EmptyState icon={<NoResultsIcon />} title={t('skill.search.noResults').replace('{query}', query)} />;
    return (
      <div className="card-list">
        {onlineResults.map((r) => (
          <SkillSearchResultCard key={r.fullId} result={r} installing={installingSkills.has(r.fullId)} hasWorkspace={hasWorkspace} onInstall={handleInstallFromSearch} onViewOnline={handleViewOnline} />
        ))}
      </div>
    );
  };

  const renderRegistryContent = (): React.ReactNode => {
    if (registryError) return <ErrorBanner message={registryError} onDismiss={() => setRegistryError(null)} />;
    if (registryLoading) return <SkillCardSkeleton />;
    if (registryResults.length === 0) return <EmptyState icon={<NoResultsIcon />} title={t('skill.registry.noResults')} />;
    return (
      <div className="card-list">
        {registryResults.map((s) => (
          <RegistrySkillCard
            key={`${s.repo}/${s.name}`}
            skill={s}
            isInstalled={installedSkillNames.has(s.name)}
            installing={installingSkills.has(s.repo)}
            hasWorkspace={hasWorkspace}
            onInstall={handleInstallFromSearch}
            onViewOnline={handleViewOnline}
          />
        ))}
      </div>
    );
  };

  const renderInstalledContent = (): React.ReactNode => {
    if (loading) return <SkillCardSkeleton />;
    if (skills.length === 0) return <EmptyState icon={<SkillIcon />} title={t('skill.page.noSkills')} description={t('skill.page.noSkillsDesc')} action={{ label: t('skill.page.add'), onClick: () => setShowAddDialog(true) }} />;
    if (filtered.length === 0) return <EmptyState icon={<NoResultsIcon />} title={t('skill.page.noResults')} action={{ label: t('skill.page.clearFilters'), onClick: () => { setSearch(''); setScopeFilter(null); } }} />;
    return <SkillSections globalSkills={globalSkills} projectSkills={projectSkills} removingSkills={removingSkills} onRemove={(name, scope) => setConfirmRemove({ name, scope })} onOpenFile={handleOpenFile} onViewDetail={handleViewDetail} />;
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
        pageTab={pageTab}
        onPageTabChange={handleTabChange}
        scopeFilter={scopeFilter}
        onScopeFilterChange={setScopeFilter}
        onAddClick={() => setShowAddDialog(true)}
        registrySort={registrySort}
        onRegistrySortChange={setRegistrySort}
        checking={checking}
        onCheckUpdates={handleCheckUpdates}
        updating={updating}
        onUpdateAll={handleUpdateAll}
        checkResult={checkResult}
      />

      {pageTab === 'installed' && renderInstalledContent()}
      {pageTab === 'online' && renderOnlineContent()}
      {pageTab === 'registry' && renderRegistryContent()}

      <AddSkillDialog
        open={showAddDialog}
        adding={addingSkill}
        hasWorkspace={hasWorkspace}
        cachedAgents={selectedAgents}
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

      {detailSkill && (
        <SkillDetailPanel
          skillName={detailSkill.name}
          skillPath={detailSkill.path}
          detail={detailData}
          loading={detailLoading}
          onClose={() => setDetailSkill(null)}
          onOpenInEditor={() => handleOpenFile(detailSkill.path)}
          onCopyPath={handleCopyPath}
        />
      )}
    </div>
  );
}

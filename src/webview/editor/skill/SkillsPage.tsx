import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sendRequest } from '../../vscode';
import { SkillCardSkeleton } from '../../components/Skeleton';
import { EmptyState, SkillIcon, NoResultsIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkillToolbar } from './SkillToolbar';
import type { PageTab } from './SkillToolbar';
import { SkillSections } from './SkillSections';
import { SkillSearchResultCard } from './SkillSearchResultCard';
import { RegistrySkillCard } from './RegistrySkillCard';
import { AddSkillDialog, RemoveConfirmDialog } from './SkillDialogs';
import { ContentDetailPanel } from '../../components/ContentDetailPanel';
import { PageHeader } from '../../components/PageHeader';
import type { AgentSkill, RegistrySkill, RegistrySort, SkillScope, SkillSearchResult } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';
import { usePushSyncedResource } from '../../hooks/usePushSyncedResource';
import { useRemoteListQuery } from '../../hooks/useRemoteListQuery';
import { usePersistedSkillAgents } from './hooks/usePersistedSkillAgents';
import { useSkillDetailState } from './hooks/useSkillDetailState';
import { useSkillMutations } from './hooks/useSkillMutations';

/**
 * Skills 管理頁面。
 * Installed：已安裝 skills 列表 + add/remove。
 * Online：npx skills find 線上搜尋 + install。
 * Registry：skills.sh 排行榜 + install。
 */
export function SkillsPage(): React.ReactElement {
  const { t } = useI18n();

  // --- Installed state ---
  const [scopeFilter, setScopeFilter] = useState<SkillScope | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ name: string; scope: SkillScope } | null>(null);
  const [hasWorkspace, setHasWorkspace] = useState(false);

  // --- Pending install from search/registry (Install 按鈕直接開 dialog) ---
  const [pendingInstall, setPendingInstall] = useState<string | null>(null);
  const [pendingInstallScope, setPendingInstallScope] = useState<SkillScope>('global');
  const [pendingInstallSkillName, setPendingInstallSkillName] = useState<string | null>(null);

  // --- Agent selection (persisted in viewState + globalState) ---
  const { selectedAgents, persistSelectedAgents } = usePersistedSkillAgents();

  // --- Shared ---
  const [search, setSearch] = useState('');
  const [pageTab, setPageTab] = useState<PageTab>('installed');

  // --- Check/Update state ---
  // --- Registry state ---
  const [registrySort, setRegistrySort] = useState<RegistrySort>('all-time');
  const loadInstalledSkills = useCallback(
    () => sendRequest<AgentSkill[]>({ type: 'skill.list' }),
    [],
  );
  const shouldRefreshSkills = useCallback(
    (msg: { type?: string }) => msg.type === 'skill.refresh',
    [],
  );

  const {
    data: skills,
    loading,
    error,
    setError,
    refresh: fetchList,
  } = usePushSyncedResource<AgentSkill[]>({
    initialData: [],
    load: loadInstalledSkills,
    pushFilter: shouldRefreshSkills,
  });

  useEffect(() => {
    sendRequest<Array<{ name: string }>>({ type: 'workspace.getFolders' })
      .then((folders) => setHasWorkspace(folders.length > 0))
      .catch(() => {});
  }, []);

  const loadOnlineSkills = useCallback(
    (query: string) => sendRequest<SkillSearchResult[]>({ type: 'skill.find', query }),
    [],
  );
  const loadRegistrySkills = useCallback(
    (query: string) => sendRequest<RegistrySkill[]>({ type: 'skill.registry', sort: registrySort, query: query || undefined }),
    [registrySort],
  );

  const onlineQuery = useRemoteListQuery<SkillSearchResult>({
    enabled: pageTab === 'online',
    query: search,
    debounceMs: 500,
    minQueryLength: 2,
    load: loadOnlineSkills,
  });
  const registryQuery = useRemoteListQuery<RegistrySkill>({
    enabled: pageTab === 'registry',
    query: search,
    debounceMs: 500,
    load: loadRegistrySkills,
    getCacheKey: useCallback((query: string) => `${registrySort}:${query}`, [registrySort]),
  });
  const clearRegistryCache = useCallback(() => {
    registryQuery.clearCache();
  }, [registryQuery]);
  const closeAddDialog = useCallback(() => {
    setShowAddDialog(false);
    setPendingInstall(null);
    setPendingInstallSkillName(null);
  }, []);
  const {
    addingSkill,
    checking,
    updating,
    checkResult,
    removingSkills,
    handleAdd,
    handleRemove,
    handleCheckUpdates,
    handleUpdateAll,
  } = useSkillMutations({
    fetchList,
    clearRegistryCache,
    persistSelectedAgents,
    hasPendingInstall: () => pendingInstall !== null,
    closeAddDialog,
    getPendingSkillName: () => pendingInstallSkillName,
  });
  const {
    detailSkill,
    detailData,
    detailLoading,
    handleViewDetail,
    handleCopyPath,
    closeDetail,
  } = useSkillDetailState();

  // --- 依 scope 追蹤已安裝的 skill names（Claude Code agent only） ---
  const installedSkillsByScope = useMemo(() => {
    const global = new Set<string>();
    const project = new Set<string>();
    for (const s of skills) {
      if (!s.agents.includes('Claude Code')) continue;
      if (s.scope === 'global') global.add(s.name);
      else if (s.scope === 'project') project.add(s.name);
    }
    return { global, project };
  }, [skills]);

  // --- Tab switch ---
  const handleTabChange = (tab: PageTab): void => {
    setPageTab(tab);
    setSearch('');
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

  // --- Registry client-side filter（skills.sh 不一定支援 ?q= server-side 過濾） ---
  const filteredRegistry = useMemo(() => {
    if (!search.trim()) return registryQuery.items;
    const q = search.trim().toLowerCase();
    return registryQuery.items.filter((s) =>
      s.name.toLowerCase().includes(q) || s.repo.toLowerCase().includes(q),
    );
  }, [registryQuery.items, search]);

  const globalSkills = useMemo(() => filtered.filter((s) => s.scope === 'global'), [filtered]);
  const projectSkills = useMemo(() => filtered.filter((s) => s.scope === 'project'), [filtered]);

  // --- Handlers ---
  /** Online/Search Install 按鈕 → 直接開 AddSkillDialog（source 預填） */
  const handlePendingInstall = (source: string): void => {
    setPendingInstall(source);
  };

  /** Registry scope checkbox → 勾選開 dialog 安裝；取消勾選開確認 dialog 移除 */
  const handleRegistryScopeToggle = (
    repo: string,
    skillName: string,
    scope: SkillScope,
    enable: boolean,
  ): void => {
    if (enable) {
      setPendingInstallScope(scope);
      setPendingInstall(repo);
      setPendingInstallSkillName(skillName);
    } else {
      setConfirmRemove({ name: skillName, scope });
    }
  };

  const handleViewOnline = (url: string): void => {
    sendRequest<void>({ type: 'openExternal', url }).catch(() => {});
  };

  const handleOpenFile = (skillDir: string): void => {
    sendRequest<void>({ type: 'skill.openFile', path: skillDir + '/SKILL.md' }).catch(() => {});
  };

  // --- Render helpers ---
  const renderOnlineContent = (): React.ReactNode => {
    const query = search.trim();
    if (onlineQuery.error) return <ErrorBanner message={onlineQuery.error} onDismiss={() => onlineQuery.setError(null)} />;
    if (onlineQuery.loading) return <SkillCardSkeleton />;
    if (query.length < 2) return <div className="skill-search-hint">{t('skill.search.minChars')}</div>;
    if (onlineQuery.items.length === 0) return <EmptyState icon={<NoResultsIcon />} title={t('skill.search.noResults').replace('{query}', query)} />;
    return (
      <div className="card-list">
        {onlineQuery.items.map((r) => (
          <SkillSearchResultCard key={r.fullId} result={r} installing={false} hasWorkspace={hasWorkspace} onInstall={handlePendingInstall} onViewOnline={handleViewOnline} />
        ))}
      </div>
    );
  };

  const renderRegistryContent = (): React.ReactNode => {
    if (registryQuery.error) return <ErrorBanner message={registryQuery.error} onDismiss={() => registryQuery.setError(null)} />;
    if (registryQuery.loading) return <SkillCardSkeleton />;
    if (registryQuery.items.length === 0) return <EmptyState icon={<NoResultsIcon />} title={t('skill.registry.noResults')} />;
    if (filteredRegistry.length === 0) return <EmptyState icon={<NoResultsIcon />} title={t('skill.search.noResults').replace('{query}', search.trim())} />;
    return (
      <div className="card-list">
        {filteredRegistry.map((s) => {
          const loadingScopes = new Set<SkillScope>();
          if (removingSkills.has(`global:${s.name}`)) loadingScopes.add('global');
          if (removingSkills.has(`project:${s.name}`)) loadingScopes.add('project');
          const installedScopes = new Set<SkillScope>();
          if (installedSkillsByScope.global.has(s.name)) installedScopes.add('global');
          if (installedSkillsByScope.project.has(s.name)) installedScopes.add('project');
          return (
            <RegistrySkillCard
              key={`${s.repo}/${s.name}`}
              skill={s}
              installedScopes={installedScopes}
              loadingScopes={loadingScopes}
              installing={addingSkill && pendingInstall === s.repo}
              hasWorkspace={hasWorkspace}
              onScopeToggle={handleRegistryScopeToggle}
              onViewOnline={handleViewOnline}
            />
          );
        })}
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
      <PageHeader
        title={t('skill.page.title')}
        subtitle={t('skill.page.subtitle')}
        actions={<>
          <button className="btn btn-primary" onClick={() => setShowAddDialog(true)}>
            {t('skill.page.add')}
          </button>
          <button className="btn btn-secondary" onClick={handleCheckUpdates} disabled={checking || updating}>
            {checking ? t('skill.check.checking') : t('skill.check.button')}
          </button>
          {checkResult && (
            <button className="btn btn-secondary" onClick={handleUpdateAll} disabled={updating}>
              {updating ? t('skill.update.updating') : t('skill.update.button')}
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => void fetchList()} disabled={loading}>
            {t('skill.page.refresh')}
          </button>
        </>}
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <SkillToolbar
        search={search}
        onSearchChange={setSearch}
        pageTab={pageTab}
        onPageTabChange={handleTabChange}
        scopeFilter={scopeFilter}
        onScopeFilterChange={setScopeFilter}
        registrySort={registrySort}
        onRegistrySortChange={setRegistrySort}
      />

      {pageTab === 'installed' && renderInstalledContent()}
      {pageTab === 'online' && renderOnlineContent()}
      {pageTab === 'registry' && renderRegistryContent()}

      <AddSkillDialog
        open={showAddDialog || pendingInstall !== null}
        adding={addingSkill}
        hasWorkspace={hasWorkspace}
        cachedAgents={selectedAgents}
        initialSource={pendingInstall ?? undefined}
        initialScope={pendingInstall !== null ? pendingInstallScope : undefined}
        onSubmit={handleAdd}
        onClose={closeAddDialog}
      />

      {confirmRemove && (
        <RemoveConfirmDialog
          skillName={confirmRemove.name}
          skillScope={confirmRemove.scope}
          onConfirm={() => {
            setConfirmRemove(null);
            return handleRemove(confirmRemove.name, confirmRemove.scope);
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {detailSkill && (
        <ContentDetailPanel
          name={detailSkill.name}
          detail={detailData}
          loading={detailLoading}
          onClose={closeDetail}
          onOpenInEditor={() => handleOpenFile(detailSkill.path)}
          onCopyPath={handleCopyPath}
        />
      )}
    </div>
  );
}

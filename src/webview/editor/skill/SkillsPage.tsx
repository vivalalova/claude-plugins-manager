import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sendRequest, onPushMessage } from '../../vscode';
import { SkillCardSkeleton } from '../../components/Skeleton';
import { EmptyState, SkillIcon, NoResultsIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkillToolbar } from './SkillToolbar';
import { SkillSections } from './SkillSections';
import { AddSkillDialog, RemoveConfirmDialog } from './SkillDialogs';
import { useToast } from '../../components/Toast';
import type { AgentSkill, SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

/**
 * Skills 管理頁面。
 * 顯示已安裝 skills 列表，支援 add/remove，按 scope 分組。
 */
export function SkillsPage(): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<SkillScope | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingSkill, setAddingSkill] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ name: string; scope: SkillScope } | null>(null);
  const [removingSkills, setRemovingSkills] = useState<Set<string>>(new Set());
  const [hasWorkspace, setHasWorkspace] = useState(false);

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

  // 訂閱 skill.refresh push
  useEffect(() => {
    return onPushMessage((msg) => {
      if (msg.type === 'skill.refresh') {
        fetchList();
      }
    });
  }, [fetchList]);

  // 過濾 + 分組
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
      setRemovingSkills((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleOpenFile = (path: string): void => {
    sendRequest<void>({ type: 'skill.openFile', path }).catch(() => {});
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
        scopeFilter={scopeFilter}
        onScopeFilterChange={setScopeFilter}
        onAddClick={() => setShowAddDialog(true)}
      />

      {loading ? (
        <SkillCardSkeleton />
      ) : skills.length === 0 ? (
        <EmptyState
          icon={<SkillIcon />}
          title={t('skill.page.noSkills')}
          description={t('skill.page.noSkillsDesc')}
          action={{ label: t('skill.page.add'), onClick: () => setShowAddDialog(true) }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<NoResultsIcon />}
          title={t('skill.page.noResults')}
          action={{ label: t('skill.page.clearFilters'), onClick: () => { setSearch(''); setScopeFilter(null); } }}
        />
      ) : (
        <SkillSections
          globalSkills={globalSkills}
          projectSkills={projectSkills}
          removingSkills={removingSkills}
          onRemove={(name, scope) => setConfirmRemove({ name, scope })}
          onOpenFile={handleOpenFile}
        />
      )}

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

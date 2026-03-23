import { useState } from 'react';
import { sendRequest } from '../../../vscode';
import { useToast } from '../../../components/Toast';
import { useI18n } from '../../../i18n/I18nContext';
import { usePageAction } from '../../../hooks/usePageAction';
import type { SkillScope } from '../../../../shared/types';

interface UseSkillMutationsOptions {
  fetchList: () => Promise<unknown>;
  clearRegistryCache: () => void;
  persistSelectedAgents: (agents: string[]) => void;
  hasPendingInstall: () => boolean;
  closeAddDialog: () => void;
}

export function useSkillMutations({
  fetchList,
  clearRegistryCache,
  persistSelectedAgents,
  hasPendingInstall,
  closeAddDialog,
}: UseSkillMutationsOptions): {
  addingSkill: boolean;
  checking: boolean;
  updating: boolean;
  checkResult: string | null;
  removingSkills: Set<string>;
  handleAdd: (source: string, scope: SkillScope, agents: string[]) => Promise<void>;
  handleRemove: (name: string, scope: SkillScope) => Promise<void>;
  handleCheckUpdates: () => Promise<void>;
  handleUpdateAll: () => Promise<void>;
} {
  const { t } = useI18n();
  const { addToast } = useToast();
  const runPageAction = usePageAction();
  const [addingSkill, setAddingSkill] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [removingSkills, setRemovingSkills] = useState<Set<string>>(new Set());

  const handleAdd = async (source: string, scope: SkillScope, agents: string[]): Promise<void> => {
    setAddingSkill(true);
    persistSelectedAgents(agents);
    const isPending = hasPendingInstall();
    await runPageAction({
      action: () => sendRequest<void>({ type: 'skill.add', source, scope, agents }, 90_000),
      onSuccess: async () => {
        closeAddDialog();
        clearRegistryCache();
        await fetchList();
      },
      onError: (message) => {
        addToast(t('skill.error.add') + ': ' + message, 'error');
      },
      onFinally: () => {
        setAddingSkill(false);
      },
      successToast: isPending ? t('skill.search.installDone').replace('{source}', source) : undefined,
    });
  };

  const handleRemove = async (name: string, scope: SkillScope): Promise<void> => {
    const key = `${scope}:${name}`;
    setRemovingSkills((prev) => new Set(prev).add(key));
    await runPageAction({
      action: () => sendRequest<void>({ type: 'skill.remove', name, scope }),
      onSuccess: async () => {
        clearRegistryCache();
        await fetchList();
      },
      onError: (message) => {
        addToast(t('skill.error.remove') + ': ' + message, 'error');
      },
      onFinally: () => {
        setRemovingSkills((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      },
    });
  };

  const handleCheckUpdates = async (): Promise<void> => {
    setChecking(true);
    setCheckResult(null);
    await runPageAction({
      action: () => sendRequest<string>({ type: 'skill.check' }),
      onSuccess: (result) => {
        if (
          result.includes('No skills tracked')
          || result.includes('up to date')
          || result.includes('up-to-date')
        ) {
          addToast(t('skill.check.upToDate'), 'success');
          setCheckResult(null);
          return;
        }
        setCheckResult(result);
      },
      onError: (message) => {
        addToast(t('skill.check.error') + ': ' + message, 'error');
      },
      onFinally: () => {
        setChecking(false);
      },
    });
  };

  const handleUpdateAll = async (): Promise<void> => {
    setUpdating(true);
    await runPageAction({
      action: () => sendRequest<void>({ type: 'skill.update' }, 90_000),
      onSuccess: async () => {
        setCheckResult(null);
        clearRegistryCache();
        await fetchList();
      },
      onError: (message) => {
        addToast(t('skill.update.error') + ': ' + message, 'error');
      },
      onFinally: () => {
        setUpdating(false);
      },
      successToast: t('skill.update.done'),
    });
  };

  return {
    addingSkill,
    checking,
    updating,
    checkResult,
    removingSkills,
    handleAdd,
    handleRemove,
    handleCheckUpdates,
    handleUpdateAll,
  };
}

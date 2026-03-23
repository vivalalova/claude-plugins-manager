import { useState } from 'react';
import { sendRequest } from '../../../vscode';
import { useToast } from '../../../components/Toast';
import { useI18n } from '../../../i18n/I18nContext';
import { usePageAction } from '../../../hooks/usePageAction';
import type { AgentSkill } from '../../../../shared/types';

interface SkillDetailData {
  frontmatter: Record<string, string>;
  body: string;
}

export function useSkillDetailState(): {
  detailSkill: AgentSkill | null;
  detailData: SkillDetailData | null;
  detailLoading: boolean;
  handleViewDetail: (skill: AgentSkill) => Promise<void>;
  handleCopyPath: () => void;
  closeDetail: () => void;
} {
  const { t } = useI18n();
  const { addToast } = useToast();
  const runPageAction = usePageAction();
  const [detailSkill, setDetailSkill] = useState<AgentSkill | null>(null);
  const [detailData, setDetailData] = useState<SkillDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleViewDetail = async (skill: AgentSkill): Promise<void> => {
    setDetailSkill(skill);
    setDetailData(null);
    setDetailLoading(true);
    await runPageAction({
      clearError: false,
      action: () => sendRequest<SkillDetailData>({ type: 'skill.getDetail', path: skill.path }),
      onSuccess: (data) => {
        setDetailData(data);
      },
      onError: () => {
        setDetailData({ frontmatter: {}, body: '' });
      },
      onFinally: () => {
        setDetailLoading(false);
      },
    });
  };

  const handleCopyPath = (): void => {
    if (!detailSkill) {
      return;
    }

    const mdPath = detailSkill.path + '/SKILL.md';
    navigator.clipboard.writeText(mdPath).then(() => {
      addToast(t('skill.detail.copied'), 'success');
    }).catch(() => {});
  };

  return {
    detailSkill,
    detailData,
    detailLoading,
    handleViewDetail,
    handleCopyPath,
    closeDetail: () => setDetailSkill(null),
  };
}

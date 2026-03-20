import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

interface ScopePickerProps {
  installing: boolean;
  hasWorkspace: boolean;
  onInstall: (scope: SkillScope) => void;
}

/** Install 按鈕 + scope dropdown（position: fixed 避免被 overflow:hidden 裁切） */
export function ScopePicker({ installing, hasWorkspace, onInstall }: ScopePickerProps): React.ReactElement {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleSelect = (scope: SkillScope): void => {
    setOpen(false);
    onInstall(scope);
  };

  // click-outside dismiss
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        pickerRef.current && !pickerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 計算 fixed position
  const getPickerStyle = useCallback((): React.CSSProperties => {
    if (!btnRef.current) return {};
    const rect = btnRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    };
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        className="btn btn-sm btn-primary"
        onClick={() => setOpen((p) => !p)}
        disabled={installing}
      >
        {installing ? t('skill.search.installing') : t('skill.search.install')}
      </button>
      {open && !installing && (
        <div ref={pickerRef} className="skill-scope-picker" style={getPickerStyle()}>
          <button className="skill-scope-picker-item" onClick={() => handleSelect('global')}>
            {t('skill.add.scopeGlobal')}
          </button>
          <button
            className="skill-scope-picker-item"
            onClick={() => handleSelect('project')}
            disabled={!hasWorkspace}
          >
            {t('skill.add.scopeProject')}
          </button>
        </div>
      )}
    </>
  );
}

import React from 'react';
import { KeyboardHelpOverlay } from '../../components/KeyboardHelpOverlay';
import { BulkEnableScopeDialog } from './BulkEnableScopeDialog';
import { TranslateDialog } from './TranslateDialog';
import type { MergedPlugin, PluginScope } from '../../../shared/types';
import type { WorkspaceFolder } from './hooks/usePluginData';

export interface PluginDialogsProps {
  // BulkEnableScopeDialog
  pendingBulkEnable: { marketplace: string; items: MergedPlugin[] } | null;
  bulkDialogScope: PluginScope;
  workspaceFolders: WorkspaceFolder[];
  onBulkDialogScopeChange: (scope: PluginScope) => void;
  onBulkDialogCancel: () => void;
  onBulkDialogConfirm: () => void;

  // KeyboardHelpOverlay
  showHelp: boolean;
  onHelpClose: () => void;

  // TranslateDialog
  dialogOpen: boolean;
  trapRef: React.RefObject<HTMLDivElement | null>;
  titleId: string;
  emailId: string;
  langId: string;
  draftEmail: string;
  draftLang: string;
  onEmailChange: (v: string) => void;
  onLangChange: (v: string) => void;
  onTranslateCancel: () => void;
  onTranslateConfirm: () => void;
}

export function PluginDialogs({
  pendingBulkEnable,
  bulkDialogScope,
  workspaceFolders,
  onBulkDialogScopeChange,
  onBulkDialogCancel,
  onBulkDialogConfirm,
  showHelp,
  onHelpClose,
  dialogOpen,
  trapRef,
  titleId,
  emailId,
  langId,
  draftEmail,
  draftLang,
  onEmailChange,
  onLangChange,
  onTranslateCancel,
  onTranslateConfirm,
}: PluginDialogsProps): React.ReactElement {
  return (
    <>
      {pendingBulkEnable && (
        <BulkEnableScopeDialog
          marketplace={pendingBulkEnable.marketplace}
          itemCount={pendingBulkEnable.items.length}
          scope={bulkDialogScope}
          workspaceFolders={workspaceFolders}
          onScopeChange={onBulkDialogScopeChange}
          onCancel={onBulkDialogCancel}
          onConfirm={onBulkDialogConfirm}
        />
      )}

      {showHelp && <KeyboardHelpOverlay onClose={onHelpClose} />}

      {dialogOpen && (
        <TranslateDialog
          trapRef={trapRef}
          titleId={titleId}
          emailId={emailId}
          langId={langId}
          draftEmail={draftEmail}
          draftLang={draftLang}
          onEmailChange={onEmailChange}
          onLangChange={onLangChange}
          onCancel={onTranslateCancel}
          onConfirm={onTranslateConfirm}
        />
      )}
    </>
  );
}

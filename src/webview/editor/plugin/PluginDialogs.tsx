import React from 'react';
import { KeyboardHelpOverlay } from '../../components/KeyboardHelpOverlay';
import { TranslateDialog } from './TranslateDialog';

export interface PluginDialogsProps {
  // KeyboardHelpOverlay
  showHelp: boolean;
  onHelpClose: () => void;

  // TranslateDialog
  dialogOpen: boolean;
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
  showHelp,
  onHelpClose,
  dialogOpen,
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
      {showHelp && <KeyboardHelpOverlay onClose={onHelpClose} />}

      {dialogOpen && (
        <TranslateDialog
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

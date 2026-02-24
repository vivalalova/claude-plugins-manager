import React from 'react';
import { SidebarApp } from './sidebar/SidebarApp';
import { EditorApp } from './editor/EditorApp';
import { ToastProvider } from './components/Toast';
import { I18nProvider } from './i18n/I18nContext';

interface AppProps {
  mode: string;
  locale: string;
}

/** 根元件：依 data-mode 屬性切換 sidebar 或 editor 模式 */
export function App({ mode, locale }: AppProps): React.ReactElement {
  return (
    <I18nProvider locale={locale}>
      <ToastProvider>
        {mode === 'sidebar' ? <SidebarApp /> : <EditorApp mode={mode} />}
      </ToastProvider>
    </I18nProvider>
  );
}

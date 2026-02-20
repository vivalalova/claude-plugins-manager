import React from 'react';
import { SidebarApp } from './sidebar/SidebarApp';
import { EditorApp } from './editor/EditorApp';
import { ToastProvider } from './components/Toast';

interface AppProps {
  mode: string;
}

/** 根元件：依 data-mode 屬性切換 sidebar 或 editor 模式 */
export function App({ mode }: AppProps): React.ReactElement {
  return (
    <ToastProvider>
      {mode === 'sidebar' ? <SidebarApp /> : <EditorApp mode={mode} />}
    </ToastProvider>
  );
}

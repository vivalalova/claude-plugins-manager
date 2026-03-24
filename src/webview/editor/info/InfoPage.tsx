import React, { useEffect, useState } from 'react';
import { sendRequest } from '../../vscode';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ExtensionInfo } from '../../../shared/types';
import { toErrorMessage } from '../../../shared/errorUtils';
import './InfoPage.css';
import { PageHeader } from '../../components/PageHeader';

export function InfoPage(): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [info, setInfo] = useState<ExtensionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    sendRequest<ExtensionInfo>({ type: 'extension.getInfo' })
      .then(setInfo)
      .catch((e: unknown) => setError(toErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleOpen = (path: string): void => {
    sendRequest<void>({ type: 'extension.revealPath', path }).catch(() => {
      addToast(t('info.action.openFailed'), 'error');
    });
  };

  const handleOpenRepo = (): void => {
    if (!info?.repoUrl) return;
    sendRequest<void>({ type: 'openExternal', url: info.repoUrl }).catch(() => {
      addToast(t('info.action.openFailed'), 'error');
    });
  };

  const handleClearCache = async (): Promise<void> => {
    setShowClearConfirm(false);
    setClearing(true);
    try {
      await sendRequest<{ cleared: boolean }>({ type: 'extension.clearCache' });
      addToast(t('info.clearCache.success'), 'success');
    } catch {
      addToast(t('info.clearCache.failed'), 'error');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="info-status">{t('info.loading')}</div>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="page-container">
        <div className="info-status info-status--error">
          {t('info.error.load')}{error ? `: ${error}` : ''}
        </div>
      </div>
    );
  }

  /** 將 home dir 絕對路徑替換為 ~/ 以精簡顯示 */
  const shortenHome = (p: string): string => {
    const home = info.homeDirPrefix;
    if (!home) {
      return p;
    }
    if (p === home) {
      return '~';
    }
    return p.startsWith(home + '/') ? '~' + p.slice(home.length) : p;
  };

  const paths: Array<{ key: string; label: string; display: string; fullPath: string; exists: boolean; action?: 'clearCache' }> = [
    { key: 'cacheDir', label: t('info.path.cacheDir'), display: shortenHome(info.cacheDirPath.path), fullPath: info.cacheDirPath.path, exists: info.cacheDirPath.exists, action: 'clearCache' },
    { key: 'pluginsDir', label: t('info.path.pluginsDir'), display: shortenHome(info.pluginsDirPath.path), fullPath: info.pluginsDirPath.path, exists: info.pluginsDirPath.exists },
    { key: 'dataDir', label: t('info.path.dataDir'), display: shortenHome(info.dataDirPath.path), fullPath: info.dataDirPath.path, exists: info.dataDirPath.exists },
    { key: 'installedPlugins', label: t('info.path.installedPlugins'), display: shortenHome(info.installedPluginsPath.path), fullPath: info.installedPluginsPath.path, exists: info.installedPluginsPath.exists },
    { key: 'knownMarketplaces', label: t('info.path.knownMarketplaces'), display: shortenHome(info.knownMarketplacesPath.path), fullPath: info.knownMarketplacesPath.path, exists: info.knownMarketplacesPath.exists },
    { key: 'extensionPath', label: t('info.path.extension'), display: shortenHome(info.extensionPath.path), fullPath: info.extensionPath.path, exists: info.extensionPath.exists },
  ];

  return (
    <div className="page-container">
      <PageHeader title={t('info.title')} subtitle={t('info.subtitle')} titleAs="h2" />

      <div className="info-sections">
        {/* Extension section */}
        <div className="settings-section info-section">
          <h3 className="settings-section-title">{t('info.section.extension')}</h3>
          <div className="info-fields">
            <InfoField label={t('info.extension.name')} value={info.extensionName} />
            <InfoField label={t('info.extension.version')} value={info.extensionVersion} />
            <InfoField label={t('info.extension.publisher')} value={info.publisher} />
            {info.repoUrl && (
              <div className="info-field">
                <span className="info-field-label">{t('info.extension.repo')}</span>
                <button
                  className="info-link"
                  onClick={handleOpenRepo}
                >
                  {info.repoUrl}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CLI section */}
        <div className="settings-section info-section">
          <h3 className="settings-section-title">{t('info.section.cli')}</h3>
          <div className="info-fields">
            <InfoField
              label={t('info.cli.path')}
              value={info.cliPath ?? t('info.cli.notFound')}
              muted={!info.cliPath}
            />
            <InfoField
              label={t('info.cli.version')}
              value={info.cliVersion ?? t('info.cli.notFound')}
              muted={!info.cliVersion}
            />
          </div>
        </div>

        {/* Paths section */}
        <div className="settings-section info-section">
          <h3 className="settings-section-title">{t('info.section.paths')}</h3>
          <div className="info-path-list">
            {paths.map(({ key, label, display, fullPath, exists, action }) => (
              <div key={key} className={`info-path-row${exists ? '' : ' info-path-row--missing'}`}>
                <div className="info-path-meta">
                  <span className="info-path-label">
                    {label}
                    {!exists && <span className="info-path-badge-missing">{t('info.path.notExists')}</span>}
                  </span>
                  <span className="info-path-value">{display}</span>
                </div>
                <div className="info-path-actions">
                  <button
                    className="btn btn-secondary info-path-btn"
                    onClick={() => handleOpen(fullPath)}
                  >
                    {t('info.action.open')}
                  </button>
                  {action === 'clearCache' && (
                    <button
                      className="btn btn-danger info-path-btn"
                      onClick={() => setShowClearConfirm(true)}
                      disabled={clearing}
                    >
                      {clearing ? '…' : t('info.action.clearCache')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showClearConfirm && (
        <ConfirmDialog
          title={t('info.clearCache.title')}
          message={t('info.clearCache.message')}
          confirmLabel={t('info.clearCache.confirm')}
          danger
          onConfirm={() => void handleClearCache()}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}

interface InfoFieldProps {
  label: string;
  value: string;
  muted?: boolean;
}

function InfoField({ label, value, muted = false }: InfoFieldProps): React.ReactElement {
  return (
    <div className="info-field">
      <span className="info-field-label">{label}</span>
      <span className={`info-field-value${muted ? ' info-field-value--muted' : ''}`}>{value}</span>
    </div>
  );
}

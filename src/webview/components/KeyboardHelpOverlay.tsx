import React from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface KeyboardHelpOverlayProps {
  /** 關閉 overlay 的 callback */
  onClose: () => void;
}

const SHORTCUTS = [
  { key: '/', description: 'Focus search' },
  { key: 'Escape', description: 'Clear search / Close overlay' },
  { key: 'j', description: 'Next card' },
  { key: 'k', description: 'Previous card' },
  { key: 'Enter', description: 'Expand / Collapse card' },
  { key: '?', description: 'Toggle this help' },
];

/**
 * 鍵盤快捷鍵說明 overlay。
 * 顯示所有支援的快捷鍵列表，Escape 或 Close 按鈕關閉。
 */
export function KeyboardHelpOverlay({ onClose }: KeyboardHelpOverlayProps): React.ReactElement {
  const trapRef = useFocusTrap(onClose);

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div
        ref={trapRef}
        className="confirm-dialog keyboard-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-title" id="keyboard-help-title">Keyboard Shortcuts</div>
        <dl className="keyboard-help-list">
          {SHORTCUTS.map(({ key, description }) => (
            <React.Fragment key={key}>
              <dt><kbd className="keyboard-help-key">{key}</kbd></dt>
              <dd className="keyboard-help-desc">{description}</dd>
            </React.Fragment>
          ))}
        </dl>
        <div className="confirm-dialog-actions">
          <button className="btn btn-primary" onClick={onClose} type="button">Close</button>
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ActionMenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}

interface ActionMenuProps {
  label: string;
  menuLabel?: string;
  items: ReadonlyArray<ActionMenuItem>;
  disabled?: boolean;
  align?: 'left' | 'right';
  triggerClassName?: string;
}

export function ActionMenu({
  label,
  menuLabel,
  items,
  disabled = false,
  align = 'right',
  triggerClassName = 'btn btn-secondary',
}: ActionMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent): void => {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
        panelRef.current && !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const getPanelStyle = useCallback((): React.CSSProperties => {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    const style: React.CSSProperties = {
      top: rect.bottom + 4,
      minWidth: Math.max(rect.width, 160),
    };
    if (align === 'left') {
      style.left = rect.left;
    } else {
      style.right = window.innerWidth - rect.right;
    }
    return style;
  }, [align]);

  const handleSelect = (item: ActionMenuItem): void => {
    setOpen(false);
    item.onSelect();
  };

  return (
    <div className="action-menu">
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        {label}
        <span className="action-menu-trigger-chevron" aria-hidden="true">▾</span>
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          aria-label={menuLabel ?? label}
          className="action-menu-panel"
          style={getPanelStyle()}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`action-menu-item${item.tone === 'danger' ? ' action-menu-item--danger' : ''}`}
              onClick={() => handleSelect(item)}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

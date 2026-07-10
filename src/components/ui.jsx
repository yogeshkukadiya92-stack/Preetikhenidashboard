import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle || action) && (
        <div className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="subtle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusPill({ tone, children }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

export function Tag({ tone, children }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function ActionMenu({ label = 'Actions', items = [], align = 'right', compact = false }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const menuId = useId();
  const visibleItems = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) return undefined;
    const closeMenu = (event) => {
      if (!triggerRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const rect = trigger.getBoundingClientRect();
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;
      const preferredLeft = align === 'left' ? rect.left : rect.right - panelWidth;
      const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - panelWidth - 8));
      const below = rect.bottom + 8;
      const top = below + panelHeight <= window.innerHeight - 8
        ? below
        : Math.max(8, rect.top - panelHeight - 8);
      setPosition({ top, left });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      panelRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
    });
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, open, visibleItems.length]);

  const handleMenuKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const menuItems = Array.from(panelRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') ?? []);
    if (!menuItems.length) return;
    event.preventDefault();
    const currentIndex = menuItems.indexOf(document.activeElement);
    if (event.key === 'Home') menuItems[0].focus();
    else if (event.key === 'End') menuItems[menuItems.length - 1].focus();
    else if (event.key === 'ArrowDown') menuItems[(currentIndex + 1 + menuItems.length) % menuItems.length].focus();
    else menuItems[(currentIndex - 1 + menuItems.length) % menuItems.length].focus();
  };

  return (
    <div className={`action-menu action-menu-${align}`}>
      <button
        className={`pill action-menu-trigger ${compact ? 'action-menu-trigger-compact' : ''}`}
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          setOpen(true);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
      >
        {compact ? (
          <span className="action-menu-ellipsis" aria-hidden="true"><span /><span /><span /></span>
        ) : (
          <>
            {label}
            <span aria-hidden="true">▾</span>
          </>
        )}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="action-menu-panel"
          id={menuId}
          role="menu"
          ref={panelRef}
          style={{ top: position.top, left: position.left }}
          onKeyDown={handleMenuKeyDown}
        >
          {visibleItems.map((item) => (
            <button
              className={`action-menu-item ${item.danger ? 'danger' : ''}`}
              type="button"
              role="menuitem"
              key={item.label}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
            >
              <span>{item.label}</span>
              {item.description && <small>{item.description}</small>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

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

export function ActionMenu({ label = 'Actions', items = [], align = 'right' }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`action-menu action-menu-${align}`} ref={menuRef}>
      <button className="pill action-menu-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="menu" aria-expanded={open}>
        {label}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="action-menu-panel" role="menu">
          {items.map((item) => (
            <button
              className="action-menu-item"
              type="button"
              role="menuitem"
              key={item.label}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
            >
              <span>{item.label}</span>
              {item.description && <small>{item.description}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

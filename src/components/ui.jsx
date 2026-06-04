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

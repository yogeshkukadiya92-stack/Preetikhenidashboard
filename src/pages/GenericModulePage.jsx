import { Card } from '../components/ui.jsx';

export function GenericModulePage({ title, description, stats, columns, rows }) {
  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="module-stats">
          {stats.map((stat) => (
            <div className="mini-stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <Card title={`${title} List`}>
        <div className="data-table">
          <div className="table-head">
            {columns.map((column) => <div key={column}>{column}</div>)}
            <div />
          </div>
          {rows.map((row, index) => (
            <div className="data-row" key={index}>
              {row.map((cell) => <div key={cell}>{cell}</div>)}
              <div>⋯</div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

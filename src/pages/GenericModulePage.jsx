import { Card } from '../components/ui.jsx';
import { useState } from 'react';

export function GenericModulePage({ title, description, stats, columns, rows }) {
  const [selectedRow, setSelectedRow] = useState(null);
  const [actionMessage, setActionMessage] = useState('Ready.');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const filteredRows = rows.filter((row) => row.join(' ').toLowerCase().includes(filterText.toLowerCase()));

  const runAction = (action) => {
    if (action === 'Filter') {
      setFilterOpen((current) => !current);
      setActionMessage('Filter toggled.');
      return;
    }
    setActionMessage(`${action} action ready for ${title}.`);
  };

  return (
    <section className="module-page compact-page">
      <div className="module-hero compact-hero">
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
        <div className="module-toolbar">
          <div className="sheet-actions toolbar-actions">
            {['Add', 'Import', 'Export', 'Filter', 'Share'].map((action) => (
              <button className="pill" type="button" key={action} onClick={() => runAction(action)}>{action}</button>
            ))}
          </div>
          <div className="mini-stat compact-status"><span>Status</span><strong>{actionMessage}</strong></div>
        </div>
        {filterOpen && (
          <input className="lead-input compact-filter" value={filterText} onChange={(event) => setFilterText(event.target.value)} placeholder={`Filter ${title.toLowerCase()}...`} />
        )}
        {(selectedRow || actionMessage !== 'Ready.') && (
          <div className="action-note">
            <strong>{selectedRow ?? title}</strong> {selectedRow ? `selected in ${title}.` : actionMessage}
          </div>
        )}
        <div className="data-table">
          <div className="table-head">
            {columns.map((column) => <div key={column}>{column}</div>)}
            <div />
          </div>
          {filteredRows.map((row, index) => (
            <div className="data-row" key={index}>
              {row.map((cell) => <div key={cell}>{cell}</div>)}
              <div><button className="row-link" type="button" onClick={() => setSelectedRow(row[0])}>View</button></div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

import { Card } from '../components/ui.jsx';
import { useEffect, useRef, useState } from 'react';

function downloadText(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function rowsToCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

function parseCsv(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '').replaceAll('""', '"')));
}

function loadSavedRows(key, fallbackRows) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallbackRows;
  } catch {
    return fallbackRows;
  }
}

export function GenericModulePage({ title, description, stats, columns, rows, fieldOptions = {}, rowActions = null, filterPresets = [], viewPresets = [] }) {
  const [selectedRow, setSelectedRow] = useState(null);
  const storageKey = `ayurflow:${title}:rows:v2`;
  const [tableRows, setTableRows] = useState(() => loadSavedRows(storageKey, rows));
  const [actionMessage, setActionMessage] = useState('Ready.');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterPresets[0]?.column ?? '');
  const [activeView, setActiveView] = useState(viewPresets[0]?.id ?? 'all');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftRow, setDraftRow] = useState(columns.map(() => ''));
  const [importOpen, setImportOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [uploadName, setUploadName] = useState('No file selected');
  const importInputRef = useRef(null);
  const activeViewPredicate = viewPresets.find((preset) => preset.id === activeView)?.match ?? null;
  const activeViewLabel = viewPresets.find((preset) => preset.id === activeView)?.label ?? 'All';

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(tableRows));
    } catch {
      setActionMessage('Local browser storage is full or blocked.');
    }
  }, [storageKey, tableRows]);

  const filteredRows = tableRows.filter((row) => {
    if (activeViewPredicate && !activeViewPredicate(row, columns)) return false;
    if (!filterText) return true;
    if (!activeFilter) return row.join(' ').toLowerCase().includes(filterText.toLowerCase());
    const columnIndex = columns.indexOf(activeFilter);
    if (columnIndex === -1) return row.join(' ').toLowerCase().includes(filterText.toLowerCase());
    return String(row[columnIndex] ?? '').toLowerCase().includes(filterText.toLowerCase());
  });

  const rowToMap = (row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? '']));

  const runAction = (action) => {
    if (action === 'Add') {
      setDraftRow(columns.map((column, index) => {
        if (title === 'Appointments') return '';
        if (index === 0) return `${title} ${tableRows.length + 1}`;
        if (column === 'Status') return 'Pending';
        if (column === 'Time') return '10:00 AM';
        if (column === 'Type') return 'Consultation';
        return '';
      }));
      setAddOpen(true);
      setActionMessage(`Create new ${title.toLowerCase()} record.`);
      return;
    }
    if (action === 'Import') {
      importInputRef.current?.click();
      setActionMessage(`Import a ${title.toLowerCase()} file.`);
      return;
    }
    if (action === 'Export') {
      downloadText(`${title.toLowerCase()}-export.csv`, rowsToCsv(columns, tableRows), 'text/csv;charset=utf-8');
      setActionMessage(`${title} export started.`);
      return;
    }
    if (action === 'Filter') {
      setFilterOpen((current) => !current);
      setActionMessage('Filter toggled.');
      return;
    }
    if (action === 'Share') {
      const shareText = `${title} | ${tableRows.length} records`;
      navigator.clipboard?.writeText(shareText).catch(() => {});
      setActionMessage(`${title} summary copied.`);
      return;
    }
    setActionMessage(`${action} action ready for ${title}.`);
  };

  const saveDraft = () => {
    setTableRows((current) => [draftRow, ...current]);
    setActionMessage(`${draftRow[0] || title} added.`);
    setSelectedRow(draftRow[0] || title);
    setAddOpen(false);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploadName(file.name);
    const text = await file.text();
    let parsed = [];
    try {
      parsed = file.name.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCsv(text);
    } catch {
      setActionMessage('Import failed.');
      return;
    }
    const normalized = parsed
      .map((row) => (Array.isArray(row) ? Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ''])) : rowToMap(row)))
      .map((row) => columns.map((column) => row[column] ?? ''))
      .filter((row) => row.some(Boolean));
    setPreviewRows(normalized);
    setImportOpen(true);
    setActionMessage(`${normalized.length} record(s) ready to import.`);
  };

  const commitImport = () => {
    if (!previewRows.length) return;
    setTableRows((current) => [...previewRows, ...current]);
    setPreviewRows([]);
    setImportOpen(false);
    setActionMessage(`${previewRows.length} record(s) imported.`);
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

      {viewPresets.length > 0 && (
        <Card title={`${title} Views`} className="compact-action-card">
          <div className="module-toolbar compact-view-toolbar">
            <div className="mini-stat compact-status"><span>Selected view</span><strong>{activeViewLabel}</strong></div>
            <button className="pill" type="button" onClick={() => setViewMenuOpen((current) => !current)}>
              {viewMenuOpen ? 'Hide Views' : 'Open Views'}
            </button>
          </div>
          {viewMenuOpen && (
            <div className="filter-pills">
              {viewPresets.map((preset) => (
                <button
                  className={`sheet-tab filter-pill ${activeView === preset.id ? 'active' : ''}`}
                  type="button"
                  key={preset.id}
                  onClick={() => {
                    setActiveView(preset.id);
                    setViewMenuOpen(false);
                    setActionMessage(`${preset.label} view opened.`);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card title={`${title} List`}>
        <input ref={importInputRef} className="hidden-file-input" type="file" accept=".csv,.json" onChange={async (event) => handleFile(event.target.files?.[0])} />
        <div className="module-toolbar">
          <div className="sheet-actions toolbar-actions">
            {['Add', 'Import', 'Export', 'Filter', 'Share'].map((action) => (
              <button className="pill" type="button" key={action} onClick={() => runAction(action)}>{action}</button>
            ))}
          </div>
          <div className="mini-stat compact-status"><span>Status</span><strong>{actionMessage}</strong></div>
        </div>
        {filterOpen && (
          <div className="filter-panel">
            {filterPresets.length > 0 && (
              <div className="filter-pills">
                {filterPresets.map((preset) => (
                  <button
                    className={`sheet-tab filter-pill ${activeFilter === preset.column ? 'active' : ''}`}
                    type="button"
                    key={preset.column}
                    onClick={() => {
                      setActiveFilter(preset.column);
                      setFilterText('');
                      setActionMessage(`${preset.label} filter selected.`);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
            <input
              className="lead-input compact-filter"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder={activeFilter ? `Search by ${activeFilter.toLowerCase()}...` : `Filter ${title.toLowerCase()}...`}
            />
          </div>
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
          {filteredRows.length ? (
            filteredRows.map((row, index) => (
              <div className="data-row" key={index}>
                {row.map((cell, colIndex) => <div key={`${colIndex}-${cell}`}>{cell}</div>)}
                <div>
                  {rowActions ? rowActions(row, setSelectedRow, setActionMessage) : (
                    <button className="row-link" type="button" onClick={() => setSelectedRow(row[0])}>View</button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state compact-empty table-empty">
              <strong>No records yet.</strong>
              <p>Add a record or import a file to start using this module.</p>
            </div>
          )}
        </div>
      </Card>

      {addOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAddOpen(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label={`Add ${title}`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Add {title}</h2>
                <p>Fill in the row and save it to the list.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setAddOpen(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-body detail-grid">
              {columns.map((column, index) => (
                <label className="field-block" key={column}>
                  <span>{column}</span>
                  {fieldOptions[column]?.length ? (
                    <select
                      className="lead-input"
                      value={draftRow[index] ?? ''}
                      onChange={(event) => setDraftRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? event.target.value : cell)))}
                    >
                      <option value="">{`Select ${column.toLowerCase()}`}</option>
                      {fieldOptions[column].map((option) => <option value={option} key={option}>{option}</option>)}
                    </select>
                  ) : column === 'Status' ? (
                    <select
                      className="lead-input"
                      value={draftRow[index] ?? ''}
                      onChange={(event) => setDraftRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? event.target.value : cell)))}
                    >
                      <option value="">Select status</option>
                      <option>Pending</option>
                      <option>Confirmed</option>
                      <option>Active</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
                    </select>
                  ) : (
                    <input
                      className="lead-input"
                      type={column === 'Date' ? 'date' : column === 'Time' ? 'time' : 'text'}
                      value={draftRow[index] ?? ''}
                      onChange={(event) => setDraftRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? event.target.value : cell)))}
                      placeholder={`Enter ${column.toLowerCase()}`}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="pill" type="button" onClick={saveDraft}>Save <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setImportOpen(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label={`Import ${title}`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Import {title}</h2>
                <p>{uploadName} - {previewRows.length} record(s) detected.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setImportOpen(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-table">
              <div className="table-head">
                {columns.map((column) => <div key={column}>{column}</div>)}
                <div />
              </div>
              {previewRows.map((row, index) => (
                <div className="data-row" key={index}>
                  {row.map((cell) => <div key={`${cell}-${index}`}>{cell}</div>)}
                  <div>
                    {rowActions ? rowActions(row, setSelectedRow, setActionMessage) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setImportOpen(false)}>Cancel</button>
              <button className="pill" type="button" onClick={commitImport}>Import Now <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

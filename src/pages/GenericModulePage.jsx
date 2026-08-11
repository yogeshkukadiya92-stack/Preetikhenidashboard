import { ActionMenu, Card } from '../components/ui.jsx';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBranch } from '../context/BranchContext.jsx';

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
    const parsed = saved ? JSON.parse(saved) : fallbackRows;
    return Array.isArray(parsed) ? parsed : fallbackRows;
  } catch {
    return fallbackRows;
  }
}

function asImportRows(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function SearchableFieldPicker({ value, options, placeholder, onChange, onSelect }) {
  const [open, setOpen] = useState(false);
  const query = String(value ?? '').trim().toLowerCase();
  const matches = options
    .filter((option) => !query || `${option.label} ${option.searchText ?? ''}`.toLowerCase().includes(query))
    .slice(0, 8);

  return (
    <div className="searchable-field-picker">
      <input
        className="lead-input"
        value={value}
        onChange={(event) => { onChange(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && matches[0]) {
            event.preventDefault();
            onSelect(matches[0]);
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <div className="searchable-field-results" role="listbox">
          {matches.length ? matches.map((option) => (
            <button type="button" role="option" key={option.key ?? option.value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(option); setOpen(false); }}>
              <strong>{option.label}</strong>
              {option.description && <small>{option.description}</small>}
            </button>
          )) : <div className="searchable-field-empty">No patient found. Search by Patient ID, name, or mobile.</div>}
        </div>
      )}
    </div>
  );
}

export function GenericModulePage({ title, description, stats, columns, rows, fieldOptions = {}, searchableFieldOptions = {}, fieldTypes = {}, rowActions = null, filterPresets = [], viewPresets = [], normalizeRows = (value) => value, sortRows = null }) {
  const { branchKey } = useBranch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRow, setSelectedRow] = useState(null);
  const storageKey = branchKey(`${title}:rows:v3`);
  const [tableRows, setTableRows] = useState(() => normalizeRows(loadSavedRows(storageKey, rows)));
  const [actionMessage, setActionMessage] = useState('Ready.');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterPresets[0]?.column ?? '');
  const [appointmentNameFilter, setAppointmentNameFilter] = useState('');
  const [appointmentDateFrom, setAppointmentDateFrom] = useState('');
  const [appointmentDateTo, setAppointmentDateTo] = useState('');
  const [activeView, setActiveView] = useState(viewPresets[0]?.id ?? 'all');
  const [addOpen, setAddOpen] = useState(false);
  const [draftRow, setDraftRow] = useState(columns.map(() => ''));
  const [importOpen, setImportOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [uploadName, setUploadName] = useState('No file selected');
  const importInputRef = useRef(null);
  const handledAddAction = useRef('');
  const hasMountedRows = useRef(false);
  const activeViewPredicate = viewPresets.find((preset) => preset.id === activeView)?.match ?? null;
  const activeViewLabel = viewPresets.find((preset) => preset.id === activeView)?.label ?? 'All';
  const isAppointmentsPage = title === 'Appointments';

  useEffect(() => {
    const closeTransientUi = (event) => {
      if (event.key !== 'Escape') return;
      setAddOpen(false);
      setImportOpen(false);
      setFilterOpen(false);
    };
    document.addEventListener('keydown', closeTransientUi);
    return () => document.removeEventListener('keydown', closeTransientUi);
  }, []);

  useEffect(() => {
    if (!hasMountedRows.current) {
      hasMountedRows.current = true;
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(tableRows));
    } catch {
      setActionMessage('Local browser storage is full or blocked.');
    }
  }, [storageKey, tableRows]);

  const filteredRows = tableRows.filter((row) => {
    if (activeViewPredicate && !activeViewPredicate(row, columns)) return false;
    if (isAppointmentsPage) {
      const patientName = String(row[0] ?? '').toLowerCase();
      const appointmentDate = String(row[2] ?? '');
      if (appointmentNameFilter.trim() && !patientName.includes(appointmentNameFilter.trim().toLowerCase())) return false;
      if (appointmentDateFrom && appointmentDate < appointmentDateFrom) return false;
      if (appointmentDateTo && appointmentDate > appointmentDateTo) return false;
    }
    if (!filterText) return true;
    if (!activeFilter) return row.join(' ').toLowerCase().includes(filterText.toLowerCase());
    const columnIndex = columns.indexOf(activeFilter);
    if (columnIndex === -1) return row.join(' ').toLowerCase().includes(filterText.toLowerCase());
    return String(row[columnIndex] ?? '').toLowerCase().includes(filterText.toLowerCase());
  }).sort(typeof sortRows === 'function' ? sortRows : () => 0);

  const rowToMap = (row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? '']));

  const openAddModal = () => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setDraftRow(columns.map((column) => {
      if (column === 'Client') return searchParams.get('client') ?? '';
      if (column === 'Mobile') return searchParams.get('mobile') ?? '';
      if (title === 'Appointments' && column === 'Date') return localDate;
      if (title === 'Appointments' && column === 'Time') return localTime;
      if (title === 'Appointments' && column === 'Mode') return 'Offline';
      return '';
    }));
    setAddOpen(true);
    setActionMessage(`Create new ${title.toLowerCase()} record.`);
  };

  useEffect(() => {
    if (searchParams.get('action') !== 'add') return;
    const actionToken = searchParams.toString();
    if (handledAddAction.current === actionToken) return;
    handledAddAction.current = actionToken;
    openAddModal();
  }, [searchParams, setSearchParams]);

  const runAction = (action) => {
    if (action === 'Add') {
      openAddModal();
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

  const actionItems = [
    { label: `Add ${title}`, description: 'Create a new record', onClick: () => runAction('Add') },
    { label: 'Import CSV/JSON', description: 'Upload records', onClick: () => runAction('Import') },
    { label: 'Export CSV', description: 'Download records', onClick: () => runAction('Export') },
    { label: filterOpen ? 'Hide filters' : 'Show filters', description: 'Search and narrow results', onClick: () => runAction('Filter') },
    { label: 'Share summary', description: 'Copy record count', onClick: () => runAction('Share') },
  ];

  const viewItems = viewPresets.map((preset) => ({
    label: preset.label,
    description: preset.id === activeView ? 'Current view' : 'Switch view',
    onClick: () => {
      setActiveView(preset.id);
      setActionMessage(`${preset.label} view opened.`);
    },
  }));

  const saveDraft = () => {
    if (!draftRow.some((cell) => String(cell ?? '').trim())) {
      setActionMessage('Please fill at least one field before saving.');
      return;
    }
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
    const normalized = asImportRows(parsed)
      .map((row) => (Array.isArray(row) ? Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ''])) : row))
      .map((row) => columns.map((column) => row[column] ?? row[column.toLowerCase()] ?? ''))
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
          <p className="subtle">Shared cloud workspace</p>
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

      <Card
        title={`${title} List`}
        subtitle={`${actionMessage}${viewPresets.length ? ` Selected view: ${activeViewLabel}.` : ''}`}
        action={(
          <div className="card-action-group">
            <button className="pill primary-action" type="button" onClick={openAddModal}>+ Add {title}</button>
            {viewPresets.length > 0 && <ActionMenu label="Views" items={viewItems} />}
            <ActionMenu label="Actions" items={actionItems} />
          </div>
        )}
      >
        <input ref={importInputRef} className="hidden-file-input" type="file" accept=".csv,.json" onChange={async (event) => handleFile(event.target.files?.[0])} />
        {isAppointmentsPage && (
          <div className="appointment-filter-bar" aria-label="Appointment filters">
            <label className="field-block">
              <span>Patient name</span>
              <input className="lead-input" value={appointmentNameFilter} onChange={(event) => setAppointmentNameFilter(event.target.value)} placeholder="Search patient name..." />
            </label>
            <label className="field-block">
              <span>Date from</span>
              <input className="lead-input" type="date" value={appointmentDateFrom} onChange={(event) => setAppointmentDateFrom(event.target.value)} />
            </label>
            <label className="field-block">
              <span>Date to</span>
              <input className="lead-input" type="date" min={appointmentDateFrom || undefined} value={appointmentDateTo} onChange={(event) => setAppointmentDateTo(event.target.value)} />
            </label>
            <button className="pill" type="button" disabled={!appointmentNameFilter && !appointmentDateFrom && !appointmentDateTo} onClick={() => {
              setAppointmentNameFilter('');
              setAppointmentDateFrom('');
              setAppointmentDateTo('');
              setActionMessage('Appointment filters cleared.');
            }}>Clear filters</button>
            <span className="appointment-filter-count" aria-live="polite">{filteredRows.length} result{filteredRows.length === 1 ? '' : 's'}</span>
          </div>
        )}
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
        <div className="data-table adaptive-table" style={{ '--table-columns': columns.length }}>
          <div className="table-head">
            {columns.map((column) => <div key={column}>{column}</div>)}
            <div />
          </div>
          {filteredRows.length ? (
            filteredRows.map((row, index) => (
              <div className="data-row" key={index}>
                {row.map((cell, cellIndex) => <div data-label={columns[cellIndex]} key={`${columns[cellIndex]}-${index}`}>{cell}</div>)}
                <div>
                  {rowActions ? rowActions(row, setSelectedRow, setActionMessage, setTableRows) : (
                    <button className="row-link" type="button" onClick={() => setSelectedRow(row[0])}>View</button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state compact-empty table-empty">
              <strong>No records yet.</strong>
              <p>Add a record or import a file to start using this module.</p>
              <button className="pill primary-action" type="button" onClick={openAddModal}>+ Add {title}</button>
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
                  {searchableFieldOptions[column]?.length ? (
                    <SearchableFieldPicker
                      value={draftRow[index] ?? ''}
                      options={searchableFieldOptions[column]}
                      placeholder={`Search ${column.toLowerCase()} by ID, name, or mobile...`}
                      onChange={(nextValue) => setDraftRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? nextValue : cell)))}
                      onSelect={(option) => setDraftRow((current) => columns.map((draftColumn, columnIndex) => {
                        if (columnIndex === index) return option.value;
                        if (option.autoFill?.[draftColumn] !== undefined) return option.autoFill[draftColumn];
                        return current[columnIndex];
                      }))}
                    />
                  ) : fieldOptions[column]?.length ? (
                    <select
                      className="lead-input"
                      value={draftRow[index] ?? ''}
                      onChange={(event) => setDraftRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? event.target.value : cell)))}
                    >
                      <option value="">{`Select ${column.toLowerCase()}`}</option>
                      {fieldOptions[column].map((option, optionIndex) => <option value={option} key={`${option}-${optionIndex}`}>{option}</option>)}
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
                      type={fieldTypes[column] ?? (column === 'Date' ? 'date' : column === 'Time' ? 'time' : 'text')}
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
            <div className="modal-table adaptive-table" style={{ '--table-columns': columns.length }}>
              <div className="table-head">
                {columns.map((column) => <div key={column}>{column}</div>)}
                <div />
              </div>
              {previewRows.map((row, index) => (
                <div className="data-row" key={index}>
                  {row.map((cell, cellIndex) => <div data-label={columns[cellIndex]} key={`${columns[cellIndex]}-${index}`}>{cell}</div>)}
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

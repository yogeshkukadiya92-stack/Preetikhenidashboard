import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight } from '../components/icons.jsx';
import { ActionMenu, Card, StatusPill, Tag } from '../components/ui.jsx';
import { useBranch } from '../context/BranchContext.jsx';
import { GenericModulePage } from './GenericModulePage.jsx';
import {
  accounts,
  clients,
  coachingBatches,
  communicationTemplates,
  forms,
  formResponses,
  integrations,
  inventoryItems,
  leads,
  packages,
  payments,
  portalFeatures,
  settingsItems,
  sheetTabs,
  staffRoles,
  syncPreviewRows,
  services,
  treatmentPlans,
  users,
} from '../data/appConfig.js';

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

function loadSavedState(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function loadSavedArray(key, fallback = []) {
  const saved = loadSavedState(key, fallback);
  return Array.isArray(saved) ? saved : fallback;
}

function loadSavedObject(key, fallback = {}) {
  const saved = loadSavedState(key, fallback);
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : fallback;
}

function asImportRows(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function getSavedOperationRows(tabId) {
  const rowsByTab = loadSavedObject('ayurflow:Operations:tabs:v3', {});
  return Array.isArray(rowsByTab[tabId]) ? rowsByTab[tabId] : [];
}

function getSavedPackageNames() {
  const savedPackageNames = getSavedOperationRows('packages').map((row) => row[0]).filter(Boolean);
  const seedPackageNames = packages.map((item) => item.name).filter(Boolean);
  return Array.from(new Set([...savedPackageNames, ...seedPackageNames]));
}

function currentAppointmentSlot() {
  const now = new Date();
  return {
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  };
}

function ImportExportModule({
  title,
  description,
  stats,
  headers,
  seedRows,
  filenameBase,
  rowToValues,
  parseRow,
  filterPresets = [],
  extraTopCard = null,
  customRows = null,
  rowActions = null,
  fieldOptions = {},
  fieldTypes = {},
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { branchKey } = useBranch();
  const legacyStorageKey = `ayurflow:${filenameBase}:rows:v3`;
  const storageKey = branchKey(`${filenameBase}:rows:v3`);
  const [rows, setRows] = useState(() => loadSavedArray(storageKey, loadSavedArray(legacyStorageKey, seedRows)));
  const [preview, setPreview] = useState([]);
  const [uploadName, setUploadName] = useState('No file selected');
  const [message, setMessage] = useState('Ready to import or export data.');
  const [modalOpen, setModalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftRecord, setDraftRecord] = useState(() => Object.fromEntries(headers.map((header) => [header, ''])));
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterPresets[0]?.column ?? '');
  const bannerFileInputRef = useRef(null);
  const handledAddRecordAction = useRef('');

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch {
      setMessage('Local browser storage is full or blocked.');
    }
  }, [rows, storageKey]);

  const openAddRecord = () => {
    setDraftRecord(Object.fromEntries(headers.map((header) => [header, header === 'Client' ? (searchParams.get('client') ?? '') : header === 'Mobile' ? (searchParams.get('mobile') ?? '') : ''])));
    setAddOpen(true);
    setMessage(`Add ${title.toLowerCase()} record opened.`);
  };

  useEffect(() => {
    if (searchParams.get('action') !== 'add') return;
    const actionToken = searchParams.toString();
    if (handledAddRecordAction.current === actionToken) return;
    handledAddRecordAction.current = actionToken;
    openAddRecord();
  }, [searchParams, setSearchParams]);

  const rowToCsvValues = (row) => {
    const values = rowToValues(row);
    return headers.map((header) => values[header] ?? '');
  };

  const exportCsv = () => {
    downloadText(`${filenameBase}.csv`, rowsToCsv(headers, rows.map(rowToCsvValues)), 'text/csv;charset=utf-8');
    setMessage('CSV export started.');
  };

  const downloadTemplate = () => {
    downloadText(`${filenameBase}-template.csv`, rowsToCsv(headers, [headers.map(() => '')]), 'text/csv;charset=utf-8');
    setMessage('CSV template downloaded.');
  };

  const normalize = (entry) => parseRow(entry);

  const handleFile = async (file) => {
    if (!file) return;
    setUploadName(file.name);
    const text = await file.text();
    let parsed = [];
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        parsed = JSON.parse(text);
      } else {
        parsed = parseCsv(text);
      }
    } catch {
      setPreview([]);
      setMessage('Import failed. Please upload a valid CSV or JSON file.');
      return;
    }
    const normalized = asImportRows(parsed)
      .map((row) => (Array.isArray(row) ? normalize(Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))) : normalize(row)))
      .filter((row) => Object.values(row).some(Boolean));
    setPreview(normalized);
    setMessage(`${normalized.length} records ready to import.`);
    setModalOpen(true);
  };

  const commitImport = () => {
    if (!preview.length) {
      setMessage('No records found to import.');
      return;
    }
    setRows((current) => [...preview, ...current]);
    setPreview([]);
    setUploadName('No file selected');
    setModalOpen(false);
    setMessage(`Imported ${preview.length} records successfully.`);
  };

  const visibleRows = customRows ?? rows.map((row) => row);
  const saveDraftRecord = () => {
    const normalized = normalize(draftRecord);
    if (!Object.values(normalized).some(Boolean)) {
      setMessage('Please fill at least one field before saving.');
      return;
    }
    setRows((current) => [normalized, ...current]);
    setAddOpen(false);
    setMessage(`${rowToCsvValues(normalized)[0] || title} added.`);
  };

  const filteredRows = visibleRows.filter((row) => {
    if (!filterText) return true;
    const mapped = rowToValues(row);
    if (!activeFilter) {
      return Object.values(mapped).join(' ').toLowerCase().includes(filterText.toLowerCase());
    }
    return String(mapped[activeFilter] ?? '').toLowerCase().includes(filterText.toLowerCase());
  });
  const openRecord = (row) => {
    setSelectedRecord(row);
    setMessage(`${rowToCsvValues(row)[0]} selected.`);
  };

  const openClientAction = (path, label) => {
    setSelectedRecord(null);
    setMessage(`${label} opened.`);
    navigate(path);
  };

  const defaultRowAction = (row) => (
    <button className="row-link" type="button" onClick={() => openRecord(row)}>
      View
    </button>
  );
  const moduleActions = [
    { label: `Add ${title}`, description: 'Create a new record', onClick: openAddRecord },
    { label: 'Download template', description: 'Blank CSV format', onClick: downloadTemplate },
    { label: 'Import CSV/JSON', description: 'Upload records', onClick: () => bannerFileInputRef.current?.click() },
    { label: 'Export CSV', description: 'Download current records', onClick: exportCsv },
    ...(filterPresets.length > 0 ? [
      { label: filterOpen ? 'Hide filters' : 'Show filters', description: 'Search this module', onClick: () => setFilterOpen((current) => !current) },
      { label: 'Reset filters', description: 'Clear active search', onClick: () => { setActiveFilter(filterPresets[0]?.column ?? ''); setFilterText(''); setMessage('Filters reset.'); } },
    ] : []),
  ];

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

      <input ref={bannerFileInputRef} className="hidden-file-input" type="file" accept=".csv,.json" onChange={async (event) => handleFile(event.target.files?.[0])} />

      {extraTopCard}

      {filterPresets.length > 0 && filterOpen && (
        <Card title="Filters" className="compact-action-card">
          <div className="filter-panel">
            <div className="filter-pills">
              {filterPresets.map((preset) => (
                <button
                  className={`sheet-tab filter-pill ${activeFilter === preset.column ? 'active' : ''}`}
                  type="button"
                  key={preset.column}
                  onClick={() => {
                    setActiveFilter(preset.column);
                    setFilterText('');
                    setMessage(`${preset.label} selected.`);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              className="lead-input compact-filter"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder={activeFilter ? `Search by ${activeFilter.toLowerCase()}...` : `Filter ${title.toLowerCase()}...`}
            />
          </div>
        </Card>
      )}

      <div className="grid single-module-grid">
        <Card title={`Current ${title}`} subtitle={message} action={<div className="card-action-group"><button className="pill primary-action" type="button" onClick={openAddRecord}>+ Add {title}</button><ActionMenu label="Actions" items={moduleActions} /></div>}>
          <div className="table adaptive-table" style={{ '--table-columns': headers.length }}>
            <div className="table-head">
              {headers.map((header) => <div key={header}>{header}</div>)}
              <div />
            </div>
            {filteredRows.length ? (
              filteredRows.map((row, index) => (
                <div className="data-row" key={index}>
                  {headers.map((header) => <div key={header}>{rowToValues(row)[header]}</div>)}
                  <div>{rowActions ? rowActions(row) : defaultRowAction(row)}</div>
                </div>
              ))
            ) : (
              <div className="empty-state compact-empty table-empty">
                <strong>No records yet.</strong>
                <p>Add a record or import a file to start using this module.</p>
                <button className="pill primary-action" type="button" onClick={openAddRecord}>+ Add {title}</button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {addOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAddOpen(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label={`Add ${title}`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Add {title}</h2>
                <p>Fill the fields and save this record.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setAddOpen(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-body detail-grid">
              {headers.map((header) => (
                <label className="field-block" key={header}>
                  <span>{header}</span>
                  {Object.prototype.hasOwnProperty.call(fieldOptions, header) ? (
                    <select
                      className="lead-input"
                      value={draftRecord[header] ?? ''}
                      onChange={(event) => setDraftRecord((current) => ({ ...current, [header]: event.target.value }))}
                    >
                      <option value="">{fieldOptions[header].length ? `Select ${header.toLowerCase()}` : `Add ${header.toLowerCase()} first`}</option>
                      {fieldOptions[header].map((option, optionIndex) => <option value={option} key={`${option}-${optionIndex}`}>{option}</option>)}
                    </select>
                  ) : (
                    <input
                      className="lead-input"
                      type={fieldTypes[header] ?? 'text'}
                      value={draftRecord[header] ?? ''}
                      onChange={(event) => setDraftRecord((current) => ({ ...current, [header]: event.target.value }))}
                      placeholder={`Enter ${header.toLowerCase()}`}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="pill" type="button" onClick={saveDraftRecord}>Save <ChevronRight /></button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div className="modal-shell" role="dialog" aria-modal="true" aria-label={`${title} import preview`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Import Preview</h2>
                <p>{preview.length} record(s) detected from {uploadName}.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setModalOpen(false)} aria-label="Close modal">✕</button>
            </div>
            <div className="modal-body">
              <div className="mini-stat">
                <span>Source file</span>
                <strong>{uploadName}</strong>
              </div>
              <div className="mini-stat">
                <span>Ready to import</span>
                <strong>{preview.length}</strong>
              </div>
            </div>
            <div className="modal-table adaptive-table" style={{ '--table-columns': headers.length }}>
              <div className="table-head">
                {headers.map((header) => <div key={header}>{header}</div>)}
                <div />
              </div>
              {preview.map((row, index) => (
                <div className="data-row" key={index}>
                  {headers.map((header) => <div key={header}>{rowToValues(row)[header]}</div>)}
                  <div>{rowActions ? rowActions(row) : defaultRowAction(row)}</div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setModalOpen(false)}>Cancel <ChevronRight /></button>
              <button className="pill" type="button" onClick={commitImport}>Import Now <ChevronRight /></button>
            </div>
          </div>
        </div>
      )}

      {selectedRecord && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedRecord(null)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label={`${title} options`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{title === 'Clients' ? 'Client Options' : `${title} Options`}</h2>
                <p>{rowToCsvValues(selectedRecord)[0]} selected.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setSelectedRecord(null)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-body detail-grid">
              {headers.map((header) => (
                <div className="mini-stat" key={header}>
                  <span>{header}</span>
                  <strong>{rowToValues(selectedRecord)[header]}</strong>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => openClientAction('/appointments', 'Book Appointment')}>Book Appointment <ChevronRight /></button>
              <button className="pill" type="button" onClick={() => openClientAction('/payments', 'Add Payment')}>Add Payment <ChevronRight /></button>
              <button className="pill" type="button" onClick={() => openClientAction('/treatments', 'Treatment Plan')}>Treatment Plan <ChevronRight /></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function CRMPage() {
  const navigate = useNavigate();
  const { branchKey, currentBranch } = useBranch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('leads');
  const [manualLeads, setManualLeads] = useState(() => loadSavedArray(branchKey('crm:leads:v4')));
  const [editingIndex, setEditingIndex] = useState(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [showLeads, setShowLeads] = useState(true);
  const [preview, setPreview] = useState([]);
  const [uploadName, setUploadName] = useState('No file selected');
  const [message, setMessage] = useState('Ready to manage leads.');
  const [dropActive, setDropActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [leadForm, setLeadForm] = useState({
    name: '',
    source: 'Website',
    status: 'New',
    score: '',
    addedOn: 'Today',
  });

  const title = 'CRM';

  const rowToValues = (lead) => ({
    Lead: lead.name,
    Source: lead.source,
    Status: lead.status,
    Score: lead.score,
    'Added On': lead.addedOn,
  });

  const rowToCsvValues = (lead) => [lead.name, lead.source, lead.status, lead.score, lead.addedOn];

  const openClientAction = (path, label) => {
    setSelectedRecord(null);
    setMessage(`${label} opened.`);
    navigate(path);
  };

  const leadRows = [
    ...manualLeads.map((lead, index) => ({ ...lead, __manual: true, __manualIndex: index })),
    ...leads.slice(0, 5).map((lead) => ({ ...lead, __manual: false })),
  ];
  const headers = ['Lead', 'Source', 'Status', 'Score', 'Added On'];

  const resetLeadForm = () => {
    setLeadForm({ name: '', source: 'Website', status: 'New', score: '', addedOn: 'Today' });
    setEditingIndex(null);
  };

  const openCreateLead = () => {
    resetLeadForm();
    setLeadModalOpen(true);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(branchKey('crm:leads:v4'), JSON.stringify(manualLeads));
    } catch {
      setMessage('Local browser storage is full or blocked.');
    }
  }, [branchKey, manualLeads]);

  useEffect(() => {
    if (searchParams.get('action') !== 'add') return;
    openCreateLead();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const addManualLead = () => {
    if (!leadForm.name.trim()) {
      setMessage('Please enter a lead name before saving.');
      return;
    }
    const nextLead = {
      name: leadForm.name.trim(),
      source: leadForm.source.trim() || 'Website',
      status: leadForm.status.trim() || 'New',
      score: leadForm.score.trim() || '?',
      addedOn: leadForm.addedOn.trim() || 'Today',
    };
    setManualLeads((current) => (editingIndex === null ? [nextLead, ...current] : current.map((lead, index) => (index === editingIndex ? nextLead : lead))));
    setMessage(editingIndex === null ? 'Lead added successfully.' : 'Lead updated successfully.');
    resetLeadForm();
    setLeadModalOpen(false);
    setShowLeads(true);
  };

  const startEditLead = (lead, index) => {
    setLeadForm({
      name: lead.name ?? '',
      source: lead.source ?? 'Website',
      status: lead.status ?? 'New',
      score: String(lead.score ?? ''),
      addedOn: lead.addedOn ?? 'Today',
    });
    setEditingIndex(index);
    setLeadModalOpen(true);
  };

  const deleteManualLead = (index) => {
    if (!window.confirm('Delete this lead? This action cannot be undone.')) return;
    setManualLeads((current) => current.filter((_, idx) => idx !== index));
    setMessage('Lead deleted successfully.');
    if (editingIndex === index) {
      resetLeadForm();
      setLeadModalOpen(false);
    }
  };

  const leadPriorityTone = (status) => {
    if (status === 'Hot') return 'tag-hot';
    if (status === 'Follow-up due') return 'tag-follow';
    if (status === 'Contacted') return 'tag-contacted';
    return 'tag-new';
  };

  const leadValues = (lead) => [lead.name, lead.source, lead.status, lead.score, lead.addedOn];

  const exportCsv = () => {
    downloadText('ayurflow-leads.csv', rowsToCsv(headers, leadRows.map(leadValues)), 'text/csv;charset=utf-8');
    setMessage('Lead CSV export started.');
  };

  const exportJson = () => {
    const rows = leadRows.map(({ __manual, __manualIndex, ...lead }) => lead);
    downloadText('ayurflow-leads.json', JSON.stringify(rows, null, 2), 'application/json;charset=utf-8');
    setMessage('Lead JSON export started.');
  };

  const normalizeLead = (entry) => ({
    name: entry.Lead ?? entry.lead ?? entry.name ?? '',
    source: entry.Source ?? entry.source ?? 'Website',
    status: entry.Status ?? entry.status ?? 'New',
    score: entry.Score ?? entry.score ?? '',
    addedOn: entry['Added On'] ?? entry.addedOn ?? 'Today',
  });

  const handleFile = async (file) => {
    if (!file) return;
    setUploadName(file.name);
    const text = await file.text();
    let parsed = [];
    try {
      parsed = file.name.toLowerCase().endsWith('.json')
        ? JSON.parse(text)
        : parseCsv(text).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
    } catch {
      setPreview([]);
      setMessage('Import failed. Please upload a valid leads CSV or JSON file.');
      return;
    }
    const normalized = asImportRows(parsed).map(normalizeLead).filter((lead) => lead.name);
    setPreview(normalized);
    setMessage(`${normalized.length} leads ready to import.`);
    setModalOpen(true);
  };

  const commitImport = () => {
    if (!preview.length) {
      setMessage('No leads found to import.');
      return;
    }
    setManualLeads((current) => [...preview, ...current]);
    setPreview([]);
    setUploadName('No file selected');
    setModalOpen(false);
    setMessage(`Imported ${preview.length} leads successfully.`);
    setActiveTab('leads');
    setShowLeads(true);
  };
  const leadActions = [
    { label: 'Add lead', description: 'Create a CRM lead', onClick: openCreateLead },
    { label: showLeads ? 'Hide lead list' : 'Show lead list', description: 'Change list visibility', onClick: () => setShowLeads((current) => !current) },
  ];

  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <h1>CRM</h1>
          <p>Track leads, follow-ups, and conversion activity without showing upload tools until you need them.</p>
          <p className="subtle">Current branch: {currentBranch}</p>
        </div>
        <div className="module-stats">
          <div className="mini-stat"><span>Total leads</span><strong>{leadRows.length}</strong></div>
          <div className="mini-stat"><span>Hot leads</span><strong>{leadRows.filter((lead) => lead.status === 'Hot').length}</strong></div>
          <div className="mini-stat"><span>Status</span><strong>{message}</strong></div>
        </div>
      </div>

      <div className="sheet-tabs">
        <button className={`sheet-tab ${activeTab === 'leads' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('leads')}>Leads</button>
        <button className={`sheet-tab ${activeTab === 'import' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('import')}>Import / Export</button>
      </div>

      {activeTab === 'leads' ? (
        <Card title="Current Leads" subtitle={`${manualLeads.length} manual lead(s). ${message}`} action={<div className="card-action-group"><button className="pill primary-action" type="button" onClick={openCreateLead}>+ Add Lead</button><ActionMenu label="Actions" items={leadActions} /></div>}>
            {showLeads ? (
              <div className="table adaptive-table" style={{ '--table-columns': headers.length }}>
                <div className="table-head">
                  {headers.map((header) => <div key={header}>{header}</div>)}
                  <div />
                </div>
                {leadRows.length ? (
                  leadRows.map((lead, index) => (
                    <div className="data-row" key={`${lead.name}-${lead.addedOn}-${index}`}>
                      <div>{lead.name}</div>
                      <div>{lead.source}</div>
                      <div><Tag tone={leadPriorityTone(lead.status)}>{lead.status}</Tag></div>
                      <div>{lead.score}</div>
                      <div>{lead.addedOn}</div>
                      <div>
                        {lead.__manual ? (
                          <ActionMenu
                            compact
                            label={`Actions for ${lead.name}`}
                            items={[
                              { label: 'Edit lead', onClick: () => startEditLead(manualLeads[lead.__manualIndex], lead.__manualIndex) },
                              { label: 'Delete lead', description: 'Permanently remove this lead', danger: true, onClick: () => deleteManualLead(lead.__manualIndex) },
                            ]}
                          />
                        ) : (
                          <ActionMenu compact label={`Actions for ${lead.name}`} items={[{ label: 'View lead', onClick: () => setSelectedRecord(lead) }]} />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state compact-empty table-empty">
                    <strong>No leads yet.</strong>
                    <p>Add the first lead or import a file to start the CRM list.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <strong>Leads are hidden.</strong>
                <p>Use Actions, then Show lead list, when you want the full CRM list back on screen.</p>
              </div>
            )}
          </Card>
      ) : (
        <div className="grid two-column-module-grid">
          <Card title="Import / Export Leads" subtitle="Hidden from the main CRM view to keep daily work clean.">
            <div className="import-banner">
              <div>
                <strong>Spreadsheet tools are ready.</strong>
                <p>Export the current leads or import a CSV/JSON file when the team needs bulk updates.</p>
              </div>
              <ActionMenu label="Export" items={[
                { label: 'Export CSV', description: 'Spreadsheet-compatible file', onClick: exportCsv },
                { label: 'Export JSON', description: 'Structured backup file', onClick: exportJson },
              ]} />
            </div>
          </Card>

          <Card title="Bulk Upload Leads" subtitle="Use Lead, Source, Status, Score, Added On columns.">
            <div className="upload-box">
              <label
                className={`upload-dropzone ${dropActive ? 'active' : ''}`}
                onDragOver={(event) => { event.preventDefault(); setDropActive(true); }}
                onDragLeave={() => setDropActive(false)}
                onDrop={async (event) => {
                  event.preventDefault();
                  setDropActive(false);
                  await handleFile(event.dataTransfer.files?.[0]);
                }}
              >
                <input type="file" accept=".csv,.json" onChange={async (event) => handleFile(event.target.files?.[0])} />
                <strong>Drop leads file here or click to browse</strong>
                <span>{uploadName}</span>
              </label>
              <div className="sheet-actions">
                <button className="pill" type="button" onClick={() => {
                  if (!preview.length) {
                    setMessage('Upload a leads file first to open preview.');
                    return;
                  }
                  setModalOpen(true);
                }}>Open Preview <ChevronRight /></button>
                <button className="pill" type="button" onClick={() => { setPreview([]); setMessage('Lead import preview cleared.'); }}>Clear Preview <ChevronRight /></button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Lead import preview" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Import Preview</h2>
                <p>{preview.length} lead(s) detected from {uploadName}.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setModalOpen(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-table adaptive-table" style={{ '--table-columns': headers.length }}>
              <div className="table-head">
                {headers.map((header) => <div key={header}>{header}</div>)}
                <div />
              </div>
              {preview.map((lead, index) => (
                <div className="data-row" key={`${lead.name}-${index}`}>
                  <div>{lead.name}</div>
                  <div>{lead.source}</div>
                  <div>{lead.status}</div>
                  <div>{lead.score}</div>
                  <div>{lead.addedOn}</div>
                  <div><Tag tone="tag-follow">Preview</Tag></div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setModalOpen(false)}>Cancel <ChevronRight /></button>
              <button className="pill" type="button" onClick={commitImport}>Import Now <ChevronRight /></button>
            </div>
          </div>
        </div>
      )}

      {leadModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setLeadModalOpen(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label="Manual lead form" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{editingIndex === null ? 'Add Manual Lead' : 'Edit Manual Lead'}</h2>
                <p>Capture a new lead directly in CRM and keep the pipeline moving.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setLeadModalOpen(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-body">
              <div className="lead-form">
                <label>
                  <span className="subtle">Lead name</span>
                  <input className="lead-input" value={leadForm.name} onChange={(event) => setLeadForm((current) => ({ ...current, name: event.target.value }))} placeholder="Enter lead name" />
                </label>
                <div className="lead-grid">
                  <label>
                    <span className="subtle">Source</span>
                    <input className="lead-input" value={leadForm.source} onChange={(event) => setLeadForm((current) => ({ ...current, source: event.target.value }))} placeholder="Website" />
                  </label>
                  <label>
                    <span className="subtle">Status</span>
                    <select className="lead-input" value={leadForm.status} onChange={(event) => setLeadForm((current) => ({ ...current, status: event.target.value }))}>
                      <option>New</option>
                      <option>Hot</option>
                      <option>Contacted</option>
                      <option>Follow-up due</option>
                      <option>Won</option>
                    </select>
                  </label>
                  <label>
                    <span className="subtle">Score</span>
                    <input className="lead-input" value={leadForm.score} onChange={(event) => setLeadForm((current) => ({ ...current, score: event.target.value }))} placeholder="82" />
                  </label>
                  <label>
                    <span className="subtle">Added on</span>
                    <input className="lead-input" value={leadForm.addedOn} onChange={(event) => setLeadForm((current) => ({ ...current, addedOn: event.target.value }))} placeholder="Today" />
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setLeadModalOpen(false)}>Cancel <ChevronRight /></button>
              <button className="pill" type="button" onClick={addManualLead}>
                {editingIndex === null ? 'Add Lead' : 'Save Lead'} <ChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ClientProfile({ client, onBack }) {
  const clientName = client.name ?? '';
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [treatModal, setTreatModal] = useState(false);
  const [apptModal, setApptModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [treatTemplates] = useState(() => loadSavedArray('ayurflow:treatment-templates:v1', []));
  const [treatServiceOptions] = useState(() => {
    const saved = loadSavedArray('ayurflow:Services:rows:v2', []);
    const savedNames = saved.map((row) => row[0]).filter(Boolean);
    return Array.from(new Set([...savedNames, ...services]));
  });
  const [treatForm, setTreatForm] = useState({ service: treatServiceOptions[0] ?? services[0] ?? '', goal: '', duration: '30 days', medicine: '', dose: '', timing: '', status: 'Active' });
  const [apptForm, setApptForm] = useState(() => ({ mobile: '', ...currentAppointmentSlot(), type: services[0] ?? '', status: 'Confirmed' }));
  const [payForm, setPayForm] = useState({ invoice: '', amount: '', status: 'Paid', paidOn: '' });

  const allTreatments = useMemo(() => {
    const saved = loadSavedState('ayurflow:Treatment Plans:rows:v2', []);
    return saved.filter((row) => String(row[0] ?? '').toLowerCase().includes(clientName.toLowerCase()));
  }, [clientName, refreshKey]);

  const allAppointments = useMemo(() => {
    const saved = loadSavedState('ayurflow:Appointments:rows:v2', []);
    return saved.filter((row) => String(row[0] ?? '').toLowerCase().includes(clientName.toLowerCase()));
  }, [clientName, refreshKey]);

  const allPayments = useMemo(() => {
    const saved = loadSavedState('ayurflow:ayurflow-payments:rows:v3', []);
    return saved.filter((row) => String(row.client ?? '').toLowerCase().includes(clientName.toLowerCase()));
  }, [clientName, refreshKey]);

  const saveTreatment = () => {
    const key = 'ayurflow:Treatment Plans:rows:v2';
    const current = loadSavedArray(key, []);
    window.localStorage.setItem(key, JSON.stringify([[clientName, treatForm.service, treatForm.goal, treatForm.duration, treatForm.medicine, treatForm.dose, treatForm.timing, treatForm.status], ...current]));
    setRefreshKey((k) => k + 1);
    setTreatModal(false);
    setTreatForm({ service: services[0] ?? '', goal: '', duration: '30 days', medicine: '', dose: '', timing: '', status: 'Active' });
  };

  const saveAppointment = () => {
    const key = 'ayurflow:Appointments:rows:v2';
    const current = loadSavedArray(key, []);
    window.localStorage.setItem(key, JSON.stringify([[clientName, apptForm.mobile, apptForm.date, apptForm.time, apptForm.type, apptForm.status], ...current]));
    setRefreshKey((k) => k + 1);
    setApptModal(false);
    setApptForm({ mobile: '', ...currentAppointmentSlot(), type: services[0] ?? '', status: 'Confirmed' });
  };

  const savePayment = () => {
    const key = 'ayurflow:ayurflow-payments:rows:v3';
    const current = loadSavedArray(key, []);
    window.localStorage.setItem(key, JSON.stringify([{ client: clientName, invoice: payForm.invoice, amount: payForm.amount, status: payForm.status, paidOn: payForm.paidOn }, ...current]));
    setRefreshKey((k) => k + 1);
    setPayModal(false);
    setPayForm({ invoice: '', amount: '', status: 'Paid', paidOn: '' });
  };

  return (
    <section className="module-page">
      <div className="module-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button className="pill" type="button" onClick={onBack}>← Back</button>
          <div className="client-avatar">{clientName.charAt(0).toUpperCase()}</div>
          <div>
            <h1>{clientName}</h1>
            <p>{client.program || 'No program'} · Age: {client.age || '—'} · Next Visit: {client.nextVisit || '—'}</p>
          </div>
          <ActionMenu label="Actions" items={[
            { label: 'Add treatment plan', description: `Create a plan for ${clientName}`, onClick: () => setTreatModal(true) },
            { label: 'Book appointment', description: `Schedule a visit for ${clientName}`, onClick: () => setApptModal(true) },
            { label: 'Add payment', description: `Record a payment for ${clientName}`, onClick: () => setPayModal(true) },
          ]} />
        </div>
        <div className="module-stats">
          <div className="mini-stat"><span>Treatments</span><strong>{allTreatments.length}</strong></div>
          <div className="mini-stat"><span>Appointments</span><strong>{allAppointments.length}</strong></div>
          <div className="mini-stat"><span>Payments</span><strong>{allPayments.length}</strong></div>
        </div>
      </div>

      <div className="sheet-tabs">
        {[['overview', 'Overview'], ['treatments', 'Treatments'], ['appointments', 'Appointments'], ['payments', 'Payments']].map(([id, label]) => (
          <button key={id} className={`sheet-tab ${activeTab === id ? 'active' : ''}`} type="button" onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card title="Client Details">
          <div className="detail-grid">
            {[['Client', client.name], ['Age', client.age], ['Address', client.address], ['Program', client.program], ['Next Visit', client.nextVisit], ['Birthday', client.birthday], ['Anniversary', client.anniversary]].map(([label, value]) => (
              <div className="mini-stat" key={label}>
                <span>{label}</span>
                <strong>{value || '—'}</strong>
              </div>
            ))}
            <div className="mini-stat"><span>Treatment Plans</span><strong>{allTreatments.length}</strong></div>
            <div className="mini-stat"><span>Appointments</span><strong>{allAppointments.length}</strong></div>
            <div className="mini-stat"><span>Payments</span><strong>{allPayments.length}</strong></div>
          </div>
        </Card>
      )}

      {activeTab === 'treatments' && (
        <Card title="Treatment Plans" subtitle={`Plans linked to ${clientName}`}>
          <div className="table adaptive-table" style={{ '--table-columns': 7 }}>
            <div className="table-head">
              {['Service', 'Goal', 'Duration', 'Medicine', 'Dose', 'Timing', 'Status'].map((h) => <div key={h}>{h}</div>)}
              <div />
            </div>
            {allTreatments.length ? allTreatments.map((row, i) => (
              <div className="data-row" key={i}>
                <div>{row[1]}</div>
                <div>{row[2]}</div>
                <div>{row[3]}</div>
                <div>{row[4]}</div>
                <div>{row[5]}</div>
                <div>{row[6]}</div>
                <div>{row[7] ?? row[4]}</div>
                <div />
              </div>
            )) : (
              <div className="empty-state compact-empty table-empty">
                <strong>No treatment plans yet.</strong>
                <p>Use Actions, then Add treatment plan, to create one.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'appointments' && (
        <Card title="Appointments" subtitle={`Appointments linked to ${clientName}`}>
          <div className="table adaptive-table" style={{ '--table-columns': 5 }}>
            <div className="table-head">
              {['Date', 'Time', 'Type', 'Mobile', 'Status'].map((h) => <div key={h}>{h}</div>)}
              <div />
            </div>
            {allAppointments.length ? allAppointments.map((row, i) => (
              <div className="data-row" key={i}>
                <div>{row[2]}</div>
                <div>{row[3]}</div>
                <div>{row[4]}</div>
                <div>{row[1]}</div>
                <div>{row[5]}</div>
                <div />
              </div>
            )) : (
              <div className="empty-state compact-empty table-empty">
                <strong>No appointments yet.</strong>
                <p>Use Actions, then Book appointment, to schedule one.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'payments' && (
        <Card title="Payments" subtitle={`Payments linked to ${clientName}`}>
          <div className="table adaptive-table" style={{ '--table-columns': 4 }}>
            <div className="table-head">
              {['Invoice', 'Amount', 'Status', 'Paid On'].map((h) => <div key={h}>{h}</div>)}
              <div />
            </div>
            {allPayments.length ? allPayments.map((row, i) => (
              <div className="data-row" key={i}>
                <div>{row.invoice}</div>
                <div>{row.amount}</div>
                <div>{row.status}</div>
                <div>{row.paidOn}</div>
                <div />
              </div>
            )) : (
              <div className="empty-state compact-empty table-empty">
                <strong>No payments yet.</strong>
                <p>Use Actions, then Add payment, to record one.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {treatModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setTreatModal(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label="Add Treatment Plan" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><h2>Add Treatment Plan</h2><p>For {clientName}</p></div>
              <button className="icon-btn" type="button" onClick={() => setTreatModal(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-body detail-grid">
              {treatTemplates.length > 0 && (
                <label className="field-block" style={{ gridColumn: '1 / -1' }}>
                  <span>Use Template</span>
                  <select className="lead-input" defaultValue="" onChange={(e) => {
                    const t = treatTemplates[Number(e.target.value)];
                    if (t) setTreatForm((f) => ({ ...f, service: t.service, goal: t.goal, duration: t.duration, medicine: t.medicine, dose: t.dose, timing: t.timing }));
                  }}>
                    <option value="">Select template to auto-fill...</option>
                    {treatTemplates.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
                  </select>
                </label>
              )}
              <label className="field-block">
                <span>Service</span>
                <select className="lead-input" value={treatForm.service} onChange={(e) => setTreatForm((f) => ({ ...f, service: e.target.value }))}>
                  {treatServiceOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field-block">
                <span>Goal</span>
                <input className="lead-input" value={treatForm.goal} onChange={(e) => setTreatForm((f) => ({ ...f, goal: e.target.value }))} placeholder="Treatment goal" />
              </label>
              <label className="field-block">
                <span>Duration</span>
                <input className="lead-input" value={treatForm.duration} onChange={(e) => setTreatForm((f) => ({ ...f, duration: e.target.value }))} placeholder="30 days" />
              </label>
              <label className="field-block">
                <span>Medicine</span>
                <input className="lead-input" value={treatForm.medicine} onChange={(e) => setTreatForm((f) => ({ ...f, medicine: e.target.value }))} placeholder="Medicine name" />
              </label>
              <label className="field-block">
                <span>Dose</span>
                <input className="lead-input" value={treatForm.dose} onChange={(e) => setTreatForm((f) => ({ ...f, dose: e.target.value }))} placeholder="e.g. 10ml twice" />
              </label>
              <label className="field-block">
                <span>Timing</span>
                <input className="lead-input" value={treatForm.timing} onChange={(e) => setTreatForm((f) => ({ ...f, timing: e.target.value }))} placeholder="e.g. After meals" />
              </label>
              <label className="field-block">
                <span>Status</span>
                <select className="lead-input" value={treatForm.status} onChange={(e) => setTreatForm((f) => ({ ...f, status: e.target.value }))}>
                  <option>Active</option><option>Pending</option><option>Paused</option><option>Completed</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setTreatModal(false)}>Cancel</button>
              <button className="pill" type="button" onClick={saveTreatment}>Save <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      )}

      {apptModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setApptModal(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label="Book Appointment" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><h2>Book Appointment</h2><p>For {clientName}</p></div>
              <button className="icon-btn" type="button" onClick={() => setApptModal(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-body detail-grid">
              <label className="field-block">
                <span>Mobile</span>
                <input className="lead-input" type="text" value={apptForm.mobile} onChange={(e) => setApptForm((f) => ({ ...f, mobile: e.target.value }))} placeholder="Mobile number" />
              </label>
              <label className="field-block">
                <span>Date</span>
                <input className="lead-input" type="date" value={apptForm.date} onChange={(e) => setApptForm((f) => ({ ...f, date: e.target.value }))} />
              </label>
              <label className="field-block">
                <span>Time</span>
                <input className="lead-input" type="time" value={apptForm.time} onChange={(e) => setApptForm((f) => ({ ...f, time: e.target.value }))} />
              </label>
              <label className="field-block">
                <span>Type</span>
                <select className="lead-input" value={apptForm.type} onChange={(e) => setApptForm((f) => ({ ...f, type: e.target.value }))}>
                  {services.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field-block">
                <span>Status</span>
                <select className="lead-input" value={apptForm.status} onChange={(e) => setApptForm((f) => ({ ...f, status: e.target.value }))}>
                  <option>Confirmed</option><option>Pending</option><option>Cancelled</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setApptModal(false)}>Cancel</button>
              <button className="pill" type="button" onClick={saveAppointment}>Save <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      )}

      {payModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setPayModal(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label="Add Payment" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><h2>Add Payment</h2><p>For {clientName}</p></div>
              <button className="icon-btn" type="button" onClick={() => setPayModal(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-body detail-grid">
              <label className="field-block">
                <span>Invoice</span>
                <input className="lead-input" value={payForm.invoice} onChange={(e) => setPayForm((f) => ({ ...f, invoice: e.target.value }))} placeholder="INV-001" />
              </label>
              <label className="field-block">
                <span>Amount</span>
                <input className="lead-input" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} placeholder="₹1500" />
              </label>
              <label className="field-block">
                <span>Status</span>
                <select className="lead-input" value={payForm.status} onChange={(e) => setPayForm((f) => ({ ...f, status: e.target.value }))}>
                  <option>Paid</option><option>Pending</option><option>Partial</option>
                </select>
              </label>
              <label className="field-block">
                <span>Paid On</span>
                <input className="lead-input" type="date" value={payForm.paidOn} onChange={(e) => setPayForm((f) => ({ ...f, paidOn: e.target.value }))} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setPayModal(false)}>Cancel</button>
              <button className="pill" type="button" onClick={savePayment}>Save <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function ClientsPage() {
  const [selectedClient, setSelectedClient] = useState(null);

  if (selectedClient) {
    return <ClientProfile client={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  return (
    <ImportExportModule
      title="Clients"
      description="View active client profiles, treatment progress, and upcoming visit timelines."
      stats={[
        { label: 'Active Clients', value: '0' },
        { label: 'Treatment Plans', value: '0' },
        { label: 'Next Visits', value: '0' },
      ]}
      headers={['Client', 'Age', 'Address', 'Program', 'Next Visit', 'Birthday', 'Anniversary']}
      seedRows={clients}
      filenameBase="ayurflow-clients"
      fieldOptions={{ Program: getSavedPackageNames() }}
      fieldTypes={{ Age: 'number', 'Next Visit': 'date', Birthday: 'date', Anniversary: 'date' }}
      filterPresets={[
        { label: 'Name wise', column: 'Client' },
        { label: 'Age wise', column: 'Age' },
        { label: 'Program wise', column: 'Program' },
        { label: 'Address wise', column: 'Address' },
        { label: 'Next visit wise', column: 'Next Visit' },
        { label: 'Birthday wise', column: 'Birthday' },
      ]}
      rowToValues={(row) => ({
        Client: row.name,
        Age: row.age,
        Address: row.address,
        Program: row.program,
        'Next Visit': row.nextVisit,
        Birthday: row.birthday,
        Anniversary: row.anniversary,
      })}
      parseRow={(entry) => ({
        name: entry.Client ?? entry.client ?? entry.name ?? '',
        age: entry.Age ?? entry.age ?? '',
        address: entry.Address ?? entry.address ?? '',
        program: entry.Program ?? entry.program ?? '',
        nextVisit: entry['Next Visit'] ?? entry.nextVisit ?? '',
        birthday: entry.Birthday ?? entry.birthday ?? '',
        anniversary: entry.Anniversary ?? entry.anniversary ?? '',
      })}
      rowActions={(row) => (
        <button className="row-link" type="button" onClick={() => setSelectedClient(row)}>View Profile</button>
      )}
    />
  );
}

export function PaymentsPage() {
  const { branchKey } = useBranch();
  const [clientNames] = useState(() =>
    loadSavedArray(branchKey('ayurflow-clients:rows:v3'), loadSavedArray('ayurflow:ayurflow-clients:rows:v3', clients)).map((row) => Array.isArray(row) ? row[0] : row.name ?? row.Client ?? '').filter(Boolean)
  );
  return (
    <ImportExportModule
      title="Payments"
      description="Monitor invoices, partial collections, pending dues, and total cash flow in one place."
      stats={[
        { label: 'Collected Today', value: '0' },
        { label: 'Pending', value: '0' },
        { label: 'Invoices', value: '0' },
      ]}
      headers={['Client', 'Invoice', 'Amount', 'Status', 'Paid On']}
      seedRows={payments}
      filenameBase="ayurflow-payments"
      fieldOptions={{ Client: clientNames }}
      rowToValues={(row) => ({
        Client: row.client,
        Invoice: row.invoice,
        Amount: row.amount,
        Status: row.status,
        'Paid On': row.paidOn,
      })}
      parseRow={(entry) => ({
        client: entry.Client ?? entry.client ?? '',
        invoice: entry.Invoice ?? entry.invoice ?? '',
        amount: entry.Amount ?? entry.amount ?? '',
        status: entry.Status ?? entry.status ?? '',
        paidOn: entry['Paid On'] ?? entry.paidOn ?? '',
      })}
    />
  );
}

export function UsersPage() {
  const { branchKey, currentBranch } = useBranch();
  const [people, setPeople] = useState(() => loadSavedArray(branchKey('users:rows:v3'), users));
  const [uploadName, setUploadName] = useState('No file selected');
  const [importPreview, setImportPreview] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Ready to import or export users.');
  const [dropActive, setDropActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('team');

  useEffect(() => {
    try {
      window.localStorage.setItem(branchKey('users:rows:v3'), JSON.stringify(people));
    } catch {
      setStatusMessage('Local browser storage is full or blocked.');
    }
  }, [branchKey, people]);

  const exportCsv = () => {
    downloadText('ayurflow-users.csv', rowsToCsv(['Name', 'Role', 'Email', 'Status'], people.map((user) => [user.name, user.role, user.email, user.status])), 'text/csv;charset=utf-8');
    setStatusMessage('Export started for CSV download.');
  };

  const exportJson = () => {
    downloadText('ayurflow-users.json', JSON.stringify(people, null, 2), 'application/json;charset=utf-8');
    setStatusMessage('Export started for JSON download.');
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploadName(file.name);
    const text = await file.text();
    let parsed = [];
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        parsed = JSON.parse(text);
      } else {
        parsed = parseCsv(text);
      }
    } catch {
      setImportPreview([]);
      setStatusMessage('Import failed. Please upload a valid CSV or JSON file.');
      return;
    }
    const normalized = asImportRows(parsed).map((entry) => ({
      name: entry.name ?? entry.Name ?? '',
      role: entry.role ?? entry.Role ?? '',
      email: entry.email ?? entry.Email ?? '',
      status: entry.status ?? entry.Status ?? 'Pending',
    })).filter((entry) => entry.name);
    setImportPreview(normalized);
    setStatusMessage(`${normalized.length} users ready to import.`);
    setModalOpen(true);
  };

  const importUsers = () => {
    if (!importPreview.length) {
      setStatusMessage('No imported records found.');
      return;
    }
    setPeople((current) => [...importPreview, ...current]);
    setImportPreview([]);
    setUploadName('No file selected');
    setStatusMessage(`${importPreview.length} users imported successfully.`);
    setModalOpen(false);
  };

  const toggleUserStatus = (email) => {
    setPeople((current) => current.map((user) => (
      user.email === email ? { ...user, status: user.status === 'Active' ? 'Pending' : 'Active' } : user
    )));
    setStatusMessage('User status updated.');
  };

  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <h1>Users</h1>
          <p>Bulk upload staff members, export the team list, and import user data from CSV or JSON.</p>
          <p className="subtle">Current branch: {currentBranch}</p>
        </div>
        <div className="module-stats">
          <div className="mini-stat">
            <span>Total users</span>
            <strong>{people.length}</strong>
          </div>
          <div className="mini-stat">
            <span>Import status</span>
            <strong>{statusMessage}</strong>
          </div>
          <div className="mini-stat">
            <span>Upload</span>
            <strong>{uploadName}</strong>
          </div>
        </div>
      </div>

      <div className="sheet-tabs">
        <button className={`sheet-tab ${activeTab === 'team' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('team')}>Current Team</button>
        <button className={`sheet-tab ${activeTab === 'import' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('import')}>Import Users</button>
      </div>

      {activeTab === 'import' ? (
        <Card title="Bulk Upload Users" subtitle="Choose a .csv or .json file with Name, Role, Email, Status columns.">
          <div className="upload-box">
            <label
              className={`upload-dropzone ${dropActive ? 'active' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDropActive(true); }}
              onDragLeave={() => setDropActive(false)}
              onDrop={async (event) => {
                event.preventDefault();
                setDropActive(false);
                await handleFile(event.dataTransfer.files?.[0]);
              }}
            >
              <input type="file" accept=".csv,.json" onChange={async (event) => handleFile(event.target.files?.[0])} />
              <strong>Drop file here or click to browse</strong>
              <span>Supports CSV and JSON imports from spreadsheets or other tools.</span>
            </label>

            <div className="sheet-actions">
              <button className="pill" type="button" onClick={() => {
                if (!importPreview.length) {
                  setStatusMessage('Upload a users file first to open preview.');
                  return;
                }
                setModalOpen(true);
              }}>Open Preview <ChevronRight /></button>
              <button className="pill" type="button" onClick={() => { setImportPreview([]); setStatusMessage('Preview cleared.'); }}>Clear Preview <ChevronRight /></button>
            </div>

            <div className="mini-stat">
              <span>Status</span>
              <strong>{statusMessage}</strong>
            </div>
            <div className="mini-stat">
              <span>Upload</span>
              <strong>{uploadName}</strong>
            </div>
          </div>
        </Card>
      ) : (
        <Card
          title="Current Team"
          subtitle={statusMessage}
          action={<ActionMenu label="Export" items={[
            { label: 'Export CSV', description: 'Spreadsheet-compatible team list', onClick: exportCsv },
            { label: 'Export JSON', description: 'Structured team backup', onClick: exportJson },
          ]} />}
        >
          <div className="table adaptive-table" style={{ '--table-columns': 4 }}>
            <div className="table-head">
              <div>Name</div>
              <div>Role</div>
              <div>Email</div>
              <div>Status</div>
              <div />
            </div>
            {people.length ? (
              people.map((user) => (
                <div className="data-row" key={user.email}>
                  <div>{user.name}</div>
                  <div>{user.role}</div>
                  <div>{user.email}</div>
                  <div><Tag tone={user.status === 'Active' ? 'tag-contacted' : 'tag-follow'}>{user.status}</Tag></div>
                  <div><button className="row-link" type="button" onClick={() => toggleUserStatus(user.email)}>Toggle</button></div>
                </div>
              ))
            ) : (
              <div className="empty-state compact-empty table-empty">
                <strong>No team members yet.</strong>
                <p>Import a users file to create the roster.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Import preview modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Import Preview</h2>
                <p>{importPreview.length} record(s) detected from {uploadName}.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setModalOpen(false)} aria-label="Close modal">✕</button>
            </div>
            <div className="modal-body">
              <div className="mini-stat">
                <span>Source file</span>
                <strong>{uploadName}</strong>
              </div>
              <div className="mini-stat">
                <span>Ready to import</span>
                <strong>{importPreview.length}</strong>
              </div>
            </div>
            <div className="modal-table adaptive-table" style={{ '--table-columns': 4 }}>
              <div className="table-head">
                <div>Name</div>
                <div>Role</div>
                <div>Email</div>
                <div>Status</div>
                <div />
              </div>
              {importPreview.length ? (
                importPreview.map((item) => (
                  <div className="data-row" key={`${item.email}-${item.name}`}>
                    <div>{item.name}</div>
                    <div>{item.role}</div>
                    <div>{item.email}</div>
                    <div><Tag tone={item.status === 'Active' ? 'tag-contacted' : 'tag-follow'}>{item.status}</Tag></div>
                    <div><Tag tone="tag-follow">Preview</Tag></div>
                  </div>
                ))
              ) : (
                <div className="empty-state compact-empty table-empty">
                  <strong>No preview loaded.</strong>
                  <p>Drop a CSV or JSON file to see rows here.</p>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setModalOpen(false)}>Cancel <ChevronRight /></button>
              <button className="pill" type="button" onClick={importUsers}>Import Now <ChevronRight /></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ModuleHubPage({ title, description, tabs, defaultTab }) {
  const { branchKey } = useBranch();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const queryAction = searchParams.get('action');
  const firstTab = tabs.some((tab) => tab.id === queryTab) ? queryTab : defaultTab;
  const [activeTab, setActiveTab] = useState(firstTab);
  const [message, setMessage] = useState('Ready.');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [uploadName, setUploadName] = useState('No file selected');
  const [draftRow, setDraftRow] = useState(tabs[0]?.columns?.map(() => '') ?? []);
  const [editRow, setEditRow] = useState([]);
  const fixedMedicineStorageKey = branchKey(`${title}:treatment-medicines:v2`);
  const legacyMedicineStorageKey = `ayurflow:${title}:treatment-medicines:v2`;
  const [fixedMedicineByService, setFixedMedicineByService] = useState(() => loadSavedObject(fixedMedicineStorageKey, loadSavedObject(legacyMedicineStorageKey, {})));
  const [rxDraft, setRxDraft] = useState([{ medicine: '', dose: '', timing: 'Morning', schedule: 'Daily' }]);
  const storageKey = branchKey(`${title}:tabs:v3`);
  const legacyStorageKey = `ayurflow:${title}:tabs:v3`;
  const [rowsByTab, setRowsByTab] = useState(() => loadSavedObject(storageKey, loadSavedObject(legacyStorageKey, Object.fromEntries(tabs.map((tab) => [tab.id, tab.rows])))));
  const importInputRef = useRef(null);
  const handledHubAddAction = useRef('');

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const rawActiveRows = Array.isArray(rowsByTab[active.id]) ? rowsByTab[active.id] : active.rows;
  const activeRows = rawActiveRows.map((row) => active.columns.map((column, index) => (
    Array.isArray(row) ? (row[index] ?? '') : (row?.[column] ?? row?.[column.toLowerCase()] ?? '')
  )));
  const medicineOptions = (Array.isArray(rowsByTab.medicines) ? rowsByTab.medicines : [])
    .map((row) => (Array.isArray(row) ? row[0] : row?.Medicine ?? row?.medicine ?? ''))
    .filter(Boolean);
  const medicineCatalog = (Array.isArray(rowsByTab.medicines) ? rowsByTab.medicines : []).map((row) => (
    Array.isArray(row)
      ? { Medicine: row[0] ?? '', Category: row[1] ?? '', 'Default Dose': row[2] ?? '', Timing: row[3] ?? '', Status: row[4] ?? '' }
      : row
  ));
  const serviceOptions = (Array.isArray(rowsByTab.services) ? rowsByTab.services : [])
    .map((row) => row[0])
    .filter(Boolean);
  const clientOptions = Array.from(new Set(loadSavedArray(
    branchKey('ayurflow-clients:rows:v3'),
    loadSavedArray('ayurflow:ayurflow-clients:rows:v3', clients),
  ).map((row) => (Array.isArray(row) ? row[0] : row?.name ?? row?.Client ?? row?.client ?? '')).filter(Boolean)));
  const treatmentServiceIndex = active.columns.indexOf('Service');
  const treatmentMedicineIndex = active.columns.indexOf('Medicine');

  const optionsForColumn = (column) => {
    if (active.id === 'treatments' && column === 'Medicine') return medicineOptions;
    if (active.id === 'treatments' && column === 'Service') return serviceOptions;
    if (active.fieldOptions?.[column]) return active.fieldOptions[column];
    return [];
  };

  const shouldUseSelect = (column) => active.id === 'treatments' && ['Service', 'Medicine'].includes(column);
  const isTreatmentClient = (column) => active.id === 'treatments' && column === 'Client';
  const isMedicineColumn = active.id === 'treatments' && active.columns[treatmentMedicineIndex] === 'Medicine';
  const selectedMedicines = (value) => String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const scheduleOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const frequencyOptions = ['Daily', 'Alternate Day', 'Weekly', 'SOS'];

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(rowsByTab));
    } catch {
      setMessage('Local browser storage is full or blocked.');
    }
  }, [rowsByTab, storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(fixedMedicineStorageKey, JSON.stringify(fixedMedicineByService));
    } catch {
      setMessage('Local browser storage is full or blocked.');
    }
  }, [fixedMedicineByService, fixedMedicineStorageKey]);

  const filteredRows = activeRows.filter((row) => {
    if (!filterText) return true;
    if (!activeFilter) return row.join(' ').toLowerCase().includes(filterText.toLowerCase());
    const index = active.columns.indexOf(activeFilter);
    if (index === -1) return row.join(' ').toLowerCase().includes(filterText.toLowerCase());
    return String(row[index] ?? '').toLowerCase().includes(filterText.toLowerCase());
  });

  const createDraftRow = () => active.columns.map(() => '');

  const getSuggestedMedicine = (service) => {
    const fromService = fixedMedicineByService[service];
    if (fromService && Array.isArray(fromService.medicines) && fromService.medicines.length) return fromService.medicines.join(', ');
    return '';
  };

  const getSuggestedTreatmentDefaults = (service) => {
    const fromService = fixedMedicineByService[service];
    return {
      medicine: Array.isArray(fromService?.medicines) ? fromService.medicines.join(', ') : '',
      dose: fromService?.dose ?? '',
      timing: fromService?.timing ?? '',
      schedule: fromService?.schedule ?? 'Daily',
    };
  };

  const getMedicineDefaults = (medicineName) => {
    const entry = medicineCatalog.find((item) => String(item?.Medicine ?? '').toLowerCase() === String(medicineName ?? '').toLowerCase());
    return {
      dose: entry?.['Default Dose'] ?? '',
      timing: entry?.Timing ?? '',
    };
  };

  const rxSummary = (items) => items
    .filter((item) => item.medicine.trim())
    .map((item) => `${item.medicine.trim()} | ${item.dose.trim() || '-'} | ${item.timing.trim() || '-'} | ${item.schedule.trim() || '-'}`)
    .join('; ');

  const parseRxSummary = (value) => String(value ?? '')
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [medicine = '', dose = '', timing = '', schedule = ''] = chunk.split('|').map((part) => part.trim());
      return { medicine, dose, timing, schedule };
    });

  const updateRxDraft = (index, field, value) => {
    setRxDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  };

  const updateRxTiming = (index, value) => {
    updateRxDraft(index, 'timing', value);
  };

  const updateRxMedicine = (index, value) => {
    setRxDraft((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const defaults = getMedicineDefaults(value);
      return {
        ...item,
        medicine: value,
        dose: item.dose || defaults.dose,
        timing: item.timing || defaults.timing,
      };
    }));
  };

  const addRxRow = () => {
    setRxDraft((current) => [...current, { medicine: '', dose: '', timing: 'Morning', schedule: 'Daily' }]);
  };

  const removeRxRow = (index) => {
    setRxDraft((current) => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current));
  };

  const applyPreset = (service) => {
    const preset = getSuggestedTreatmentDefaults(service);
    setRxDraft([{ medicine: preset.medicine, dose: preset.dose, timing: preset.timing, schedule: preset.schedule }]);
    if (treatmentServiceIndex !== -1) {
      setDraftRow((current) => current.map((cell, cellIndex) => (cellIndex === treatmentServiceIndex ? service : cell)));
    }
  };

  const handleServiceChange = (index, value, setter) => {
    setter((current) => {
      const next = current.map((cell, cellIndex) => (cellIndex === index ? value : cell));
      if (active.id === 'treatments' && active.columns[index] === 'Service' && treatmentMedicineIndex !== -1) {
        const suggestion = getSuggestedTreatmentDefaults(value);
        if (suggestion.medicine) next[treatmentMedicineIndex] = suggestion.medicine;
        if (active.columns.includes('Dose')) next[active.columns.indexOf('Dose')] = suggestion.dose;
        if (active.columns.includes('Timing')) next[active.columns.indexOf('Timing')] = suggestion.timing;
        setRxDraft([{ medicine: suggestion.medicine, dose: suggestion.dose, timing: suggestion.timing, schedule: suggestion.schedule }]);
      }
      return next;
    });
  };

  const openAddForActive = () => {
    const nextDraft = createDraftRow();
    const clientIndex = active.columns.indexOf('Client');
    if (clientIndex !== -1) nextDraft[clientIndex] = searchParams.get('client') ?? '';
    if (active.id === 'treatments' && treatmentServiceIndex !== -1 && treatmentMedicineIndex !== -1) {
      const service = String(nextDraft[treatmentServiceIndex] ?? '');
      const defaults = getSuggestedTreatmentDefaults(service);
      nextDraft[treatmentMedicineIndex] = defaults.medicine;
      const doseIndex = active.columns.indexOf('Dose');
      const timingIndex = active.columns.indexOf('Timing');
      if (doseIndex !== -1) nextDraft[doseIndex] = defaults.dose;
      if (timingIndex !== -1) nextDraft[timingIndex] = defaults.timing;
      setRxDraft([{ medicine: defaults.medicine, dose: defaults.dose, timing: defaults.timing, schedule: defaults.schedule }]);
    }
    setDraftRow(nextDraft);
    setAddOpen(true);
    setMessage(`New ${active.singular ?? active.label} form opened.`);
  };

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
    setFilterText('');
    setMessage(`${tabs.find((tab) => tab.id === tabId)?.label ?? title} opened.`);
  };

  const runAction = (action) => {
    if (action === 'Add') {
      openAddForActive();
      return;
    }
    if (action === 'Import') {
      importInputRef.current?.click();
      setMessage(`${active.label} import tools opened.`);
      return;
    }
    if (action === 'Export') {
      downloadText(`${active.label.toLowerCase()}-export.csv`, rowsToCsv(active.columns, activeRows), 'text/csv;charset=utf-8');
      setMessage(`${active.label} export started.`);
      return;
    }
    if (action === 'Filter') {
      setFilterOpen((current) => !current);
      setMessage('Filter toggled.');
      return;
    }
    if (action === 'Share') {
      navigator.clipboard?.writeText(`${title} / ${active.label} / ${activeRows.length} records`).catch(() => {});
      setMessage(`${active.label} share link copied.`);
    }
  };
  const hubActions = [
    { label: `Add ${active.singular ?? active.label}`, description: `Create a new ${active.label.toLowerCase()} record`, onClick: () => runAction('Add') },
    { label: 'Import CSV/JSON', description: 'Upload records in bulk', onClick: () => runAction('Import') },
    { label: 'Export CSV', description: 'Download current records', onClick: () => runAction('Export') },
    { label: filterOpen ? 'Hide filters' : 'Show filters', description: 'Search and narrow this section', onClick: () => runAction('Filter') },
    { label: 'Share summary', description: 'Copy the current record count', onClick: () => runAction('Share') },
  ];

  useEffect(() => {
    const nextTab = tabs.some((tab) => tab.id === queryTab) ? queryTab : defaultTab;
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
      setFilterText('');
      setActiveFilter('');
      setMessage(`${tabs.find((tab) => tab.id === nextTab)?.label ?? title} opened.`);
      return;
    }
    if (queryAction !== 'add') return;
    const actionToken = searchParams.toString();
    if (handledHubAddAction.current === actionToken) return;
    handledHubAddAction.current = actionToken;
    openAddForActive();
  }, [queryTab, queryAction, activeTab, active.id, activeRows.length, searchParams, setSearchParams]);

  const saveDraft = () => {
    if (!draftRow.some((cell) => String(cell ?? '').trim())) {
      setMessage('Please fill at least one field before saving.');
      return;
    }
    if (active.id === 'treatments' && treatmentServiceIndex !== -1 && treatmentMedicineIndex !== -1) {
      const service = String(draftRow[treatmentServiceIndex] ?? '').trim();
      const medicines = rxDraft.filter((item) => item.medicine.trim());
      const first = medicines[0];
      const nextRow = service && medicines.length
        ? [draftRow[0], draftRow[1], rxSummary(medicines), first.dose, first.timing, draftRow[5], draftRow[6], draftRow[7]]
        : draftRow;
      setRowsByTab((current) => ({
        ...current,
        [active.id]: [nextRow, ...(current[active.id] ?? activeRows)],
      }));
      if (service && medicines.length) {
        setFixedMedicineByService((current) => ({ ...current, [service]: { medicines: medicines.map((item) => item.medicine), dose: first.dose, timing: first.timing, schedule: first.schedule } }));
      }
      setRxDraft([{ medicine: '', dose: '', timing: 'Morning', schedule: 'Daily' }]);
    } else {
      setRowsByTab((current) => ({
        ...current,
        [active.id]: [draftRow, ...(current[active.id] ?? activeRows)],
      }));
    }
    setMessage(`${draftRow[0] || active.label} added.`);
    setAddOpen(false);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    if (active.id === 'treatments' && treatmentServiceIndex !== -1 && treatmentMedicineIndex !== -1) {
      const service = String(editRow[treatmentServiceIndex] ?? '').trim();
      const medicines = rxDraft.filter((item) => item.medicine.trim());
      if (service && medicines.length) {
        const first = medicines[0];
        const nextRow = [
          editRow[0],
          editRow[1],
          rxSummary(medicines),
          first.dose,
          first.timing,
          editRow[5],
          editRow[6],
          editRow[7],
        ];
        setRowsByTab((current) => {
          const next = [...(current[active.id] ?? activeRows)];
          next[editIndex] = nextRow;
          return { ...current, [active.id]: next };
        });
        setFixedMedicineByService((current) => ({ ...current, [service]: { medicines: medicines.map((item) => item.medicine), dose: first.dose, timing: first.timing, schedule: first.schedule } }));
      } else {
        setRowsByTab((current) => {
          const next = [...(current[active.id] ?? activeRows)];
          next[editIndex] = editRow;
          return { ...current, [active.id]: next };
        });
      }
      setRxDraft([{ medicine: '', dose: '', timing: 'Morning', schedule: 'Daily' }]);
    } else {
      setRowsByTab((current) => {
        const next = [...(current[active.id] ?? activeRows)];
        next[editIndex] = editRow;
        return { ...current, [active.id]: next };
      });
    }
    setMessage(`${editRow[0] || active.label} updated.`);
    setEditOpen(false);
    setEditIndex(null);
  };

  const openEdit = (row) => {
    const sourceIndex = activeRows.findIndex((candidate) => candidate === row);
    if (sourceIndex === -1) {
      setMessage('Could not find this row after filtering. Clear filter and try again.');
      return;
    }
    setEditIndex(sourceIndex);
    const nextRow = [...row];
    if (active.id === 'treatments' && treatmentServiceIndex !== -1 && treatmentMedicineIndex !== -1) {
      const service = String(nextRow[treatmentServiceIndex] ?? '').trim();
      const parsed = parseRxSummary(nextRow[treatmentMedicineIndex]);
      if (!nextRow[treatmentMedicineIndex]) {
        const defaults = getSuggestedTreatmentDefaults(service);
        nextRow[treatmentMedicineIndex] = defaults.medicine;
        const doseIndex = active.columns.indexOf('Dose');
        const timingIndex = active.columns.indexOf('Timing');
        if (doseIndex !== -1 && !nextRow[doseIndex]) nextRow[doseIndex] = defaults.dose;
        if (timingIndex !== -1 && !nextRow[timingIndex]) nextRow[timingIndex] = defaults.timing;
      }
      setRxDraft(parsed.length ? parsed : [{
        medicine: nextRow[treatmentMedicineIndex] || '',
        dose: nextRow[active.columns.indexOf('Dose')] || '',
        timing: nextRow[active.columns.indexOf('Timing')] || '',
        schedule: getSuggestedTreatmentDefaults(service).schedule,
      }]);
    }
    setEditRow(nextRow);
    setEditOpen(true);
    setMessage(`${row[0]} edit opened.`);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploadName(file.name);
    const text = await file.text();
    let parsed = [];
    try {
      parsed = file.name.toLowerCase().endsWith('.json') ? JSON.parse(text) : parseCsv(text);
    } catch {
      setMessage('Import failed.');
      return;
    }
    const normalized = asImportRows(parsed)
      .map((row) => (Array.isArray(row) ? row : active.columns.map((column) => row[column] ?? row[column.toLowerCase()] ?? '')))
      .map((row) => active.columns.map((_, index) => row[index] ?? ''))
      .filter((row) => row.some(Boolean));
    setPreviewRows(normalized);
    setImportOpen(true);
    setMessage(`${normalized.length} record(s) ready to import.`);
  };

  const commitImport = () => {
    if (!previewRows.length) return;
    setRowsByTab((current) => ({
      ...current,
      [active.id]: [...previewRows, ...(current[active.id] ?? activeRows)],
    }));
    setPreviewRows([]);
    setImportOpen(false);
    setMessage(`${previewRows.length} record(s) imported.`);
  };

  return (
    <section className="module-page compact-page">
      <div className="module-hero compact-hero">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="module-stats">
          <div className="mini-stat"><span>Section</span><strong>{active.label}</strong></div>
          <div className="mini-stat"><span>Records</span><strong>{filteredRows.length}</strong></div>
          <div className="mini-stat"><span>Status</span><strong>{message}</strong></div>
        </div>
      </div>

      <Card title={`${title} Menu`} subtitle={message} action={<div className="card-action-group"><button className="pill primary-action" type="button" onClick={openAddForActive}>+ Add {active.singular ?? active.label}</button><ActionMenu label="Actions" items={hubActions} /></div>}>
        <input ref={importInputRef} className="hidden-file-input" type="file" accept=".csv,.json" onChange={async (event) => handleFile(event.target.files?.[0])} />
        <div className="sheet-tabs compact-tabs">
          {tabs.map((tab) => (
            <button className={`sheet-tab ${active.id === tab.id ? 'active' : ''}`} type="button" key={tab.id} onClick={() => selectTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        {filterOpen && (
          <div className="filter-panel">
            <div className="filter-pills">
              {active.columns.map((column) => (
                <button
                  className={`sheet-tab filter-pill ${activeFilter === column ? 'active' : ''}`}
                  type="button"
                  key={column}
                  onClick={() => {
                    setActiveFilter(column);
                    setFilterText('');
                  }}
                >
                  {column}
                </button>
              ))}
            </div>
            <input className="lead-input compact-filter" value={filterText} onChange={(event) => setFilterText(event.target.value)} placeholder={`Search ${active.label.toLowerCase()}...`} />
          </div>
        )}
      </Card>

      {active.id === 'treatments' && (
        <Card title="Saved Treatment Presets" subtitle="Tap a service to reuse its saved medicine, dose, and timing defaults.">
          <div className="filter-pills">
            {Object.keys(fixedMedicineByService).length ? Object.keys(fixedMedicineByService).map((service) => (
              <button key={service} type="button" className="sheet-tab filter-pill" onClick={() => applyPreset(service)}>
                {service}
              </button>
            )) : (
              <div className="empty-state compact-empty">
                <strong>No presets yet.</strong>
                <p>Save one treatment and its service preset will show up here automatically.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title={active.title ?? active.label} subtitle={active.description}>
        <div className="data-table adaptive-table" style={{ '--table-columns': active.columns.length }}>
          <div className="table-head">
            {active.columns.map((column) => <div key={column}>{column}</div>)}
            <div />
          </div>
          {filteredRows.length ? (
            filteredRows.map((row, index) => (
              <div className="data-row" key={`${active.id}-${index}`}>
                {row.map((cell, cellIndex) => <div key={`${active.columns[cellIndex]}-${index}`}>{cell}</div>)}
                <div><button className="row-link" type="button" onClick={() => openEdit(row)}>Open</button></div>
              </div>
            ))
          ) : (
            <div className="empty-state compact-empty table-empty">
              <strong>No records yet.</strong>
              <p>Add or import the first row to unlock this section.</p>
              <button className="pill primary-action" type="button" onClick={openAddForActive}>+ Add {active.singular ?? active.label}</button>
            </div>
          )}
        </div>
      </Card>

      {active.id === 'treatments' && (
        <Card title="Printable Summary" subtitle="Copy or print the current treatment prescription in a clean format." action={<ActionMenu label="Actions" items={[
          { label: 'Print summary', onClick: () => window.print() },
          {
            label: 'Copy prescription text',
            disabled: !rxSummary(rxDraft),
            onClick: () => {
              const copyRequest = navigator.clipboard?.writeText(rxSummary(rxDraft));
              if (!copyRequest) {
                setMessage('Clipboard access is unavailable.');
                return;
              }
              copyRequest
                .then(() => setMessage('Prescription text copied.'))
                .catch(() => setMessage('Clipboard permission was blocked.'));
            },
          },
        ]} />}>
          <div className="empty-state compact-empty" style={{ marginTop: '1rem' }}>
            <strong>{rxSummary(rxDraft) || 'No prescription rows yet.'}</strong>
            <p>Use the builder above to create a printable treatment summary.</p>
          </div>
        </Card>
      )}

      {addOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAddOpen(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label={`Add ${active.label}`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Add {active.label}</h2>
                <p>Fill the fields and save the new record.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setAddOpen(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-body detail-grid">
              {active.columns.map((column, index) => (
                <label className="field-block" key={column}>
                  <span>{column}</span>
                  {isTreatmentClient(column) ? (
                    <>
                      <input
                        className="lead-input"
                        value={draftRow[index] ?? ''}
                        onChange={(event) => setDraftRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? event.target.value : cell)))}
                        placeholder={clientOptions.length ? 'Search or select client' : 'Add a client first'}
                        list="treatment-client-options-add"
                        autoComplete="off"
                      />
                      <datalist id="treatment-client-options-add">
                        {clientOptions.map((client) => <option value={client} key={client} />)}
                      </datalist>
                    </>
                  ) : shouldUseSelect(column) || optionsForColumn(column).length ? (
                    <select
                      className="lead-input"
                      multiple={isMedicineColumn}
                      value={isMedicineColumn ? selectedMedicines(draftRow[index]) : (draftRow[index] ?? '')}
                      onChange={(event) => {
                        const value = isMedicineColumn
                          ? Array.from(event.target.selectedOptions).map((option) => option.value).join(', ')
                          : event.target.value;
                        if (column === 'Service') handleServiceChange(index, value, setDraftRow);
                        else setDraftRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? value : cell)));
                      }}
                    >
                      {!isMedicineColumn && <option value="">{optionsForColumn(column).length ? `Select ${column.toLowerCase()}` : `Add ${column.toLowerCase()} first`}</option>}
                      {optionsForColumn(column).map((option, optionIndex) => <option value={option} key={`${option}-${optionIndex}`}>{option}</option>)}
                    </select>
                  ) : (
                    <input
                      className="lead-input"
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

      {editOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditOpen(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label={`Edit ${active.label}`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Edit {active.label}</h2>
                <p>Update the selected record and save changes.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setEditOpen(false)} aria-label="Close modal">x</button>
            </div>
            {active.id === 'treatments' && (
              <div className="modal-body" style={{ paddingTop: 0 }}>
                <div className="mini-stat">
                  <span>Tip</span>
                  <strong>Select a service first. Medicine rows, dose, timing, and schedule can all be reused from presets.</strong>
                </div>
              </div>
            )}
            {active.id === 'treatments' && (
              <div className="modal-body">
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-header">
                    <div>
                      <h2>Prescription Builder</h2>
                      <p className="subtle">Add one or more medicines for this treatment.</p>
                    </div>
                    <button className="pill" type="button" onClick={addRxRow}>Add Medicine Row <ChevronRight /></button>
                  </div>
                  <div className="stack">
                    {rxDraft.map((item, index) => (
                      <div className="card" key={`rx-${index}`} style={{ padding: '0.9rem', background: 'rgba(255,255,255,0.55)' }}>
                        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
                          <div>
                            <h2>Medicine {index + 1}</h2>
                            <p className="subtle">Prescription row {index + 1}</p>
                          </div>
                          <button className="row-link danger" type="button" onClick={() => removeRxRow(index)}>Remove</button>
                        </div>
                        <div className="rx-grid">
                          <select className="lead-input" value={item.medicine} onChange={(event) => updateRxMedicine(index, event.target.value)}>
                            <option value="">Select medicine</option>
                            {medicineOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                          <input className="lead-input" value={item.dose} onChange={(event) => updateRxDraft(index, 'dose', event.target.value)} placeholder="Dose" />
                          <div className="stack" style={{ gap: '0.5rem' }}>
                            <input className="lead-input" value={item.timing} onChange={(event) => updateRxTiming(index, event.target.value)} placeholder="Timing" list={`timing-${index}`} />
                            <datalist id={`timing-${index}`}>
                              {scheduleOptions.map((option) => <option value={option} key={option} />)}
                            </datalist>
                            <div className="filter-pills">
                              {scheduleOptions.map((option) => (
                                <button type="button" key={option} className={`sheet-tab filter-pill ${item.timing === option ? 'active' : ''}`} onClick={() => updateRxTiming(index, option)}>
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>
                          <select className="lead-input" value={item.schedule} onChange={(event) => updateRxDraft(index, 'schedule', event.target.value)}>
                            {frequencyOptions.map((option) => <option value={option} key={option}>{option}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="modal-body detail-grid">
              {active.columns.map((column, index) => (
                <label className="field-block" key={column}>
                  <span>{column}</span>
                  {isTreatmentClient(column) ? (
                    <>
                      <input
                        className="lead-input"
                        value={editRow[index] ?? ''}
                        onChange={(event) => setEditRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? event.target.value : cell)))}
                        placeholder={clientOptions.length ? 'Search or select client' : 'Add a client first'}
                        list="treatment-client-options-edit"
                        autoComplete="off"
                      />
                      <datalist id="treatment-client-options-edit">
                        {clientOptions.map((client) => <option value={client} key={client} />)}
                      </datalist>
                    </>
                  ) : shouldUseSelect(column) || optionsForColumn(column).length ? (
                    <select
                      className="lead-input"
                      multiple={isMedicineColumn}
                      value={isMedicineColumn ? selectedMedicines(editRow[index]) : (editRow[index] ?? '')}
                      onChange={(event) => {
                        const value = isMedicineColumn
                          ? Array.from(event.target.selectedOptions).map((option) => option.value).join(', ')
                          : event.target.value;
                        if (column === 'Service') handleServiceChange(index, value, setEditRow);
                        else setEditRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? value : cell)));
                      }}
                    >
                      {!isMedicineColumn && <option value="">{optionsForColumn(column).length ? `Select ${column.toLowerCase()}` : `Add ${column.toLowerCase()} first`}</option>}
                      {optionsForColumn(column).map((option, optionIndex) => <option value={option} key={`${option}-${optionIndex}`}>{option}</option>)}
                    </select>
                  ) : (
                    <input
                      className="lead-input"
                      value={editRow[index] ?? ''}
                      onChange={(event) => setEditRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? event.target.value : cell)))}
                      placeholder={`Enter ${column.toLowerCase()}`}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="pill" type="button" onClick={saveEdit}>Save Changes <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setImportOpen(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label={`Import ${active.label}`} onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Import {active.label}</h2>
                <p>{uploadName} - {previewRows.length} record(s) detected.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setImportOpen(false)} aria-label="Close modal">x</button>
            </div>
            <div className="modal-table adaptive-table" style={{ '--table-columns': active.columns.length }}>
              <div className="table-head">
                {active.columns.map((column) => <div key={column}>{column}</div>)}
                <div />
              </div>
              {previewRows.length ? (
                previewRows.map((row, index) => (
                  <div className="data-row" key={index}>
                    {row.map((cell, cellIndex) => <div key={`${active.columns[cellIndex]}-${index}`}>{cell}</div>)}
                    <div />
                  </div>
                ))
              ) : (
                <div className="empty-state compact-empty table-empty">
                  <strong>No preview loaded.</strong>
                  <p>Select a CSV or JSON file to inspect it before importing.</p>
                </div>
              )}
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

const operationsTabs = [
  {
    id: 'forms',
    label: 'Forms',
    singular: 'response',
    title: 'Google Form Responses',
    description: 'Only response entries from Google Forms are shown here. Import the responses and keep this as the live inbox.',
    columns: ['Name', 'Form', 'Submitted', 'Phone', 'Status'],
    rows: formResponses.map((response) => [response.name, response.form, response.submitted, response.phone, response.status]),
  },
  {
    id: 'treatments',
    label: 'Treatment',
    singular: 'plan',
    description: 'Client journeys, goals, services, medicine, dosage, timing, and therapy progress.',
    columns: ['Client', 'Service', 'Medicine', 'Dose', 'Timing', 'Goal', 'Duration', 'Status'],
    rows: treatmentPlans.map((plan) => [plan.client, plan.service, '', '', '', plan.goal, plan.duration, plan.status]),
  },
  {
    id: 'packages',
    label: 'Packages',
    singular: 'package',
    description: 'Clinic and coaching packages with session and price details.',
    columns: ['Package', 'Category', 'Duration', 'Sessions', 'Price'],
    rows: packages.map((item) => [item.name, item.category, item.duration, item.sessions, item.price]),
  },
  {
    id: 'coaching',
    label: 'Coaching',
    singular: 'student',
    description: 'Students, batches, assignments, tests, material, and certificates.',
    columns: ['Batch', 'Course', 'Trainer', 'Students', 'Status'],
    rows: coachingBatches.map((batch) => [batch.batch, batch.course, batch.trainer, batch.students, batch.status]),
  },
  {
    id: 'staff',
    label: 'Staff',
    singular: 'staff member',
    description: 'Team roles and operational permissions.',
    columns: ['Name', 'Role', 'Permissions', 'Status'],
    rows: staffRoles.map((member) => [member.name, member.role, member.permissions, member.status]),
  },
  {
    id: 'medicines',
    label: 'Medicines',
    singular: 'medicine',
    description: 'Manual medicine catalog used by treatment plans. Add medicine names here, then select them inside Treatment.',
    columns: ['Medicine', 'Category', 'Default Dose', 'Timing', 'Status'],
    rows: [],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    singular: 'item',
    description: 'Medicine, oils, products, course material, expiry, and stock alerts.',
    columns: ['Item', 'Category', 'Quantity', 'Expiry', 'Status'],
    rows: inventoryItems.map((item) => [item.item, item.category, item.quantity, item.expiry, item.status]),
  },
  {
    id: 'communication',
    label: 'Comms',
    singular: 'template',
    description: 'WhatsApp, SMS, and email templates with automation triggers.',
    columns: ['Template', 'Channel', 'Trigger', 'Status'],
    rows: communicationTemplates.map((template) => [template.template, template.channel, template.trigger, template.status]),
  },
  {
    id: 'portal',
    label: 'Portal',
    singular: 'portal feature',
    description: 'Client-side booking, forms, invoices, and progress uploads.',
    columns: ['Feature', 'Owner', 'Mode', 'Status'],
    rows: portalFeatures.map((item) => [item.feature, item.owner, item.mode, item.status]),
  },
  {
    id: 'integrations',
    label: 'Apps',
    singular: 'app',
    description: 'Google Sheets, WhatsApp Business, and webhook connections.',
    columns: ['App', 'Type', 'Status', 'Last Sync'],
    rows: integrations.map((item) => [item.name, item.type, item.status, item.lastSync]),
  },
  {
    id: 'services',
    label: 'Services',
    singular: 'service',
    description: 'Service catalog used by appointments and treatment workflows.',
    columns: ['Service', 'Category', 'Duration', 'Status'],
    rows: services.map((service) => [
      service,
      service === 'Consultation' || service === 'Follow-up' ? 'General' : 'Clinic',
      service === 'Panchakarma' ? '14 days' : '30 min',
      'Active',
    ]),
  },
];

const financeTabs = [
  {
    id: 'payments',
    label: 'Payments',
    singular: 'payment',
    description: 'Invoices, collections, pending dues, partial payments, and receipts.',
    columns: ['Client', 'Invoice', 'Amount', 'Status', 'Paid On'],
    rows: payments.map((payment) => [payment.client, payment.invoice, payment.amount, payment.status, payment.paidOn]),
  },
  {
    id: 'accounts',
    label: 'Accounts',
    singular: 'account entry',
    description: 'Income, expenses, payment modes, GST notes, refunds, and profit/loss review.',
    columns: ['Item', 'Type', 'Amount', 'Mode', 'Status'],
    rows: accounts.map((row) => [row.item, row.type, row.amount, row.mode, row.status]),
  },
];

const settingsTabs = [
  {
    id: 'clinic',
    label: 'Clinic',
    singular: 'setting',
    description: 'Clinic profile, branches, services, invoice, tax, notifications, and payment modes.',
    columns: ['Setting', 'Area', 'Value', 'Status'],
    rows: settingsItems.map((item) => [item.setting, item.area, item.value, item.status]),
  },
  {
    id: 'users',
    label: 'Users',
    singular: 'user',
    description: 'User roles, access levels, and staff account status.',
    columns: ['Name', 'Role', 'Email', 'Status'],
    rows: users.map((user) => [user.name, user.role, user.email, user.status]),
  },
  {
    id: 'integrations',
    label: 'Integrations',
    singular: 'integration',
    description: 'External app connections and automation setup.',
    columns: ['App', 'Type', 'Status', 'Last Sync'],
    rows: integrations.map((item) => [item.name, item.type, item.status, item.lastSync]),
  },
];

export function OperationsPage() {
  return (
    <ModuleHubPage
      title="Operations"
      description="Forms, treatment plans, packages, coaching, staff, inventory, communication, portal, and apps in one compact page."
      tabs={operationsTabs}
      defaultTab="forms"
    />
  );
}

export function FinancePage() {
  return (
    <ModuleHubPage
      title="Finance"
      description="Payments and account entries grouped into one compact finance workspace."
      tabs={financeTabs}
      defaultTab="payments"
    />
  );
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'checkbox', label: 'Yes / No' },
];

function makeUid() { return `id_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }
function makeBlankField() { return { id: makeUid(), type: 'text', label: '', placeholder: '', required: false, options: [] }; }

function LegacyFormsPage() {
  const [view, setView] = useState('list');
  const [forms, setForms] = useState(() => loadSavedState('ayurflow:forms:v1', []));
  const [editingId, setEditingId] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [previewAnswers, setPreviewAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fStatus, setFStatus] = useState('Draft');
  const [fFields, setFFields] = useState([makeBlankField()]);

  useEffect(() => {
    try { window.localStorage.setItem('ayurflow:forms:v1', JSON.stringify(forms)); } catch {}
  }, [forms]);

  const startCreate = () => {
    setEditingId(null); setFTitle(''); setFDesc(''); setFStatus('Draft');
    setFFields([makeBlankField()]); setView('builder');
  };

  const startEdit = (form) => {
    setEditingId(form.id); setFTitle(form.title); setFDesc(form.description ?? '');
    setFStatus(form.status); setFFields(form.fields.length ? form.fields : [makeBlankField()]);
    setView('builder');
  };

  const saveForm = (status) => {
    if (!fTitle.trim()) return;
    const validFields = fFields.filter((f) => f.label.trim());
    const now = new Date().toISOString().slice(0, 10);
    const entry = { title: fTitle.trim(), description: fDesc.trim(), status: status ?? fStatus, fields: validFields, updatedAt: now };
    setForms((prev) => editingId
      ? prev.map((f) => (f.id === editingId ? { ...f, ...entry } : f))
      : [{ id: makeUid(), createdAt: now, ...entry }, ...prev]);
    setView('list');
  };

  const deleteForm = (id) => {
    if (!window.confirm('Delete this form? This action cannot be undone.')) return;
    setForms((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleStatus = (id) => setForms((prev) =>
    prev.map((f) => (f.id === id ? { ...f, status: f.status === 'Published' ? 'Draft' : 'Published' } : f)));

  const openPreview = (form) => { setPreviewId(form.id); setPreviewAnswers({}); setSubmitted(false); setView('preview'); };

  const updateField = (id, key, val) => setFFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)));
  const removeField = (id) => setFFields((prev) => prev.filter((f) => f.id !== id));
  const moveField = (id, dir) => setFFields((prev) => {
    const idx = prev.findIndex((f) => f.id === id);
    const next = [...prev];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return prev;
    [next[idx], next[to]] = [next[to], next[idx]];
    return next;
  });
  const addOption = (fid) => setFFields((prev) => prev.map((f) => (f.id === fid ? { ...f, options: [...f.options, ''] } : f)));
  const updateOption = (fid, oi, val) => setFFields((prev) => prev.map((f) => (f.id === fid ? { ...f, options: f.options.map((o, i) => (i === oi ? val : o)) } : f)));
  const removeOption = (fid, oi) => setFFields((prev) => prev.map((f) => (f.id === fid ? { ...f, options: f.options.filter((_, i) => i !== oi) } : f)));

  const currentPreview = forms.find((f) => f.id === previewId);

  // ── PREVIEW ──
  if (view === 'preview' && currentPreview) {
    return (
      <section className="module-page">
        <div className="module-hero compact-hero">
          <div><h1>{currentPreview.title}</h1><p>{currentPreview.description || 'Fill in the form and submit.'}</p></div>
          <div className="module-stats">
            <div className="mini-stat"><span>Status</span><strong>{currentPreview.status}</strong></div>
            <div className="mini-stat"><span>Fields</span><strong>{currentPreview.fields.length}</strong></div>
          </div>
        </div>
        <button className="pill" type="button" style={{ marginBottom: 16 }} onClick={() => setView('list')}>← Back to Forms</button>
        <Card title="Form Preview" subtitle="This is how the form appears to a client.">
          {submitted ? (
            <div className="empty-state">
              <strong>Form submitted!</strong>
              <p>Thank you. Your response has been recorded.</p>
              <button className="pill" type="button" style={{ marginTop: 12 }} onClick={() => { setPreviewAnswers({}); setSubmitted(false); }}>Fill Again <ChevronRight /></button>
            </div>
          ) : (
            <div style={{ maxWidth: 560 }}>
              {currentPreview.fields.map((field) => (
                <label key={field.id} style={{ display: 'block', marginBottom: 16 }}>
                  <span style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.93rem' }}>
                    {field.label || 'Untitled field'}
                    {field.required && <span style={{ color: '#e35c3e' }}> *</span>}
                  </span>
                  {field.type === 'textarea' ? (
                    <textarea className="lead-input" rows={3} style={{ resize: 'vertical', width: '100%' }}
                      value={previewAnswers[field.id] ?? ''}
                      onChange={(e) => setPreviewAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} />
                  ) : field.type === 'select' ? (
                    <select className="lead-input" value={previewAnswers[field.id] ?? ''}
                      onChange={(e) => setPreviewAnswers((p) => ({ ...p, [field.id]: e.target.value }))}>
                      <option value="">Select an option</option>
                      {field.options.filter(Boolean).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 400 }}>
                      <input type="checkbox" checked={!!previewAnswers[field.id]}
                        onChange={(e) => setPreviewAnswers((p) => ({ ...p, [field.id]: e.target.checked }))}
                        style={{ width: 18, height: 18 }} />
                      {field.placeholder || 'Yes'}
                    </label>
                  ) : (
                    <input className="lead-input" type={field.type === 'phone' ? 'tel' : field.type}
                      value={previewAnswers[field.id] ?? ''}
                      onChange={(e) => setPreviewAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} />
                  )}
                </label>
              ))}
              <div className="sheet-actions" style={{ marginTop: 20 }}>
                <button className="pill" type="button" onClick={() => setView('list')}>Cancel</button>
                <button className="pill" type="button" onClick={() => setSubmitted(true)}>Submit Form <ChevronRight /></button>
              </div>
            </div>
          )}
        </Card>
      </section>
    );
  }

  // ── BUILDER ──
  if (view === 'builder') {
    return (
      <section className="module-page">
        <div className="module-hero compact-hero">
          <div><h1>{editingId ? 'Edit Form' : 'Create New Form'}</h1><p>Add fields, configure them, then save as draft or publish.</p></div>
          <div className="module-stats">
            <div className="mini-stat"><span>Fields added</span><strong>{fFields.filter((f) => f.label.trim()).length}</strong></div>
            <div className="mini-stat"><span>Status</span><strong>{fStatus}</strong></div>
          </div>
        </div>

        <Card title="Form Details">
          <div className="lead-form">
            <label className="field-block">
              <span className="subtle">Form Title *</span>
              <input className="lead-input" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="e.g. Patient Intake Form, Assessment Form" />
            </label>
            <label className="field-block">
              <span className="subtle">Description (shown to client)</span>
              <input className="lead-input" value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Brief note shown above the form" />
            </label>
            <label className="field-block" style={{ maxWidth: 200 }}>
              <span className="subtle">Status</span>
              <select className="lead-input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option>Draft</option>
                <option>Published</option>
              </select>
            </label>
          </div>
        </Card>

        <Card title="Form Fields" subtitle="Add fields in the order you want them to appear.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fFields.map((field, idx) => (
              <div key={field.id} style={{ background: 'rgba(31,107,74,0.04)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: field.type === 'select' ? 10 : 0 }}>
                  <select className="lead-input" style={{ width: 'auto', flex: '0 0 auto' }}
                    value={field.type} onChange={(e) => updateField(field.id, 'type', e.target.value)}>
                    {FIELD_TYPES.map((ft) => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                  </select>
                  <input className="lead-input" style={{ flex: 1, minWidth: 140 }}
                    value={field.label} onChange={(e) => updateField(field.id, 'label', e.target.value)}
                    placeholder="Field label (e.g. Full Name, Age, Chief Complaint)" />
                  <input className="lead-input" style={{ flex: 1, minWidth: 120 }}
                    value={field.placeholder} onChange={(e) => updateField(field.id, 'placeholder', e.target.value)}
                    placeholder="Placeholder text (optional)" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, 'required', e.target.checked)} />
                    Required
                  </label>
                  <button className="pill" type="button" onClick={() => moveField(field.id, -1)} disabled={idx === 0} style={{ padding: '4px 9px', minWidth: 0 }}>↑</button>
                  <button className="pill" type="button" onClick={() => moveField(field.id, 1)} disabled={idx === fFields.length - 1} style={{ padding: '4px 9px', minWidth: 0 }}>↓</button>
                  <button className="row-link danger" type="button" onClick={() => removeField(field.id)}>Remove</button>
                </div>
                {field.type === 'select' && (
                  <div style={{ paddingLeft: 10, borderLeft: '3px solid var(--gold)', marginTop: 8 }}>
                    <div className="subtle" style={{ fontSize: '0.81rem', marginBottom: 6 }}>Dropdown Options</div>
                    {field.options.map((opt, oi) => (
                      <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <input className="lead-input" style={{ flex: 1 }} value={opt}
                          onChange={(e) => updateOption(field.id, oi, e.target.value)} placeholder={`Option ${oi + 1}`} />
                        <button className="row-link danger" type="button" onClick={() => removeOption(field.id, oi)}>✕</button>
                      </div>
                    ))}
                    <button className="pill" type="button" onClick={() => addOption(field.id)}>+ Add Option</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="sheet-actions" style={{ marginTop: 14 }}>
            <button className="pill" type="button" onClick={() => setFFields((prev) => [...prev, makeBlankField()])}>Add Field <ChevronRight /></button>
          </div>
        </Card>

        <Card title="Save">
          <div className="sheet-actions">
            <button className="pill" type="button" onClick={() => setView('list')}>Cancel</button>
            <button className="pill" type="button" onClick={() => saveForm('Draft')} disabled={!fTitle.trim()}>Save as Draft <ChevronRight /></button>
            <button className="pill" type="button" onClick={() => saveForm('Published')} disabled={!fTitle.trim()}>Publish Form <ChevronRight /></button>
          </div>
          {!fTitle.trim() && <p className="subtle" style={{ marginTop: 8, fontSize: '0.85rem' }}>Please enter a form title before saving.</p>}
        </Card>
      </section>
    );
  }

  // ── LIST ──
  return (
    <section className="module-page">
      <div className="module-hero">
        <div><h1>Forms</h1><p>Create and manage clinic intake forms, assessments, and registration templates.</p></div>
        <div className="module-stats">
          <div className="mini-stat"><span>Total Forms</span><strong>{forms.length}</strong></div>
          <div className="mini-stat"><span>Published</span><strong>{forms.filter((f) => f.status === 'Published').length}</strong></div>
          <div className="mini-stat"><span>Drafts</span><strong>{forms.filter((f) => f.status === 'Draft').length}</strong></div>
        </div>
      </div>

      <Card title="All Forms" subtitle="Preview forms, edit fields, or change publishing status." action={<ActionMenu label="Actions" items={[{ label: 'Create new form', description: 'Open the form builder', onClick: startCreate }]} />}>
        {forms.length ? (
          <div className="data-table adaptive-table" style={{ '--table-columns': 4 }}>
            <div className="table-head">
              <div>Form Name</div><div>Fields</div><div>Status</div><div>Updated</div><div />
            </div>
            {forms.map((form) => (
              <div className="data-row" key={form.id}>
                <div>
                  <strong>{form.title}</strong>
                  {form.description && <div className="subtle" style={{ fontSize: '0.81rem', marginTop: 2 }}>{form.description}</div>}
                </div>
                <div>{form.fields.length} field{form.fields.length !== 1 ? 's' : ''}</div>
                <div><Tag tone={form.status === 'Published' ? 'tag-contacted' : 'tag-follow'}>{form.status}</Tag></div>
                <div>{form.updatedAt ?? form.createdAt ?? '—'}</div>
                <div>
                  <ActionMenu
                    compact
                    label={`Actions for ${form.title}`}
                    items={[
                      { label: 'Preview form', onClick: () => openPreview(form) },
                      { label: 'Edit form', onClick: () => startEdit(form) },
                      { label: form.status === 'Published' ? 'Unpublish form' : 'Publish form', onClick: () => toggleStatus(form.id) },
                      { label: 'Delete form', description: 'Permanently remove this form', danger: true, onClick: () => deleteForm(form.id) },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty table-empty">
            <strong>No forms created yet.</strong>
            <p>Use Actions, then Create new form, to build your first intake form or assessment.</p>
          </div>
        )}
      </Card>
    </section>
  );
}

export function AppointmentsPage() {
  const { branchKey } = useBranch();
  const navigate = useNavigate();
  const [clientNames] = useState(() =>
    loadSavedArray(branchKey('ayurflow-clients:rows:v3'), loadSavedArray('ayurflow:ayurflow-clients:rows:v3', clients)).map((row) => Array.isArray(row) ? row[0] : row.name ?? row.Client ?? '').filter(Boolean)
  );
  const [staffNames] = useState(() =>
    loadSavedArray('ayurflow:Staff:rows:v2', staffRoles.map((member) => [member.name])).map((row) => row?.[0] ?? row?.name ?? '').filter(Boolean)
  );
  return (
    <GenericModulePage
      title="Appointments"
      description="Track booking slots, confirmations, and visit flow across the day."
      stats={[
        { label: 'Today', value: '0' },
        { label: 'Confirmed', value: '0' },
        { label: 'Pending', value: '0' },
      ]}
      columns={['Client', 'Mobile', 'Date', 'Time', 'Type', 'Staff', 'Status']}
      rows={[]}
      fieldOptions={{ Client: clientNames, Type: services, Staff: staffNames }}
      fieldTypes={{ Mobile: 'tel', Date: 'date', Time: 'time' }}
      filterPresets={[
        { label: 'Date wise', column: 'Date' },
        { label: 'Type wise', column: 'Type' },
        { label: 'Staff wise', column: 'Staff' },
        { label: 'Mobile wise', column: 'Mobile' },
        { label: 'Client wise', column: 'Client' },
      ]}
      viewPresets={[
        {
          id: 'all',
          label: 'All Appointments',
          match: () => true,
        },
        {
          id: 'today',
          label: 'Today Appointments',
          match: (row) => row[2] === new Date().toISOString().slice(0, 10),
        },
      ]}
      rowActions={(row, setSelectedRow, setActionMessage, setTableRows) => (
        <ActionMenu compact label={`Actions for ${row[0] || 'appointment'}`} items={[
          { label: 'View appointment', onClick: () => setSelectedRow(row[0]) },
          {
            label: 'Confirm appointment',
            onClick: () => {
              setTableRows((current) => current.map((item) => item === row ? item.map((cell, index) => index === 6 ? 'Confirmed' : cell) : item));
              setActionMessage(`${row[0]} appointment confirmed.`);
            },
          },
          {
            label: 'Check in client',
            onClick: () => {
              setTableRows((current) => current.map((item) => item === row ? item.map((cell, index) => index === 6 ? 'Checked-in' : cell) : item));
              setActionMessage(`${row[0]} checked in and ready for consultation.`);
            },
          },
          { label: 'Open client journey', onClick: () => navigate(`/journey?client=${encodeURIComponent(row[0])}`) },
          {
            label: 'Send WhatsApp reminder',
            onClick: () => {
              const phone = String(row[1] ?? '').replace(/\D/g, '');
              const text = encodeURIComponent(`Hello ${row[0]}, your appointment for ${row[4]} on ${row[2]} at ${row[3]} is scheduled.`);
              if (!phone) {
                setActionMessage('Mobile number is missing.');
                return;
              }
              setActionMessage(`Opening WhatsApp for ${row[0]}.`);
              window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer');
            },
          },
        ]} />
      )}
    />
  );
}

export function ServicesPage() {
  return (
    <GenericModulePage
      title="Services"
      description="Maintain the service catalog used by appointment booking, treatment plans, and future scheduling."
      stats={[
        { label: 'Services', value: services.length },
        { label: 'Popular', value: '4 core' },
        { label: 'Status', value: 'Editable' },
      ]}
      columns={['Service', 'Category', 'Duration', 'Status']}
      rows={services.map((service) => [
        service,
        service === 'Consultation' || service === 'Follow-up' ? 'General' : 'Clinic',
        service === 'Panchakarma' ? '14 days' : '30 min',
        'Active',
      ])}
    />
  );
}

export function TreatmentPlansPage() {
  const PLANS_KEY = 'ayurflow:Treatment Plans:rows:v2';
  const TEMPLATES_KEY = 'ayurflow:treatment-templates:v1';

  const [clientNames] = useState(() =>
    loadSavedArray('ayurflow:ayurflow-clients:rows:v3', clients).map((row) => row.name ?? '').filter(Boolean)
  );
  const [serviceOptions] = useState(() => {
    const saved = loadSavedArray('ayurflow:Services:rows:v2', []);
    const savedNames = saved.map((row) => row[0]).filter(Boolean);
    return Array.from(new Set([...savedNames, ...services]));
  });
  const [plans, setPlans] = useState(() => loadSavedArray(PLANS_KEY, []));
  const [templates, setTemplates] = useState(() => loadSavedArray(TEMPLATES_KEY, []));
  const [activeTab, setActiveTab] = useState('plans');

  const blankPlan = { client: '', service: serviceOptions[0] ?? '', goal: '', duration: '30 days', medicine: '', dose: '', timing: '', status: 'Active' };
  const blankTemplate = { name: '', service: serviceOptions[0] ?? '', goal: '', duration: '30 days', medicine: '', dose: '', timing: '' };

  const [planModal, setPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState(blankPlan);
  const [editingPlanIndex, setEditingPlanIndex] = useState(null);

  const [templateModal, setTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState(blankTemplate);
  const [editingTemplateIndex, setEditingTemplateIndex] = useState(null);

  useEffect(() => {
    try { window.localStorage.setItem(PLANS_KEY, JSON.stringify(plans)); } catch {}
  }, [plans]);

  useEffect(() => {
    try { window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates)); } catch {}
  }, [templates]);

  const applyTemplate = (template) => {
    setPlanForm((f) => ({ ...f, service: template.service, goal: template.goal, duration: template.duration, medicine: template.medicine, dose: template.dose, timing: template.timing }));
  };

  const savePlan = () => {
    const row = [planForm.client, planForm.service, planForm.goal, planForm.duration, planForm.medicine, planForm.dose, planForm.timing, planForm.status];
    setPlans((current) => editingPlanIndex === null ? [row, ...current] : current.map((r, i) => i === editingPlanIndex ? row : r));
    setPlanModal(false);
    setEditingPlanIndex(null);
    setPlanForm(blankPlan);
  };

  const openEditPlan = (row, index) => {
    setPlanForm({ client: row[0] ?? '', service: row[1] ?? '', goal: row[2] ?? '', duration: row[3] ?? '', medicine: row[4] ?? '', dose: row[5] ?? '', timing: row[6] ?? '', status: row[7] ?? row[4] ?? 'Active' });
    setEditingPlanIndex(index);
    setPlanModal(true);
  };

  const saveTemplate = () => {
    if (!templateForm.name.trim()) return;
    setTemplates((current) => editingTemplateIndex === null ? [{ ...templateForm }, ...current] : current.map((t, i) => i === editingTemplateIndex ? { ...templateForm } : t));
    setTemplateModal(false);
    setEditingTemplateIndex(null);
    setTemplateForm(blankTemplate);
  };

  const openNewPlan = () => {
    setPlanForm(blankPlan);
    setEditingPlanIndex(null);
    setPlanModal(true);
  };

  const openNewTemplate = () => {
    setTemplateForm(blankTemplate);
    setEditingTemplateIndex(null);
    setTemplateModal(true);
  };

  const deleteTemplate = (index) => {
    if (!window.confirm('Delete this treatment template?')) return;
    setTemplates((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const PLAN_COLS = ['Client', 'Service', 'Goal', 'Duration', 'Medicine', 'Dose', 'Timing', 'Status'];
  const TMPL_COLS = ['Template Name', 'Service', 'Goal', 'Duration', 'Medicine', 'Dose', 'Timing'];

  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <h1>Treatment Plans</h1>
          <p>Track client treatment journeys, goals, therapy schedules, and consultant notes.</p>
        </div>
        <div className="module-stats">
          <div className="mini-stat"><span>Active</span><strong>{plans.filter((r) => (r[7] ?? r[4]) === 'Active').length}</strong></div>
          <div className="mini-stat"><span>Templates</span><strong>{templates.length}</strong></div>
          <div className="mini-stat"><span>Total Plans</span><strong>{plans.length}</strong></div>
        </div>
      </div>

      <div className="sheet-tabs">
        <button className={`sheet-tab ${activeTab === 'plans' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('plans')}>Treatment Plans</button>
        <button className={`sheet-tab ${activeTab === 'templates' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('templates')}>Templates</button>
      </div>

      {activeTab === 'plans' && (
        <Card title="Treatment Plans" subtitle="All client treatment records." action={<div className="card-action-group"><button className="pill primary-action" type="button" onClick={openNewPlan}>+ Add Treatment Plan</button><ActionMenu label="Actions" items={[{ label: 'Add treatment plan', description: 'Create a new client plan', onClick: openNewPlan }]} /></div>}>
            <div className="table adaptive-table" style={{ '--table-columns': PLAN_COLS.length }}>
              <div className="table-head">
                {PLAN_COLS.map((h) => <div key={h}>{h}</div>)}
                <div />
              </div>
              {plans.length ? plans.map((row, i) => (
                <div className="data-row" key={i}>
                  {[row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7] ?? row[4]].map((cell, ci) => <div key={ci}>{cell}</div>)}
                  <div>
                    <ActionMenu compact label={`Actions for ${row[0] || 'treatment plan'}`} items={[{ label: 'Edit treatment plan', onClick: () => openEditPlan(row, i) }]} />
                  </div>
                </div>
              )) : (
                <div className="empty-state compact-empty table-empty">
                  <strong>No treatment plans yet.</strong>
                  <p>Click Add Treatment Plan, or create a template first for quick entry.</p>
                  <button className="pill primary-action" type="button" onClick={openNewPlan}>+ Add Treatment Plan</button>
                </div>
              )}
            </div>
          </Card>
      )}

      {activeTab === 'templates' && (
        <Card title="Treatment Templates" subtitle="Reusable presets that auto-fill treatment details." action={<div className="card-action-group"><button className="pill primary-action" type="button" onClick={openNewTemplate}>+ Add Template</button><ActionMenu label="Actions" items={[{ label: 'Add template', description: 'Create a reusable preset', onClick: openNewTemplate }]} /></div>}>
            <div className="table adaptive-table" style={{ '--table-columns': TMPL_COLS.length }}>
              <div className="table-head">
                {TMPL_COLS.map((h) => <div key={h}>{h}</div>)}
                <div />
              </div>
              {templates.length ? templates.map((t, i) => (
                <div className="data-row" key={i}>
                  {[t.name, t.service, t.goal, t.duration, t.medicine, t.dose, t.timing].map((cell, ci) => <div key={ci}>{cell}</div>)}
                  <div>
                    <ActionMenu compact label={`Actions for ${t.name || 'template'}`} items={[
                      { label: 'Edit template', onClick: () => { setTemplateForm({ ...t }); setEditingTemplateIndex(i); setTemplateModal(true); } },
                      { label: 'Delete template', description: 'Permanently remove this preset', danger: true, onClick: () => deleteTemplate(i) },
                    ]} />
                  </div>
                </div>
              )) : (
                <div className="empty-state compact-empty table-empty">
                  <strong>No templates yet.</strong>
                  <p>Create a template to quickly fill in treatment details — service, medicine, dose, timing — in one tap.</p>
                  <button className="pill primary-action" type="button" onClick={openNewTemplate}>+ Add Template</button>
                </div>
              )}
            </div>
          </Card>
      )}

      {planModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setPlanModal(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label="Treatment Plan" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><h2>{editingPlanIndex === null ? 'Add Treatment Plan' : 'Edit Treatment Plan'}</h2><p>Select a template to auto-fill, then adjust as needed.</p></div>
              <button className="icon-btn" type="button" onClick={() => setPlanModal(false)} aria-label="Close">x</button>
            </div>
            <div className="modal-body detail-grid">
              {templates.length > 0 && (
                <label className="field-block" style={{ gridColumn: '1 / -1' }}>
                  <span>Use Template</span>
                  <select className="lead-input" defaultValue="" onChange={(e) => { const t = templates[Number(e.target.value)]; if (t) applyTemplate(t); }}>
                    <option value="">Select template to auto-fill...</option>
                    {templates.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
                  </select>
                </label>
              )}
              <label className="field-block">
                <span>Client</span>
                {clientNames.length ? (
                  <select className="lead-input" value={planForm.client} onChange={(e) => setPlanForm((f) => ({ ...f, client: e.target.value }))}>
                    <option value="">Select client</option>
                    {clientNames.map((n) => <option key={n}>{n}</option>)}
                  </select>
                ) : (
                  <input className="lead-input" value={planForm.client} onChange={(e) => setPlanForm((f) => ({ ...f, client: e.target.value }))} placeholder="Client name" />
                )}
              </label>
              <label className="field-block">
                <span>Service</span>
                <select className="lead-input" value={planForm.service} onChange={(e) => setPlanForm((f) => ({ ...f, service: e.target.value }))}>
                  {serviceOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field-block">
                <span>Goal</span>
                <input className="lead-input" value={planForm.goal} onChange={(e) => setPlanForm((f) => ({ ...f, goal: e.target.value }))} placeholder="Treatment goal" />
              </label>
              <label className="field-block">
                <span>Duration</span>
                <input className="lead-input" value={planForm.duration} onChange={(e) => setPlanForm((f) => ({ ...f, duration: e.target.value }))} placeholder="30 days" />
              </label>
              <label className="field-block">
                <span>Medicine</span>
                <input className="lead-input" value={planForm.medicine} onChange={(e) => setPlanForm((f) => ({ ...f, medicine: e.target.value }))} placeholder="Medicine name" />
              </label>
              <label className="field-block">
                <span>Dose</span>
                <input className="lead-input" value={planForm.dose} onChange={(e) => setPlanForm((f) => ({ ...f, dose: e.target.value }))} placeholder="e.g. 10ml twice daily" />
              </label>
              <label className="field-block">
                <span>Timing</span>
                <input className="lead-input" value={planForm.timing} onChange={(e) => setPlanForm((f) => ({ ...f, timing: e.target.value }))} placeholder="e.g. After meals" />
              </label>
              <label className="field-block">
                <span>Status</span>
                <select className="lead-input" value={planForm.status} onChange={(e) => setPlanForm((f) => ({ ...f, status: e.target.value }))}>
                  <option>Active</option><option>Pending</option><option>Paused</option><option>Completed</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setPlanModal(false)}>Cancel</button>
              <button className="pill" type="button" onClick={savePlan}>Save <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      )}

      {templateModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setTemplateModal(false)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label="Treatment Template" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><h2>{editingTemplateIndex === null ? 'Add Template' : 'Edit Template'}</h2><p>Save a reusable treatment preset.</p></div>
              <button className="icon-btn" type="button" onClick={() => setTemplateModal(false)} aria-label="Close">x</button>
            </div>
            <div className="modal-body detail-grid">
              <label className="field-block" style={{ gridColumn: '1 / -1' }}>
                <span>Template Name</span>
                <input className="lead-input" value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Panchakarma Standard" />
              </label>
              <label className="field-block">
                <span>Service</span>
                <select className="lead-input" value={templateForm.service} onChange={(e) => setTemplateForm((f) => ({ ...f, service: e.target.value }))}>
                  {serviceOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field-block">
                <span>Goal</span>
                <input className="lead-input" value={templateForm.goal} onChange={(e) => setTemplateForm((f) => ({ ...f, goal: e.target.value }))} placeholder="Treatment goal" />
              </label>
              <label className="field-block">
                <span>Duration</span>
                <input className="lead-input" value={templateForm.duration} onChange={(e) => setTemplateForm((f) => ({ ...f, duration: e.target.value }))} placeholder="30 days" />
              </label>
              <label className="field-block">
                <span>Medicine</span>
                <input className="lead-input" value={templateForm.medicine} onChange={(e) => setTemplateForm((f) => ({ ...f, medicine: e.target.value }))} placeholder="Medicine name" />
              </label>
              <label className="field-block">
                <span>Dose</span>
                <input className="lead-input" value={templateForm.dose} onChange={(e) => setTemplateForm((f) => ({ ...f, dose: e.target.value }))} placeholder="e.g. 10ml twice daily" />
              </label>
              <label className="field-block">
                <span>Timing</span>
                <input className="lead-input" value={templateForm.timing} onChange={(e) => setTemplateForm((f) => ({ ...f, timing: e.target.value }))} placeholder="e.g. After meals" />
              </label>
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setTemplateModal(false)}>Cancel</button>
              <button className="pill" type="button" onClick={saveTemplate} disabled={!templateForm.name.trim()}>Save <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function MedicinesPage() {
  const { branchKey } = useBranch();
  const catalogStorageKey = branchKey('Operations:tabs:v3');
  const [catalog, setCatalog] = useState(() => {
    const saved = loadSavedObject(catalogStorageKey, loadSavedObject('ayurflow:Operations:tabs:v3', {}));
    return Array.isArray(saved.medicines) ? saved.medicines : [];
  });
  const [draft, setDraft] = useState({ Medicine: '', Category: '', 'Default Dose': '', Timing: '', Status: 'Active' });
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [message, setMessage] = useState('Shared medicine catalog ready.');

  useEffect(() => {
    try {
      const saved = loadSavedObject(catalogStorageKey, loadSavedObject('ayurflow:Operations:tabs:v3', {}));
      window.localStorage.setItem(catalogStorageKey, JSON.stringify({ ...saved, medicines: catalog }));
    } catch {
      setMessage('Local browser storage is full or blocked.');
    }
  }, [catalog, catalogStorageKey]);

  const save = () => {
    if (!draft.Medicine.trim()) {
      setMessage('Please enter a medicine name.');
      return;
    }
    setCatalog((current) => (
      selectedIndex === null
        ? [{ ...draft }, ...current]
        : current.map((item, index) => (index === selectedIndex ? { ...draft } : item))
    ));
    setMessage(selectedIndex === null ? 'Medicine added.' : 'Medicine updated.');
    setDraft({ Medicine: '', Category: '', 'Default Dose': '', Timing: '', Status: 'Active' });
    setSelectedIndex(null);
  };

  const openEdit = (row, index) => {
    setSelectedIndex(index);
    setDraft(row);
  };

  const resetDraft = () => {
    setSelectedIndex(null);
    setDraft({ Medicine: '', Category: '', 'Default Dose': '', Timing: '', Status: 'Active' });
    setMessage('Medicine form reset.');
  };

  const remove = (index) => {
    if (!window.confirm('Delete this medicine from the shared catalog?')) return;
    setCatalog((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setMessage('Medicine removed.');
    if (selectedIndex === index) {
      setSelectedIndex(null);
      setDraft({ Medicine: '', Category: '', 'Default Dose': '', Timing: '', Status: 'Active' });
    }
  };

  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <h1>Medicines</h1>
          <p>Manage the shared medicine catalog used by Treatment. Default dose and timing are reused automatically.</p>
        </div>
        <div className="module-stats">
          <div className="mini-stat"><span>Medicines</span><strong>{catalog.length}</strong></div>
          <div className="mini-stat"><span>Status</span><strong>{message}</strong></div>
          <div className="mini-stat"><span>Scope</span><strong>Shared</strong></div>
        </div>
      </div>
      <Card
        title={selectedIndex === null ? 'Add Medicine' : 'Edit Medicine'}
        subtitle="This catalog feeds the treatment preset builder."
        action={<ActionMenu label="More" items={[{ label: 'Reset form', description: 'Clear the current medicine draft', onClick: resetDraft }]} />}
      >
        <div className="modal-body detail-grid">
          {['Medicine', 'Category', 'Default Dose', 'Timing', 'Status'].map((field) => (
            <label className="field-block" key={field}>
              <span>{field}</span>
              <input
                className="lead-input"
                value={draft[field] ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                placeholder={`Enter ${field.toLowerCase()}`}
              />
            </label>
          ))}
        </div>
        <div className="sheet-actions">
          <button className="pill" type="button" onClick={save}>Save Medicine <ChevronRight /></button>
        </div>
      </Card>
      <Card title="Medicine Catalog" subtitle="Edit or remove shared medicines used in treatment presets.">
        <div className="table adaptive-table" style={{ '--table-columns': 5 }}>
          <div className="table-head">
            <div>Medicine</div>
            <div>Category</div>
            <div>Dose</div>
            <div>Timing</div>
            <div>Status</div>
            <div />
          </div>
          {catalog.length ? catalog.map((row, index) => (
            <div className="data-row" key={`${row.Medicine}-${index}`}>
              <div>{row.Medicine}</div>
              <div>{row.Category}</div>
              <div>{row['Default Dose']}</div>
              <div>{row.Timing}</div>
              <div>{row.Status}</div>
              <div>
                <ActionMenu compact label={`Actions for ${row.Medicine || 'medicine'}`} items={[
                  { label: 'Edit medicine', onClick: () => openEdit(row, index) },
                  { label: 'Delete medicine', description: 'Remove it from treatment presets', danger: true, onClick: () => remove(index) },
                ]} />
              </div>
            </div>
          )) : (
            <div className="empty-state compact-empty">
              <strong>No medicines saved yet.</strong>
              <p>Add one here and it will be available in Treatment presets.</p>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

export function PackagesPage() {
  return (
    <GenericModulePage
      title="Packages"
      description="Manage clinic and coaching packages with duration, sessions, price, renewal, and payment plan context."
      stats={[
        { label: 'Packages', value: packages.length },
        { label: 'Clinic', value: packages.filter((item) => item.category === 'Clinic').length },
        { label: 'Coaching', value: packages.filter((item) => item.category === 'Coaching').length },
      ]}
      columns={['Package', 'Category', 'Duration', 'Sessions', 'Price']}
      rows={packages.map((item) => [item.name, item.category, item.duration, item.sessions, item.price])}
    />
  );
}

export function CoachingPage() {
  return (
    <GenericModulePage
      title="Coaching"
      description="Handle student admissions, batches, attendance, course progress, assignments, tests, and certificates."
      stats={[
        { label: 'Active Batches', value: coachingBatches.filter((batch) => batch.status === 'Active').length },
        { label: 'Students', value: coachingBatches.reduce((total, batch) => total + batch.students, 0) },
        { label: 'Scheduled', value: coachingBatches.filter((batch) => batch.status === 'Scheduled').length },
      ]}
      columns={['Batch', 'Course', 'Trainer', 'Students', 'Status']}
      rows={coachingBatches.map((batch) => [batch.batch, batch.course, batch.trainer, batch.students, batch.status])}
    />
  );
}

export function StaffPage() {
  return (
    <GenericModulePage
      title="Staff"
      description="Manage staff roles, permissions, and who can access CRM, health records, invoices, reports, and operations."
      stats={[
        { label: 'Team Members', value: staffRoles.length },
        { label: 'Active', value: staffRoles.filter((member) => member.status === 'Active').length },
        { label: 'Pending', value: staffRoles.filter((member) => member.status === 'Pending').length },
      ]}
      columns={['Name', 'Role', 'Permissions', 'Status']}
      rows={staffRoles.map((member) => [member.name, member.role, member.permissions, member.status])}
    />
  );
}

export function AccountsPage() {
  return (
    <GenericModulePage
      title="Accounts"
      description="Track income, expenses, invoices, pending payments, refunds, and profit/loss level finance operations."
      stats={[
        { label: 'Income Rows', value: accounts.filter((row) => row.type === 'Income').length },
        { label: 'Expense Rows', value: accounts.filter((row) => row.type === 'Expense').length },
        { label: 'Pending', value: accounts.filter((row) => row.status === 'Pending').length },
      ]}
      columns={['Item', 'Type', 'Amount', 'Mode', 'Status']}
      rows={accounts.map((row) => [row.item, row.type, row.amount, row.mode, row.status])}
    />
  );
}

export function InventoryPage() {
  return (
    <GenericModulePage
      title="Inventory"
      description="Monitor medicines, oils, products, course material, supplier stock, expiry dates, and low stock alerts."
      stats={[
        { label: 'Items', value: inventoryItems.length },
        { label: 'Low Stock', value: inventoryItems.filter((item) => item.status === 'Low Stock').length },
        { label: 'Categories', value: new Set(inventoryItems.map((item) => item.category)).size },
      ]}
      columns={['Item', 'Category', 'Quantity', 'Expiry', 'Status']}
      rows={inventoryItems.map((item) => [item.item, item.category, item.quantity, item.expiry, item.status])}
    />
  );
}

export function CommunicationPage() {
  return (
    <GenericModulePage
      title="Communication"
      description="Manage WhatsApp, SMS, and email templates for leads, appointments, payments, forms, coaching, and certificates."
      stats={[
        { label: 'Templates', value: communicationTemplates.length },
        { label: 'Active', value: communicationTemplates.filter((template) => template.status === 'Active').length },
        { label: 'Drafts', value: communicationTemplates.filter((template) => template.status === 'Draft').length },
      ]}
      columns={['Template', 'Channel', 'Trigger', 'Status']}
      rows={communicationTemplates.map((template) => [template.template, template.channel, template.trigger, template.status])}
    />
  );
}

export function ClientPortalPage() {
  return (
    <GenericModulePage
      title="Client Portal"
      description="Preview client-side access for appointment booking, forms, payment history, invoices, diet plan, and progress uploads."
      stats={[
        { label: 'Enabled', value: portalFeatures.filter((item) => item.status === 'Enabled').length },
        { label: 'Planned', value: portalFeatures.filter((item) => item.status === 'Planned').length },
        { label: 'Modes', value: new Set(portalFeatures.map((item) => item.mode)).size },
      ]}
      columns={['Feature', 'Owner', 'Mode', 'Status']}
      rows={portalFeatures.map((item) => [item.feature, item.owner, item.mode, item.status])}
    />
  );
}

export function SettingsPage() {
  return (
    <ModuleHubPage
      title="Settings"
      description="Clinic setup, users, permissions, notifications, tax, payment modes, and integrations in one compact page."
      tabs={settingsTabs}
      defaultTab="clinic"
    />
  );
}

export function ReportsPage() {
  const { branchKey, currentBranch } = useBranch();
  const [activeReport, setActiveReport] = useState('appointments');
  const [financeSubTab, setFinanceSubTab] = useState('payments');

  const today = new Date().toISOString().slice(0, 10);
  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  // Read current branch data first and keep legacy fallbacks for existing installs.
  const opsTabs = loadSavedState(branchKey('Operations:tabs:v3'), loadSavedState('ayurflow:Operations:tabs:v3', {}));
  const finTabs = loadSavedState(branchKey('Finance:tabs:v3'), loadSavedState('ayurflow:Finance:tabs:v3', {}));

  const appointmentRows = loadSavedState(branchKey('Appointments:rows:v3'), loadSavedState('ayurflow:Appointments:rows:v2', []));

  const treatmentRows = [
    ...loadSavedState('ayurflow:Treatment Plans:rows:v2', []).map((row) => [row[0], row[1], row[2], row[3], row[7] ?? row[4]]),
    ...(opsTabs.treatments ?? []).map((row) => [row[0], row[1], row[5], row[6], row[7]]),
  ];

  const formRows = [
    ...loadSavedState(branchKey('Forms:rows:v3'), loadSavedState('ayurflow:Forms:rows:v2', [])),
    ...(opsTabs.forms ?? []),
  ];

  const inventoryRows = [
    ...loadSavedState(branchKey('Inventory:rows:v3'), loadSavedState('ayurflow:Inventory:rows:v2', [])),
    ...(opsTabs.inventory ?? []),
  ];

  const paymentObjRows = loadSavedState(branchKey('ayurflow-payments:rows:v3'), loadSavedState('ayurflow:ayurflow-payments:rows:v2', []))
    .map((p) => [p.client ?? '', p.invoice ?? '', p.amount ?? '', p.status ?? '', p.paidOn ?? '']);
  const paymentRows = [...(finTabs.payments ?? []), ...paymentObjRows];

  const accountRows = [
    ...(finTabs.accounts ?? []),
    ...loadSavedState(branchKey('Accounts:rows:v3'), loadSavedState('ayurflow:Accounts:rows:v2', [])),
  ];

  // Revenue helpers
  const sumAmount = (rows, colIndex) =>
    rows.reduce((s, r) => s + (parseFloat(String(r[colIndex] ?? '').replace(/[^\d.]/g, '')) || 0), 0);
  const fmtRs = (n) => `₹${n.toLocaleString('en-IN')}`;

  // Summary rows for Finance → Revenue Summary tab
  const incomeTotal = sumAmount(accountRows.filter((r) => r[1] === 'Income'), 2);
  const expenseTotal = sumAmount(accountRows.filter((r) => r[1] === 'Expense'), 2);
  const paidTotal = sumAmount(paymentRows.filter((r) => r[3] === 'Paid'), 2);
  const pendingTotal = sumAmount(paymentRows.filter((r) => r[3] === 'Pending'), 2);

  const summaryRows = [
    ['Income', `${accountRows.filter((r) => r[1] === 'Income').length} entries`, incomeTotal > 0 ? fmtRs(incomeTotal) : '—'],
    ['Expenses', `${accountRows.filter((r) => r[1] === 'Expense').length} entries`, expenseTotal > 0 ? fmtRs(expenseTotal) : '—'],
    ['Net Profit / Loss', '—', incomeTotal - expenseTotal !== 0 ? fmtRs(incomeTotal - expenseTotal) : '—'],
    ['Payments Collected', `${paymentRows.filter((r) => r[3] === 'Paid').length} invoices`, paidTotal > 0 ? fmtRs(paidTotal) : '—'],
    ['Payments Pending', `${paymentRows.filter((r) => r[3] === 'Pending').length} invoices`, pendingTotal > 0 ? fmtRs(pendingTotal) : '—'],
    ['Partial Payments', `${paymentRows.filter((r) => r[3] === 'Partial').length} invoices`, '—'],
    ['Total Appointments', `${appointmentRows.length}`, '—'],
    ['Confirmed Appointments', `${appointmentRows.filter((r) => r[5] === 'Confirmed').length}`, '—'],
    ['Active Treatment Plans', `${treatmentRows.filter((r) => r[4] === 'Active').length}`, '—'],
    ['Inventory Items', `${inventoryRows.length}`, '—'],
    ['Low Stock Alerts', `${inventoryRows.filter((r) => r[4] === 'Low Stock').length}`, '—'],
    ['Form Responses', `${formRows.length}`, '—'],
  ];

  // Report map
  const reportMap = {
    treatments: { id: 'treatments', title: 'Treatment Report', columns: ['Client', 'Service', 'Goal', 'Duration', 'Status'], rows: treatmentRows },
    appointments: { id: 'appointments', title: 'Appointment Report', columns: ['Client', 'Mobile', 'Date', 'Time', 'Type', 'Status'], rows: appointmentRows },
    finance_payments: { id: 'payments', title: 'Payments Report', columns: ['Client', 'Invoice', 'Amount', 'Status', 'Paid On'], rows: paymentRows },
    finance_accounts: { id: 'accounts', title: 'Accounts Report', columns: ['Item', 'Type', 'Amount', 'Mode', 'Status'], rows: accountRows },
    finance_summary: { id: 'revenue-summary', title: 'Revenue & Business Summary', columns: ['Category', 'Details', 'Amount'], rows: summaryRows },
    forms: { id: 'forms', title: 'Form Responses Report', columns: ['Name', 'Form', 'Submitted', 'Phone', 'Status'], rows: formRows },
    inventory: { id: 'inventory', title: 'Inventory Report', columns: ['Item', 'Category', 'Quantity', 'Expiry', 'Status'], rows: inventoryRows },
  };

  const currentReportKey = activeReport === 'finance' ? `finance_${financeSubTab}` : activeReport;
  const currentReport = reportMap[currentReportKey];

  // Stats per active tab
  const stats = (() => {
    if (activeReport === 'appointments') return [
      { label: 'Total', value: appointmentRows.length },
      { label: 'Confirmed', value: appointmentRows.filter((r) => r[5] === 'Confirmed').length },
      { label: 'Pending', value: appointmentRows.filter((r) => r[5] === 'Pending').length },
      { label: 'Cancelled', value: appointmentRows.filter((r) => r[5] === 'Cancelled').length },
    ];
    if (activeReport === 'treatments') return [
      { label: 'Total Plans', value: treatmentRows.length },
      { label: 'Active', value: treatmentRows.filter((r) => r[4] === 'Active').length },
      { label: 'Completed', value: treatmentRows.filter((r) => r[4] === 'Completed').length },
      { label: 'Pending', value: treatmentRows.filter((r) => r[4] === 'Pending').length },
    ];
    if (activeReport === 'finance' && financeSubTab === 'payments') return [
      { label: 'Total', value: paymentRows.length },
      { label: 'Paid', value: paymentRows.filter((r) => r[3] === 'Paid').length },
      { label: 'Pending', value: paymentRows.filter((r) => r[3] === 'Pending').length },
      { label: 'Total Amount', value: paidTotal > 0 ? fmtRs(paidTotal) : '—' },
    ];
    if (activeReport === 'finance' && financeSubTab === 'accounts') return [
      { label: 'Total Entries', value: accountRows.length },
      { label: 'Income', value: accountRows.filter((r) => r[1] === 'Income').length },
      { label: 'Expense', value: accountRows.filter((r) => r[1] === 'Expense').length },
      { label: 'Net P/L', value: incomeTotal - expenseTotal !== 0 ? fmtRs(incomeTotal - expenseTotal) : '—' },
    ];
    if (activeReport === 'finance' && financeSubTab === 'summary') return [
      { label: 'Total Income', value: incomeTotal > 0 ? fmtRs(incomeTotal) : '—' },
      { label: 'Total Expense', value: expenseTotal > 0 ? fmtRs(expenseTotal) : '—' },
      { label: 'Net P/L', value: fmtRs(incomeTotal - expenseTotal) },
      { label: 'Invoices Paid', value: paymentRows.filter((r) => r[3] === 'Paid').length },
    ];
    if (activeReport === 'forms') return [
      { label: 'Total Responses', value: formRows.length },
      { label: 'Pending', value: formRows.filter((r) => r[4] === 'Pending').length },
      { label: 'Contacted', value: formRows.filter((r) => r[4] === 'Contacted').length },
    ];
    if (activeReport === 'inventory') return [
      { label: 'Total Items', value: inventoryRows.length },
      { label: 'Low Stock', value: inventoryRows.filter((r) => r[4] === 'Low Stock').length },
      { label: 'Out of Stock', value: inventoryRows.filter((r) => r[4] === 'Out of Stock').length },
      { label: 'Categories', value: new Set(inventoryRows.map((r) => r[1])).size },
    ];
    return [];
  })();

  // Export helpers
  const escH = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

  const exportExcel = () => {
    const { columns, rows, title, id } = currentReport;
    const statsHtml = stats.map((s) => `<td style="background:#f0f7f3;border:1px solid #c5ddd1;padding:6px 12px;border-radius:4px;"><strong style="color:#1f6b4a;font-size:13pt;">${escH(String(s.value))}</strong><br><span style="color:#617167;font-size:9pt;">${escH(s.label)}</span></td>`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
body{font-family:Calibri,Arial;}
h2{color:#1f6b4a;margin:0 0 4px;}
p{color:#617167;font-size:10pt;margin:0 0 12px;}
th{background:#1f6b4a;color:white;font-weight:bold;padding:8px 12px;border:1px solid #ccc;}
td{border:1px solid #ddd;padding:6px 12px;}
tr:nth-child(even) td{background:#f8f4eb;}
table{border-collapse:collapse;width:100%;}
</style></head>
<body>
<h2>${escH(title)}</h2>
<p>Generated: ${dateStr} &nbsp;|&nbsp; AyurFlow CRM – Vaidhya Wellness Clinic</p>
<table style="margin-bottom:16px;width:auto;"><tr>${statsHtml}</tr></table>
<table>
<thead><tr>${columns.map((h) => `<th>${escH(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escH(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}" style="text-align:center;color:#9aa89e;padding:20px;">No records found</td></tr>`}</tbody>
</table>
</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}-report-${today}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const { columns, rows, title } = currentReport;
    const statsHtml = stats.map((s) => `<div class="stat"><span>${escH(s.label)}</span><strong>${escH(String(s.value))}</strong></div>`).join('');
    const tableRows = rows.length
      ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escH(cell)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${columns.length}" class="empty-cell">No records found. Add data to generate this report.</td></tr>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escH(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:11pt;color:#173528;padding:30px 36px;}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1f6b4a;padding-bottom:14px;margin-bottom:16px;}
.hdr h1{font-size:20pt;color:#1f6b4a;margin-bottom:4px;}
.hdr .sub{color:#617167;font-size:10pt;}
.hdr .right{text-align:right;color:#617167;font-size:9pt;line-height:1.7;}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;}
.stat{background:#f0f7f3;border:1px solid #c5ddd1;border-radius:8px;padding:8px 16px;min-width:90px;}
.stat span{display:block;font-size:8pt;color:#617167;margin-bottom:2px;}
.stat strong{font-size:14pt;color:#1f6b4a;font-weight:700;}
table{width:100%;border-collapse:collapse;font-size:10pt;}
thead th{background:#1f6b4a;color:white;padding:8px 10px;text-align:left;font-weight:600;}
tbody td{padding:7px 10px;border-bottom:1px solid #e8e0d0;vertical-align:top;}
tbody tr:nth-child(even) td{background:#f8f4eb;}
.empty-cell{text-align:center;color:#9aa89e;padding:28px;}
.footer{margin-top:20px;font-size:8pt;color:#9aa89e;border-top:1px solid #e8e0d0;padding-top:8px;display:flex;justify-content:space-between;}
@media print{
body{padding:16px 20px;}
thead th,tbody tr:nth-child(even) td,.stat{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
}
</style></head>
<body>
<div class="hdr">
  <div><h1>${escH(title)}</h1><div class="sub">Vaidhya Wellness Clinic, Thrissur, Kerala</div></div>
  <div class="right"><strong>AyurFlow CRM</strong><br>Generated: ${dateStr}<br>Total Records: ${rows.length}</div>
</div>
<div class="stats">${statsHtml}</div>
<table>
<thead><tr>${columns.map((h) => `<th>${escH(h)}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody>
</table>
<div class="footer"><span>AyurFlow CRM | Vaidhya Wellness Clinic</span><span>${dateStr}</span></div>
<script>window.onload=function(){window.print()};<\/script>
</body></html>`;
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const exportCsv = () => {
    const { columns, rows, id } = currentReport;
    const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = [columns, ...rows].map((row) => row.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <h1>Reports</h1>
          <p>Generate and export detailed reports — Treatment, Appointments, Finance, Forms, and Inventory.</p>
          <p className="subtle">Current branch: {currentBranch}</p>
        </div>
        <div className="module-stats">
          {stats.map((s) => (
            <div className="mini-stat" key={s.label}>
              <span>{s.label}</span>
              <strong>{s.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="sheet-tabs">
        {[
          { id: 'treatments', label: 'Treatment' },
          { id: 'appointments', label: 'Appointments' },
          { id: 'finance', label: 'Finance' },
          { id: 'forms', label: 'Forms' },
          { id: 'inventory', label: 'Inventory' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`sheet-tab ${activeReport === tab.id ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveReport(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeReport === 'finance' && (
        <Card title="Finance Report Type" className="compact-action-card">
          <div className="sheet-tabs compact-tabs">
            {[
              { id: 'payments', label: 'Payments' },
              { id: 'accounts', label: 'Accounts' },
              { id: 'summary', label: 'Revenue Summary' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`sheet-tab ${financeSubTab === tab.id ? 'active' : ''}`}
                type="button"
                onClick={() => setFinanceSubTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {currentReport && (
        <Card
          title={currentReport.title}
          subtitle={`${currentReport.rows.length} record${currentReport.rows.length !== 1 ? 's' : ''} found`}
          action={<ActionMenu label="Export" items={[
            { label: 'Export Excel', description: 'Download an XLS report', onClick: exportExcel },
            { label: 'Print / save PDF', description: 'Open the print-ready report', onClick: exportPdf },
            { label: 'Export CSV', description: 'Download raw report rows', onClick: exportCsv },
          ]} />}
        >
          <div className="data-table adaptive-table" style={{ '--table-columns': currentReport.columns.length }}>
            <div className="table-head">
              {currentReport.columns.map((col) => <div key={col}>{col}</div>)}
              <div />
            </div>
            {currentReport.rows.length ? currentReport.rows.map((row, i) => (
              <div className="data-row" key={i}>
                {row.map((cell, j) => <div key={j}>{cell}</div>)}
                <div />
              </div>
            )) : (
              <div className="empty-state compact-empty table-empty">
                <strong>No {currentReport.title.replace(' Report', '').replace(' Summary', '')} data yet.</strong>
                <p>Add records in the relevant section — they will appear here automatically for reporting and export.</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}

export function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState(sheetTabs[0]);
  const [connectedApps, setConnectedApps] = useState(() => integrations.filter((integration) => integration.status === 'Connected').map((integration) => integration.name));
  const [syncMessage, setSyncMessage] = useState('Connect provider credentials before enabling live sync.');
  const preview = useMemo(() => syncPreviewRows, []);

  const handleIntegrationAction = async (integration) => {
    if (integration.name === 'Google Sheets') {
      setSyncMessage('Google Sheets opened. Add API credentials before enabling automatic sync.');
      window.open('https://docs.google.com/spreadsheets/', '_blank', 'noopener,noreferrer');
      return;
    }

    if (integration.name === 'Zapier / Webhooks') {
      let copied = true;
      try {
        await navigator.clipboard?.writeText('https://ayurflow.local/webhooks/crm-events');
      } catch {
        copied = false;
      }
      setConnectedApps((current) => Array.from(new Set([...current, integration.name])));
      setSyncMessage(copied ? 'Webhook URL copied and Zapier marked connected.' : 'Webhook ready. Copy permission was blocked by the browser.');
      return;
    }

    setConnectedApps((current) => Array.from(new Set([...current, integration.name])));
    setSyncMessage(`${integration.name} connected successfully.`);
  };

  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <h1>Integrations</h1>
          <p>Connect Mom's Pathshala CRM to Google Sheets or other tools so your team can keep using the apps they already rely on.</p>
        </div>
        <div className="module-stats">
          <div className="mini-stat">
            <span>Connected apps</span>
            <strong>{connectedApps.length} live</strong>
          </div>
          <div className="mini-stat">
            <span>Sync status</span>
            <strong>{syncMessage}</strong>
          </div>
          <div className="mini-stat">
            <span>Rows synced today</span>
            <strong>0</strong>
          </div>
        </div>
      </div>

      <div className="grid two-column-module-grid">
        <div className="stack">
          <Card title="Connected & Available Apps" subtitle="Pick one to connect or extend the CRM outward.">
            <div className="integration-list">
              {integrations.map((integration) => {
                const isConnected = connectedApps.includes(integration.name);
                return (
                <div className="integration-card" key={integration.name}>
                  <div>
                    <div className="integration-top">
                      <h3>{integration.name}</h3>
                      <StatusPill tone={isConnected ? 'st-ok' : 'st-warning'}>{isConnected ? 'Connected' : 'Available'}</StatusPill>
                    </div>
                    <p>{integration.description}</p>
                    <div className="integration-meta">
                      <span>{integration.type}</span>
                      <span>{integration.lastSync}</span>
                    </div>
                  </div>
                  <button className="pill" type="button" onClick={() => handleIntegrationAction(integration)} disabled={isConnected && integration.name !== 'Google Sheets'}>{isConnected && integration.name !== 'Google Sheets' ? 'Connected' : integration.primaryAction} <ChevronRight /></button>
                </div>
                );
              })}
            </div>
          </Card>

          <Card title="Google Sheets Sync">
            <div className="sheet-tabs">
              {sheetTabs.map((tab) => (
                <button
                  key={tab}
                  className={`sheet-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="sheet-panel">
              <div className="sheet-copy">
                <strong>Google Sheets setup for {activeTab.toLowerCase()}.</strong>
                <p>Every change in the CRM can be pushed into a Google Sheet after provider credentials and webhook delivery are configured.</p>
                <ActionMenu label="Sheet Actions" items={[
                  { label: 'Check setup', description: 'Review credential readiness', onClick: () => setSyncMessage(`Google credentials are required before ${activeTab} can sync automatically.`) },
                  { label: 'Open Google Sheets', description: `Open a sheet for ${activeTab}`, onClick: () => { setSyncMessage(`Google Sheets opened for ${activeTab}.`); window.open('https://docs.google.com/spreadsheets/', '_blank', 'noopener,noreferrer'); } },
                ]} />
              </div>
              <div className="sheet-form">
                <div className="mini-stat">
                  <span>Sync direction</span>
                  <strong>CRM → Google Sheets</strong>
                </div>
                <div className="mini-stat">
                  <span>Columns mapped</span>
                  <strong>12 fields</strong>
                </div>
                <div className="mini-stat">
                  <span>Update frequency</span>
                  <strong>After setup</strong>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Recent Sync Activity" subtitle="What moved between systems in the last few minutes.">
          <div className="table adaptive-table" style={{ '--table-columns': 4 }}>
            <div className="table-head">
              <div>Time</div>
              <div>Record</div>
              <div>Action</div>
              <div>Target</div>
              <div />
            </div>
            {preview.length ? (
              preview.map((row) => (
                <div className="data-row" key={row[0] + row[1]}>
                  <div>{row[0]}</div>
                  <div>{row[1]}</div>
                  <div>{row[2]}</div>
                  <div><Tag tone="tag-contacted">{row[3]}</Tag></div>
                  <div><button className="row-link" type="button" onClick={() => setSyncMessage(`Reviewed sync activity for ${row[1]}.`)}>Review</button></div>
                </div>
              ))
            ) : (
              <div className="empty-state compact-empty table-empty">
                <strong>No sync activity yet.</strong>
                <p>Connect Google Sheets or another app to start streaming live events here.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

export function BranchesPage() {
  const { branches, currentBranch, setCurrentBranch, addBranch, renameBranch, deleteBranch } = useBranch();
  const [branchName, setBranchName] = useState('');
  const [message, setMessage] = useState('Create a branch to keep data separate.');

  const createBranch = () => {
    const ok = addBranch(branchName);
    if (!ok) {
      setMessage('Please enter a branch name.');
      return;
    }
    setMessage(`Branch "${branchName.trim()}" created and activated.`);
    setBranchName('');
  };

  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <h1>Branches</h1>
          <p>Create and switch branches so each location keeps its own data, leads, users, and uploads separate.</p>
          <p className="subtle">Current branch: {currentBranch}</p>
        </div>
        <div className="module-stats">
          <div className="mini-stat"><span>Branches</span><strong>{branches.length}</strong></div>
          <div className="mini-stat"><span>Active</span><strong>{currentBranch}</strong></div>
          <div className="mini-stat"><span>Status</span><strong>{message}</strong></div>
        </div>
      </div>

      <Card title="Create Branch" subtitle="Each branch gets its own stored data.">
        <div className="sheet-actions">
          <input className="lead-input" value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="Enter branch name" />
          <button className="pill" type="button" onClick={createBranch}>Create Branch <ChevronRight /></button>
        </div>
      </Card>

      <Card title="Branch List" subtitle="Switching branches updates the whole app data scope.">
        <div className="table adaptive-table" style={{ '--table-columns': 2 }}>
          <div className="table-head">
            <div>Branch</div>
            <div>Status</div>
            <div />
          </div>
          {branches.map((branch) => {
            const active = branch === currentBranch;
            return (
              <div className="data-row" key={branch}>
                <div>{branch}</div>
                <div><StatusPill tone={active ? 'st-ok' : 'st-warning'}>{active ? 'Active' : 'Saved'}</StatusPill></div>
                <div>
                  <ActionMenu compact label={`Actions for ${branch}`} items={[
                    {
                      label: active ? 'Current branch' : 'Activate branch',
                      description: active ? 'This branch is already active' : 'Switch the entire app to this branch',
                      disabled: active,
                      onClick: () => { setCurrentBranch(branch); setMessage(`${branch} activated.`); },
                    },
                    {
                      label: 'Rename branch',
                      onClick: () => {
                        const next = window.prompt('Rename branch', branch);
                        if (!next) return;
                        const ok = renameBranch(branch, next);
                        setMessage(ok ? `Renamed to ${next.trim()}.` : 'Rename failed.');
                      },
                    },
                    {
                      label: 'Delete branch',
                      description: 'Remove it from the branch list',
                      danger: true,
                      onClick: () => {
                        if (branches.length === 1) {
                          setMessage('At least one branch must remain.');
                          return;
                        }
                        if (!window.confirm(`Delete branch "${branch}"? Its branch data stays in storage but will no longer be selected.`)) return;
                        deleteBranch(branch);
                        setMessage(`${branch} removed from branch list.`);
                      },
                    },
                  ]} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

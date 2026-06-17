import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight } from '../components/icons.jsx';
import { Card, StatusPill, Tag } from '../components/ui.jsx';
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
} from '../data/mockData.js';

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
}) {
  const navigate = useNavigate();
  const storageKey = `ayurflow:${filenameBase}:rows:v2`;
  const [rows, setRows] = useState(() => loadSavedState(storageKey, seedRows));
  const [preview, setPreview] = useState([]);
  const [uploadName, setUploadName] = useState('No file selected');
  const [message, setMessage] = useState('Ready to import or export data.');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [activeFilter, setActiveFilter] = useState(filterPresets[0]?.column ?? '');
  const bannerFileInputRef = useRef(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch {
      setMessage('Local browser storage is full or blocked.');
    }
  }, [rows, storageKey]);

  const rowToCsvValues = (row) => {
    const values = rowToValues(row);
    return headers.map((header) => values[header] ?? '');
  };

  const exportCsv = () => {
    downloadText(`${filenameBase}.csv`, rowsToCsv(headers, rows.map(rowToCsvValues)), 'text/csv;charset=utf-8');
    setMessage('CSV export started.');
  };

  const downloadSample = () => {
    const sampleRow = rows[0] ? rowToCsvValues(rows[0]) : headers.map(() => '');
    downloadText(`${filenameBase}-sample.csv`, rowsToCsv(headers, [sampleRow]), 'text/csv;charset=utf-8');
    setMessage('Sample CSV downloaded.');
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
    const normalized = parsed
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

      <Card title="Import / Export" className="compact-action-card single-row-actions">
        <div className="import-banner compact-import-banner">
          <input ref={bannerFileInputRef} className="hidden-file-input" type="file" accept=".csv,.json" onChange={async (event) => handleFile(event.target.files?.[0])} />
          <button className="pill" type="button" onClick={downloadSample}>Sample <ChevronRight /></button>
          <button className="pill" type="button" onClick={() => bannerFileInputRef.current?.click()}>Import <ChevronRight /></button>
          <button className="pill" type="button" onClick={exportCsv}>Export <ChevronRight /></button>
        </div>
      </Card>

      {extraTopCard}

      {filterPresets.length > 0 && (
        <Card title="Filters" className="compact-action-card">
          <div className="module-toolbar">
            <div className="sheet-actions toolbar-actions">
              <button className="pill" type="button" onClick={() => setFilterOpen((current) => !current)}>Filter <ChevronRight /></button>
              <button className="pill" type="button" onClick={() => { setActiveFilter(filterPresets[0]?.column ?? ''); setFilterText(''); setMessage('Filters reset.'); }}>Reset <ChevronRight /></button>
            </div>
          </div>
          {filterOpen && (
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
          )}
        </Card>
      )}

      <div className="grid single-module-grid">
        <Card title={`Current ${title}`} subtitle={`Live records currently stored in ${title.toLowerCase()}.`}>
          <div className="table">
            <div className="table-head">
              {headers.map((header) => <div key={header}>{header}</div>)}
              <div />
            </div>
            {filteredRows.length ? filteredRows.map((row, index) => (
              <div className="data-row" key={index}>
                {headers.map((header) => <div key={header}>{rowToValues(row)[header]}</div>)}
                <div>{rowActions ? rowActions(row) : defaultRowAction(row)}</div>
              </div>
            )) : (
              <div className="empty-state compact-empty table-empty">
                <strong>No records yet.</strong>
                <p>Import a file or add records to populate this table.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

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
            <div className="modal-table">
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
              <button className="pill" type="button" onClick={commitImport} disabled={!preview.length}>Import Now <ChevronRight /></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function CRMPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('leads');
  const [manualLeads, setManualLeads] = useState([]);
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

  const addManualLead = () => {
    if (!leadForm.name.trim()) return;
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
    const normalized = parsed.map(normalizeLead).filter((lead) => lead.name);
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

  return (
    <section className="module-page">
      <div className="module-hero">
        <div>
          <h1>CRM</h1>
          <p>Track leads, follow-ups, and conversion activity without showing upload tools until you need them.</p>
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
        <>
          <Card title="Lead Actions" subtitle="Only the daily CRM actions stay visible here.">
            <div className="sheet-actions">
              <button className="pill" type="button" onClick={openCreateLead}>Add Lead <ChevronRight /></button>
              <button className="pill" type="button" onClick={() => setShowLeads((current) => !current)}>{showLeads ? 'Hide Leads' : 'Show Leads'} <ChevronRight /></button>
              <div className="mini-stat"><span>Manual leads</span><strong>{manualLeads.length}</strong></div>
            </div>
          </Card>

        <Card title="Current Leads" subtitle="Manual leads are editable. Seeded leads stay read-only.">
            {showLeads ? (
              <div className="table">
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
                          <div className="row-actions">
                            <button type="button" className="row-link" onClick={() => startEditLead(manualLeads[lead.__manualIndex], lead.__manualIndex)}>Edit</button>
                            <button type="button" className="row-link danger" onClick={() => deleteManualLead(lead.__manualIndex)}>Delete</button>
                          </div>
                        ) : (
                          <button type="button" className="row-link" onClick={() => setSelectedRecord(lead)}>View</button>
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
                <p>Use Show Leads when you want the full CRM list back on screen.</p>
              </div>
            )}
          </Card>
        </>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '1fr 0.9fr', alignItems: 'start' }}>
          <Card title="Import / Export Leads" subtitle="Hidden from the main CRM view to keep daily work clean.">
            <div className="import-banner">
              <div>
                <strong>Spreadsheet tools are ready.</strong>
                <p>Export the current leads or import a CSV/JSON file when the team needs bulk updates.</p>
              </div>
              <div className="sheet-actions">
                <button className="pill" type="button" onClick={exportCsv}>Export CSV <ChevronRight /></button>
                <button className="pill" type="button" onClick={exportJson}>Export JSON <ChevronRight /></button>
              </div>
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
                <button className="pill" type="button" onClick={() => setModalOpen(true)} disabled={!preview.length}>Open Preview <ChevronRight /></button>
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
            <div className="modal-table">
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
              <button className="pill" type="button" onClick={commitImport} disabled={!preview.length}>Import Now <ChevronRight /></button>
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
              <button className="pill" type="button" onClick={addManualLead} disabled={!leadForm.name.trim()}>
                {editingIndex === null ? 'Add Lead' : 'Save Lead'} <ChevronRight />
              </button>
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

export function ClientsPage() {
  return (
    <ImportExportModule
      title="Clients"
      description="View active client profiles, treatment progress, and upcoming visit timelines."
      stats={[
        { label: 'Active Clients', value: '0' },
        { label: 'Treatment Plans', value: '0' },
        { label: 'Next Visits', value: '0' },
      ]}
      headers={['Client', 'Age', 'Program', 'Progress', 'Next Visit']}
      seedRows={clients}
      filenameBase="ayurflow-clients"
      filterPresets={[
        { label: 'Name wise', column: 'Client' },
        { label: 'Age wise', column: 'Age' },
        { label: 'Program wise', column: 'Program' },
        { label: 'Progress wise', column: 'Progress' },
        { label: 'Next visit wise', column: 'Next Visit' },
      ]}
      rowToValues={(row) => ({
        Client: row.name,
        Age: row.age,
        Program: row.program,
        Progress: row.progress,
        'Next Visit': row.nextVisit,
      })}
      parseRow={(entry) => ({
        name: entry.Client ?? entry.client ?? entry.name ?? '',
        age: entry.Age ?? entry.age ?? '',
        program: entry.Program ?? entry.program ?? '',
        progress: entry.Progress ?? entry.progress ?? '',
        nextVisit: entry['Next Visit'] ?? entry.nextVisit ?? '',
      })}
    />
  );
}

export function PaymentsPage() {
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
  const [people, setPeople] = useState(() => loadSavedState('ayurflow:users:rows:v2', users));
  const [uploadName, setUploadName] = useState('No file selected');
  const [importPreview, setImportPreview] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Ready to import or export users.');
  const [dropActive, setDropActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem('ayurflow:users:rows:v2', JSON.stringify(people));
    } catch {
      setStatusMessage('Local browser storage is full or blocked.');
    }
  }, [people]);

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
      setStatusMessage('Import failed. Please upload a valid CSV or JSON file.');
      return;
    }
    const normalized = parsed.map((entry) => ({
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

      <Card title="Import / Export Banner" subtitle="Bring users in from a spreadsheet or download the roster for backup.">
        <div className="import-banner">
          <div>
            <strong>Multi-user upload is ready.</strong>
            <p>Upload a CSV/JSON file containing multiple staff records, review the preview, then import them into the app.</p>
          </div>
          <div className="sheet-actions">
            <button className="pill" onClick={exportCsv} type="button">Export CSV <ChevronRight /></button>
            <button className="pill" onClick={exportJson} type="button">Export JSON <ChevronRight /></button>
          </div>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: '1fr 0.9fr', alignItems: 'start' }}>
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
              <button className="pill" type="button" onClick={() => setModalOpen(true)} disabled={!importPreview.length}>Open Preview <ChevronRight /></button>
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

        <Card title="Current Team" subtitle="Live roster in the app right now.">
          <div className="table">
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
      </div>

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
            <div className="modal-table">
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
              <button className="pill" type="button" onClick={importUsers} disabled={!importPreview.length}>Import Now <ChevronRight /></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ModuleHubPage({ title, description, tabs, defaultTab }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
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
  const storageKey = `ayurflow:${title}:tabs:v2`;
  const [rowsByTab, setRowsByTab] = useState(() => loadSavedState(storageKey, Object.fromEntries(tabs.map((tab) => [tab.id, tab.rows]))));
  const importInputRef = useRef(null);

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const activeRows = rowsByTab[active.id] ?? active.rows;

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(rowsByTab));
    } catch {
      setMessage('Local browser storage is full or blocked.');
    }
  }, [rowsByTab, storageKey]);

  const filteredRows = activeRows.filter((row) => {
    if (!filterText) return true;
    if (!activeFilter) return row.join(' ').toLowerCase().includes(filterText.toLowerCase());
    const index = active.columns.indexOf(activeFilter);
    if (index === -1) return row.join(' ').toLowerCase().includes(filterText.toLowerCase());
    return String(row[index] ?? '').toLowerCase().includes(filterText.toLowerCase());
  });

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
    setFilterText('');
    setMessage(`${tabs.find((tab) => tab.id === tabId)?.label ?? title} opened.`);
  };

  const runAction = (action) => {
    if (action === 'Add') {
      setDraftRow(active.columns.map((column, index) => {
        if (index === 0) return `${active.label} ${activeRows.length + 1}`;
        if (column === 'Status') return 'Pending';
        if (column === 'Duration') return '30 min';
        if (column === 'Type') return 'Consultation';
        return '';
      }));
      setAddOpen(true);
      setMessage(`New ${active.singular ?? active.label} form opened.`);
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

  const saveDraft = () => {
    setRowsByTab((current) => ({
      ...current,
      [active.id]: [draftRow, ...(current[active.id] ?? activeRows)],
    }));
    setMessage(`${draftRow[0] || active.label} added.`);
    setAddOpen(false);
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    setRowsByTab((current) => {
      const next = [...(current[active.id] ?? activeRows)];
      next[editIndex] = editRow;
      return { ...current, [active.id]: next };
    });
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
    setEditRow([...row]);
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
    const normalized = parsed
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

      <Card title={`${title} Menu`} subtitle="Sub-pages are kept inside tabs so the sidebar stays clean.">
        <input ref={importInputRef} className="hidden-file-input" type="file" accept=".csv,.json" onChange={async (event) => handleFile(event.target.files?.[0])} />
        <div className="module-toolbar">
          <div className="sheet-tabs compact-tabs">
            {tabs.map((tab) => (
              <button className={`sheet-tab ${active.id === tab.id ? 'active' : ''}`} type="button" key={tab.id} onClick={() => selectTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="sheet-actions toolbar-actions">
            {['Add', 'Import', 'Export', 'Filter', 'Share'].map((action) => (
              <button className="pill" type="button" key={action} onClick={() => runAction(action)}>{action} <ChevronRight /></button>
            ))}
          </div>
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

      <Card title={active.title ?? active.label} subtitle={active.description}>
        <div className="data-table">
          <div className="table-head">
            {active.columns.map((column) => <div key={column}>{column}</div>)}
            <div />
          </div>
          {filteredRows.length ? (
            filteredRows.map((row, index) => (
              <div className="data-row" key={`${active.id}-${index}`}>
                {row.map((cell) => <div key={`${cell}-${index}`}>{cell}</div>)}
                <div><button className="row-link" type="button" onClick={() => openEdit(row)}>Open</button></div>
              </div>
            ))
          ) : (
            <div className="empty-state compact-empty table-empty">
              <strong>No records yet.</strong>
              <p>Add or import the first row to unlock this section.</p>
            </div>
          )}
        </div>
      </Card>

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
                  <input
                    className="lead-input"
                    value={draftRow[index] ?? ''}
                    onChange={(event) => setDraftRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? event.target.value : cell)))}
                    placeholder={`Enter ${column.toLowerCase()}`}
                  />
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
            <div className="modal-body detail-grid">
              {active.columns.map((column, index) => (
                <label className="field-block" key={column}>
                  <span>{column}</span>
                  <input
                    className="lead-input"
                    value={editRow[index] ?? ''}
                    onChange={(event) => setEditRow((current) => current.map((cell, cellIndex) => (cellIndex === index ? event.target.value : cell)))}
                    placeholder={`Enter ${column.toLowerCase()}`}
                  />
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
            <div className="modal-table">
              <div className="table-head">
                {active.columns.map((column) => <div key={column}>{column}</div>)}
                <div />
              </div>
              {previewRows.length ? (
                previewRows.map((row, index) => (
                  <div className="data-row" key={index}>
                    {row.map((cell) => <div key={`${cell}-${index}`}>{cell}</div>)}
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
    description: 'Client journeys, goals, services, and therapy progress.',
    columns: ['Client', 'Service', 'Goal', 'Duration', 'Status'],
    rows: treatmentPlans.map((plan) => [plan.client, plan.service, plan.goal, plan.duration, plan.status]),
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

export function FormsPage() {
  return (
    <GenericModulePage
      title="Forms"
      description="Manage clinic intake forms, assessments, and registration templates from one place."
      stats={[
        { label: 'Forms live', value: '0' },
        { label: 'Drafts', value: '0' },
        { label: 'Published', value: '0' },
      ]}
      columns={['Form', 'Status', 'Updated']}
      rows={[]}
    />
  );
}

export function AppointmentsPage() {
  return (
    <GenericModulePage
      title="Appointments"
      description="Track booking slots, confirmations, and visit flow across the day."
      stats={[
        { label: 'Today', value: '0' },
        { label: 'Confirmed', value: '0' },
        { label: 'Pending', value: '0' },
      ]}
      columns={['Client', 'Mobile', 'Date', 'Time', 'Type', 'Status']}
      rows={[]}
      fieldOptions={{ Type: services }}
      filterPresets={[
        { label: 'Date wise', column: 'Date' },
        { label: 'Type wise', column: 'Type' },
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
      rowActions={(row, setSelectedRow, setActionMessage) => (
        <div className="row-actions">
          <button className="row-link" type="button" onClick={() => setSelectedRow(row[0])}>View</button>
          <button
            className="row-link"
            type="button"
            onClick={() => {
              const phone = String(row[1] ?? '').replace(/\D/g, '');
              const text = encodeURIComponent(`Hello ${row[0]}, your appointment for ${row[4]} on ${row[2]} at ${row[3]} is scheduled.`);
              if (!phone) {
                setActionMessage('Mobile number is missing.');
                return;
              }
              setActionMessage(`Opening WhatsApp for ${row[0]}.`);
              window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer');
            }}
          >
            WhatsApp
          </button>
        </div>
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
  return (
    <GenericModulePage
      title="Treatment Plans"
      description="Track client treatment journeys, goals, therapy schedules, progress, and consultant notes."
      stats={[
        { label: 'Active Plans', value: treatmentPlans.filter((plan) => plan.status === 'Active').length },
        { label: 'Paused', value: treatmentPlans.filter((plan) => plan.status === 'Paused').length },
        { label: 'Renewals', value: treatmentPlans.filter((plan) => plan.status === 'Renewed').length },
      ]}
      columns={['Client', 'Service', 'Goal', 'Duration', 'Status']}
      rows={treatmentPlans.map((plan) => [plan.client, plan.service, plan.goal, plan.duration, plan.status])}
    />
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
  const [activeReport, setActiveReport] = useState('appointments');
  const [financeSubTab, setFinanceSubTab] = useState('payments');

  const today = new Date().toISOString().slice(0, 10);
  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  // Load data from all localStorage sources (standalone + hub)
  const opsTabs = loadSavedState('ayurflow:Operations:tabs:v2', {});
  const finTabs = loadSavedState('ayurflow:Finance:tabs:v2', {});

  const appointmentRows = loadSavedState('ayurflow:Appointments:rows:v2', []);

  const treatmentRows = [
    ...loadSavedState('ayurflow:Treatment Plans:rows:v2', []),
    ...(opsTabs.treatments ?? []),
  ];

  const formRows = [
    ...loadSavedState('ayurflow:Forms:rows:v2', []),
    ...(opsTabs.forms ?? []),
  ];

  const inventoryRows = [
    ...loadSavedState('ayurflow:Inventory:rows:v2', []),
    ...(opsTabs.inventory ?? []),
  ];

  const paymentObjRows = loadSavedState('ayurflow:ayurflow-payments:rows:v2', [])
    .map((p) => [p.client ?? '', p.invoice ?? '', p.amount ?? '', p.status ?? '', p.paidOn ?? '']);
  const paymentRows = [...(finTabs.payments ?? []), ...paymentObjRows];

  const accountRows = [
    ...(finTabs.accounts ?? []),
    ...loadSavedState('ayurflow:Accounts:rows:v2', []),
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
        <Card title={currentReport.title} subtitle={`${currentReport.rows.length} record${currentReport.rows.length !== 1 ? 's' : ''} found`}>
          <div className="sheet-actions" style={{ marginBottom: 14 }}>
            <button className="pill" type="button" onClick={exportExcel}>Export Excel <ChevronRight /></button>
            <button className="pill" type="button" onClick={exportPdf}>Export PDF <ChevronRight /></button>
            <button className="pill" type="button" onClick={exportCsv}>Export CSV <ChevronRight /></button>
          </div>
          <div className="data-table">
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
  const [syncMessage, setSyncMessage] = useState('Google Sheets sync is healthy.');
  const preview = useMemo(() => syncPreviewRows, []);

  const handleIntegrationAction = async (integration) => {
    if (integration.name === 'Google Sheets') {
      setSyncMessage('Sample Google Sheet opened in a new tab.');
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
          <p>Connect AyurFlow CRM to Google Sheets or other tools so your team can keep using the apps they already rely on.</p>
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

      <div className="grid" style={{ gridTemplateColumns: '1.15fr 0.85fr', alignItems: 'start' }}>
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
                <strong>Auto-sync enabled for {activeTab.toLowerCase()}.</strong>
                <p>Every change in the CRM can be pushed into a Google Sheet so your staff can continue reporting in spreadsheets without duplicate entry.</p>
                <div className="sheet-actions">
                  <button className="pill" type="button" onClick={() => { setConnectedApps((current) => Array.from(new Set([...current, 'Google Sheets']))); setSyncMessage(`Google account connected for ${activeTab}.`); }}>Connect Google Account <ChevronRight /></button>
                  <button className="pill" type="button" onClick={() => { setSyncMessage(`Sample sheet opened for ${activeTab}.`); window.open('https://docs.google.com/spreadsheets/', '_blank', 'noopener,noreferrer'); }}>Open Sample Sheet <ChevronRight /></button>
                </div>
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
                  <strong>Every 2 min</strong>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Recent Sync Activity" subtitle="What moved between systems in the last few minutes.">
          <div className="table">
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





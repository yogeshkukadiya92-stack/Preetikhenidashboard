import { useMemo, useState } from 'react';
import { ChevronRight } from '../components/icons.jsx';
import { Card, StatusPill, Tag } from '../components/ui.jsx';
import { GenericModulePage } from './GenericModulePage.jsx';
import { clients, forms, integrations, leads, payments, sheetTabs, syncPreviewRows, users } from '../data/mockData.js';

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

function ImportExportModule({
  title,
  description,
  stats,
  headers,
  seedRows,
  filenameBase,
  rowToValues,
  parseRow,
  extraTopCard = null,
  customRows = null,
  rowActions = null,
}) {
  const [rows, setRows] = useState(seedRows);
  const [preview, setPreview] = useState([]);
  const [uploadName, setUploadName] = useState('No file selected');
  const [message, setMessage] = useState('Ready to import or export data.');
  const [dropActive, setDropActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const exportCsv = () => {
    downloadText(`${filenameBase}.csv`, rowsToCsv(headers, rows.map(rowToValues)), 'text/csv;charset=utf-8');
    setMessage('CSV export started.');
  };

  const exportJson = () => {
    downloadText(`${filenameBase}.json`, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8');
    setMessage('JSON export started.');
  };

  const normalize = (entry) => parseRow(entry);

  const handleFile = async (file) => {
    if (!file) return;
    setUploadName(file.name);
    const text = await file.text();
    let parsed = [];
    if (file.name.toLowerCase().endsWith('.json')) {
      parsed = JSON.parse(text);
    } else {
      parsed = parseCsv(text);
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

      <Card title="Import / Export Banner" subtitle={`Bring ${title.toLowerCase()} in from a spreadsheet or download the current records.`}>
        <div className="import-banner">
          <div>
            <strong>Bulk upload ready.</strong>
            <p>Drop a CSV or JSON file, review the preview, and import records directly into the module.</p>
          </div>
          <div className="sheet-actions">
            <button className="pill" onClick={exportCsv} type="button">Export CSV <ChevronRight /></button>
            <button className="pill" onClick={exportJson} type="button">Export JSON <ChevronRight /></button>
          </div>
        </div>
      </Card>

      {extraTopCard}

      <div className="grid" style={{ gridTemplateColumns: '1fr 0.9fr', alignItems: 'start' }}>
        <Card title={`Bulk Upload ${title}`} subtitle={`Choose a .csv or .json file with the ${headers.join(', ')} columns.`}>
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
              <button className="pill" type="button" onClick={() => setModalOpen(true)} disabled={!preview.length}>Open Preview <ChevronRight /></button>
              <button className="pill" type="button" onClick={() => setPreview([])}>Clear Preview <ChevronRight /></button>
            </div>

            <div className="mini-stat">
              <span>Status</span>
              <strong>{message}</strong>
            </div>
            <div className="mini-stat">
              <span>Upload</span>
              <strong>{uploadName}</strong>
            </div>
          </div>
        </Card>

        <Card title={`Current ${title}`} subtitle={`Live records currently stored in ${title.toLowerCase()}.`}>
          <div className="table">
            <div className="table-head">
              {headers.map((header) => <div key={header}>{header}</div>)}
              <div />
            </div>
            {visibleRows.map((row, index) => (
              <div className="data-row" key={index}>
                {headers.map((header) => <div key={header}>{rowToValues(row)[header]}</div>)}
                <div>{rowActions ? rowActions(row) : '⋯'}</div>
              </div>
            ))}
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
                  <div>{rowActions ? rowActions(row) : '⋯'}</div>
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
  const [manualLeads, setManualLeads] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: '',
    source: 'Website',
    status: 'New',
    score: '',
    addedOn: 'Today',
  });

  const leadRows = [
    ...manualLeads.map((lead, index) => ({ ...lead, __manual: true, __manualIndex: index })),
    ...leads.slice(0, 5).map((lead) => ({ ...lead, __manual: false })),
  ];

  const resetLeadForm = () => {
    setLeadForm({
      name: '',
      source: 'Website',
      status: 'New',
      score: '',
      addedOn: 'Today',
    });
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
    resetLeadForm();
    setLeadModalOpen(false);
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

  return (
    <>
      <ImportExportModule
        title="CRM"
        description="Track leads, assign follow-ups, and keep every potential client moving through the pipeline."
        stats={[
          { label: 'Open Leads', value: '42' },
          { label: 'Hot Leads', value: '14' },
          { label: 'Follow-ups Today', value: '27' },
        ]}
        headers={['Lead', 'Source', 'Status', 'Score', 'Added On']}
        seedRows={leads.slice(0, 5)}
        filenameBase="ayurflow-leads"
        rowToValues={(row) => ({
          Lead: row.name,
          Source: row.source,
          Status: row.status,
          Score: row.score,
          'Added On': row.addedOn,
        })}
        parseRow={(entry) => ({
          name: entry.Lead ?? entry.lead ?? entry.name ?? '',
          source: entry.Source ?? entry.source ?? '',
          status: entry.Status ?? entry.status ?? '',
          score: entry.Score ?? entry.score ?? '',
          addedOn: entry['Added On'] ?? entry.addedOn ?? '',
        })}
        extraTopCard={(
          <Card title="Manual Lead Actions" subtitle="Open a popup form to add or edit a lead.">
            <div className="sheet-actions">
              <button className="pill" type="button" onClick={openCreateLead}>
                Add Lead <ChevronRight />
              </button>
              <div className="mini-stat">
                <span>Manual leads</span>
                <strong>{manualLeads.length}</strong>
              </div>
            </div>
          </Card>
        )}
        customRows={leadRows.map((lead) => ({
          Lead: lead.name,
          Source: lead.source,
          Status: lead.status,
          Score: lead.score,
          'Added On': lead.addedOn,
          __manual: lead.__manual,
          __manualIndex: lead.__manualIndex,
        }))}
        rowActions={(row) => {
          if (!row.__manual) return <Tag tone={leadPriorityTone(row.Status)}>{row.Status}</Tag>;
          return (
            <div className="row-actions">
              <Tag tone={leadPriorityTone(row.Status)}>{row.Status}</Tag>
              <button type="button" className="row-link" onClick={() => startEditLead(manualLeads[row.__manualIndex], row.__manualIndex)}>Edit</button>
              <button type="button" className="row-link danger" onClick={() => deleteManualLead(row.__manualIndex)}>Delete</button>
            </div>
          );
        }}
      />

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
    </>
  );
}

export function ClientsPage() {
  return (
    <ImportExportModule
      title="Clients"
      description="View active client profiles, treatment progress, and upcoming visit timelines."
      stats={[
        { label: 'Active Clients', value: '128' },
        { label: 'Treatment Plans', value: '74' },
        { label: 'Next Visits', value: '19' },
      ]}
      headers={['Client', 'Age', 'Program', 'Progress', 'Next Visit']}
      seedRows={clients}
      filenameBase="ayurflow-clients"
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
        { label: 'Collected Today', value: '₹ 19,500' },
        { label: 'Pending', value: '₹ 68,450' },
        { label: 'Invoices', value: '36' },
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
  const [people, setPeople] = useState(users);
  const [uploadName, setUploadName] = useState('No file selected');
  const [importPreview, setImportPreview] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Ready to import or export users.');
  const [dropActive, setDropActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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
    if (file.name.toLowerCase().endsWith('.json')) {
      parsed = JSON.parse(text);
    } else {
      parsed = parseCsv(text);
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
              <button className="pill" type="button" onClick={() => setImportPreview([])}>Clear Preview <ChevronRight /></button>
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
            {people.map((user) => (
              <div className="data-row" key={user.email}>
                <div>{user.name}</div>
                <div>{user.role}</div>
                <div>{user.email}</div>
                <div><Tag tone={user.status === 'Active' ? 'tag-contacted' : 'tag-follow'}>{user.status}</Tag></div>
                <div>⋯</div>
              </div>
            ))}
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
              {importPreview.map((item) => (
                <div className="data-row" key={`${item.email}-${item.name}`}>
                  <div>{item.name}</div>
                  <div>{item.role}</div>
                  <div>{item.email}</div>
                  <div><Tag tone={item.status === 'Active' ? 'tag-contacted' : 'tag-follow'}>{item.status}</Tag></div>
                  <div>⋯</div>
                </div>
              ))}
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

export function FormsPage() {
  return (
    <GenericModulePage
      title="Forms"
      description="Manage clinic intake forms, assessments, and registration templates from one place."
      stats={[
        { label: 'Forms live', value: '14' },
        { label: 'Drafts', value: '6' },
        { label: 'Published', value: '8' },
      ]}
      columns={['Form', 'Status', 'Updated']}
      rows={forms.map((form) => [form.title, form.status, form.updated])}
    />
  );
}

export function AppointmentsPage() {
  return (
    <GenericModulePage
      title="Appointments"
      description="Track booking slots, confirmations, and visit flow across the day."
      stats={[
        { label: 'Today', value: '18' },
        { label: 'Confirmed', value: '12' },
        { label: 'Pending', value: '6' },
      ]}
      columns={['Client', 'Time', 'Type', 'Status']}
      rows={[
        ['Anjali Menon', '09:00 AM', 'Consultation', 'Confirmed'],
        ['Ramesh Kumar', '09:45 AM', 'Follow-up', 'Confirmed'],
        ['Sneha Nair', '10:30 AM', 'Panchakarma', 'In Progress'],
        ['Vikram Pillai', '11:30 AM', 'Consultation', 'Confirmed'],
      ]}
    />
  );
}

export function ReportsPage() {
  return (
    <GenericModulePage
      title="Reports"
      description="Review clinic performance, revenue patterns, and team activity snapshots."
      stats={[
        { label: 'This month', value: '92%' },
        { label: 'Conversion', value: '28%' },
        { label: 'Collections', value: 'â‚¹ 1.8L' },
      ]}
      columns={['Report', 'Owner', 'Period', 'Status']}
      rows={[
        ['Lead Performance', 'CRM Team', 'May 2025', 'Ready'],
        ['Revenue Summary', 'Finance', 'May 2025', 'Ready'],
        ['Visit Trends', 'Front Desk', 'May 2025', 'Draft'],
        ['Follow-up Health', 'Operations', 'Weekly', 'Ready'],
      ]}
    />
  );
}

export function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState(sheetTabs[0]);
  const preview = useMemo(() => syncPreviewRows, []);

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
            <strong>1 live, 2 ready</strong>
          </div>
          <div className="mini-stat">
            <span>Sync status</span>
            <strong>Healthy</strong>
          </div>
          <div className="mini-stat">
            <span>Rows synced today</span>
            <strong>84</strong>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.15fr 0.85fr', alignItems: 'start' }}>
        <div className="stack">
          <Card title="Connected & Available Apps" subtitle="Pick one to connect or extend the CRM outward.">
            <div className="integration-list">
              {integrations.map((integration) => (
                <div className="integration-card" key={integration.name}>
                  <div>
                    <div className="integration-top">
                      <h3>{integration.name}</h3>
                      <StatusPill tone={integration.status === 'Connected' ? 'st-ok' : 'st-warning'}>{integration.status}</StatusPill>
                    </div>
                    <p>{integration.description}</p>
                    <div className="integration-meta">
                      <span>{integration.type}</span>
                      <span>{integration.lastSync}</span>
                    </div>
                  </div>
                  <button className="pill">{integration.primaryAction} <ChevronRight /></button>
                </div>
              ))}
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
                  <button className="pill">Connect Google Account <ChevronRight /></button>
                  <button className="pill">Open Sample Sheet <ChevronRight /></button>
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
            {preview.map((row) => (
              <div className="data-row" key={row[0] + row[1]}>
                <div>{row[0]}</div>
                <div>{row[1]}</div>
                <div>{row[2]}</div>
                <div><Tag tone="tag-contacted">{row[3]}</Tag></div>
                <div>⋯</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

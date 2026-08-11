import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionMenu, Card, StatusPill, Tag } from '../components/ui.jsx';
import { ChevronRight, SearchIcon } from '../components/icons.jsx';
import { loadLiveDashboardData, parseLiveAmount } from '../data/liveData.js';
import { useBranch } from '../context/BranchContext.jsx';

const DATE_PRESETS = [
  { label: 'Today', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: 'All Time', days: null },
];

const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function paymentPaidAmount(payment) {
  const explicitPaid = payment?.paidAmount ?? payment?.['Paid Amount'];
  if (explicitPaid !== undefined && explicitPaid !== '') return parseLiveAmount(explicitPaid);
  return normalizeStatus(payment?.status) === 'paid' ? parseLiveAmount(payment?.amount ?? payment?.['Total Amount']) : 0;
}

function paymentPendingAmount(payment) {
  if (normalizeStatus(payment?.status) === 'paid') return 0;
  return Math.max(parseLiveAmount(payment?.amount ?? payment?.['Total Amount']) - paymentPaidAmount(payment), 0);
}

function KpiIcon({ accent }) {
  return (
    <div className={`metric-icon m-${accent}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7.5 3.8V6m9-2.2V6M5.8 9.2h12.4M6 4.8h12A1.8 1.8 0 0 1 19.8 6.6V18a1.8 1.8 0 0 1-1.8 1.8H6A1.8 1.8 0 0 1 4.2 18V6.6A1.8 1.8 0 0 1 6 4.8Z" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { currentBranch } = useBranch();
  const [datePreset, setDatePreset] = useState('7 Days');
  const [customDateRange, setCustomDateRange] = useState(null);
  const [moreInsightsOpen, setMoreInsightsOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [dataRevision, setDataRevision] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toLocalIsoDate(new Date()));
  const liveData = useMemo(() => loadLiveDashboardData(currentBranch), [currentBranch, dataRevision]);
  const { leads, payments, todaySchedule, urgentTasks, appointments, clients, inventory, packages, staff, treatments } = liveData;
  const normalizedPatients = useMemo(() => clients.map(normalizeDashboardPatient).filter((patient) => patient.name), [clients]);
  const patientResults = useMemo(() => {
    const query = patientSearch.trim().toLowerCase();
    if (!query) return [];
    return normalizedPatients
      .filter((patient) => [patient.id, patient.name, patient.mobile, patient.service].join(' ').toLowerCase().includes(query))
      .slice(0, 8);
  }, [normalizedPatients, patientSearch]);
  const hasPatientSearch = Boolean(patientSearch.trim());
  const calendarAppointments = useMemo(
    () => appointments.map(normalizeCalendarAppointment).filter((appointment) => appointment.date),
    [appointments],
  );
  const appointmentsByDate = useMemo(() => {
    const grouped = new Map();
    calendarAppointments.forEach((appointment) => {
      const existing = grouped.get(appointment.date) ?? [];
      existing.push(appointment);
      grouped.set(appointment.date, existing);
    });
    grouped.forEach((rows) => rows.sort((a, b) => String(a.time).localeCompare(String(b.time))));
    return grouped;
  }, [calendarAppointments]);
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const selectedDateAppointments = appointmentsByDate.get(selectedCalendarDate) ?? [];

  useEffect(() => {
    const refresh = () => setDataRevision((current) => current + 1);
    window.addEventListener('storage', refresh);
    window.addEventListener('moms-pathshala:cloud-hydrated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('moms-pathshala:cloud-hydrated', refresh);
    };
  }, []);
  useEffect(() => {
    const applyHeaderDateRange = (event) => {
      const { start, end } = event.detail ?? {};
      if (!start || !end) return;
      setCustomDateRange({ start, end });
      setDatePreset('Custom');
      const selected = new Date(`${end}T00:00:00`);
      if (!Number.isNaN(selected.getTime())) {
        setCalendarMonth(startOfMonth(selected));
        setSelectedCalendarDate(end);
      }
    };
    window.addEventListener('moms-pathshala:date-range-change', applyHeaderDateRange);
    return () => window.removeEventListener('moms-pathshala:date-range-change', applyHeaderDateRange);
  }, []);
  const filteredLeads = filterRowsByPreset(leads, datePreset, (lead) => lead.addedOn, customDateRange);
  const filteredPayments = filterRowsByPreset(payments, datePreset, (payment) => payment.paidOn, customDateRange);
  const filteredAppointments = filterRowsByPreset(appointments, datePreset, (appointment) => appointment[2] ?? appointment.date, customDateRange);
  const filteredOpenLeads = filteredLeads.filter((lead) => !['won', 'lost', 'closed'].includes(normalizeStatus(lead.status)));
  const filteredFollowUps = filteredLeads.filter((lead) => normalizeStatus(lead.status).includes('follow'));
  const filteredPendingPayments = filteredPayments.filter((payment) => paymentPendingAmount(payment) > 0);
  const selectedRangeLabel = datePreset === 'Custom' && customDateRange
    ? `${customDateRange.start} to ${customDateRange.end}`
    : datePreset;
  const kpis = [
    {
      label: datePreset === 'Today' ? "Today's Appointments" : 'Appointments',
      value: String(filteredAppointments.length),
      delta: filteredAppointments.length ? `${selectedRangeLabel} range` : 'No records in range',
      accent: 'green',
    },
    {
      label: 'Open Leads',
      value: String(filteredOpenLeads.length),
      delta: filteredOpenLeads.length ? `${filteredFollowUps.length} follow-up due` : 'No records in range',
      accent: 'gold',
    },
    {
      label: 'Total Billing',
      value: `₹ ${filteredPayments.reduce((sum, payment) => sum + parseLiveAmount(payment?.amount ?? payment?.['Total Amount'] ?? payment?.Amount), 0).toLocaleString('en-IN')}`,
      delta: filteredPayments.length ? `${filteredPayments.length} invoice(s)` : 'No records in range',
      accent: 'green',
    },
    {
      label: 'Pending Payments',
      value: `₹ ${filteredPendingPayments.reduce((sum, payment) => sum + paymentPendingAmount(payment), 0).toLocaleString('en-IN')}`,
      delta: filteredPendingPayments.length ? `${filteredPendingPayments.length} invoice(s)` : 'No records in range',
      accent: 'teal',
    },
    {
      label: 'Follow-ups Due',
      value: String(filteredFollowUps.length),
      delta: filteredFollowUps.length ? `${selectedRangeLabel} range` : 'No records in range',
      accent: 'gold',
    },
  ];
  const paymentAging = buildPaymentAging(filteredPayments);
  const leadSources = buildLeadSourcePerformance(filteredLeads);
  const staffWorkload = buildStaffWorkload(filteredAppointments, staff);
  const lowStockAlerts = buildLowStockAlerts(inventory);
  const salesSummary = buildSalesSummary(filteredPayments, packages, treatments);
  const treatmentProgress = buildTreatmentProgress(treatments, clients);
  const reminders = buildClientReminders(clients);
  const actionQueue = buildActionQueue(urgentTasks, leads, payments, lowStockAlerts, reminders);

  const kpiRoute = (label) => {
    if (label.includes('Appointment')) return '/appointments';
    if (label.includes('Payment') || label.includes('Billing')) return '/payments';
    return '/crm';
  };
  const quickActions = [
    ['Add Lead', '/crm?action=add', 'Create new enquiry'],
    ['Add Patient', '/clients?action=add', 'Create patient profile'],
    ['Book Appointment', '/appointments?action=add', 'Schedule visit'],
    ['Send Form', '/operations?tab=forms', 'Open forms'],
    ['Create Invoice', '/finance?tab=payments&action=add', 'Prepare bill'],
    ['Add Payment', '/finance?tab=payments&action=add', 'Record collection'],
    ['Create Treatment Plan', '/operations?tab=treatments&action=add', 'Start plan'],
    ['Add Coaching Student', '/operations?tab=coaching&action=add', 'Add student'],
  ].map(([label, path, description]) => ({ label, description, onClick: () => navigate(path) }));

  return (
    <>
      <section className="dashboard-primary-workflow" aria-labelledby="client-journey-title">
        <div className="workflow-copy">
          <span className="workflow-label">Today&apos;s work</span>
          <h1 id="client-journey-title">Patient Journey Command Center</h1>
          <p>Reception, appointment, form, consultation, treatment ane payment ekaj focused flow ma complete karo.</p>
        </div>
        <div className="workflow-summary" aria-label="Patient journey summary">
          <span><strong>{clients.length}</strong> Registered patients</span>
          <span><strong>{todaySchedule.length}</strong> Today&apos;s visits</span>
          <span><strong>{actionQueue.length}</strong> Pending actions</span>
        </div>
        <button className="workflow-primary-action" type="button" onClick={() => navigate('/journey')}>
          Open Patient Journey <ChevronRight />
        </button>
      </section>

      <section className="dashboard-patient-search" aria-labelledby="dashboard-patient-search-title">
        <div className="patient-search-copy">
          <span className="control-label">Quick patient lookup</span>
          <h2 id="dashboard-patient-search-title">Search Patient</h2>
          <p>Name, mobile number, patient ID અથવા serviceથી શોધો.</p>
        </div>
        <div className="patient-search-panel">
          <label className="patient-search-input">
            <SearchIcon />
            <span className="sr-only">Search patient by name, mobile number, ID, or service</span>
            <input
              value={patientSearch}
              onChange={(event) => setPatientSearch(event.target.value)}
              placeholder="Search name, mobile, patient ID, or service..."
              autoComplete="off"
            />
            {hasPatientSearch && <button type="button" onClick={() => setPatientSearch('')} aria-label="Clear patient search">Clear</button>}
          </label>
          {hasPatientSearch && (
            <div className="patient-search-results" aria-live="polite">
              {patientResults.length ? patientResults.map((patient) => (
                <button className="patient-search-result" type="button" key={patient.id || `${patient.name}-${patient.mobile}`} onClick={() => navigate(`/journey?client=${encodeURIComponent(patient.name)}`)}>
                  <span className="patient-result-main">
                    <strong>{patient.name}</strong>
                    <small>{patient.id || 'No ID'} · {patient.mobile || 'No mobile'}</small>
                  </span>
                  <span className="patient-result-service">{patient.service || 'No service'}</span>
                  <span className="patient-result-open">Open Journey <ChevronRight /></span>
                </button>
              )) : (
                <div className="empty-state compact-empty patient-search-empty">
                  <strong>No patient found.</strong>
                  <p>Try another name, mobile number, ID, or service.</p>
                  <button className="pill" type="button" onClick={() => navigate('/clients?action=add')}>+ Add Patient</button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-controls" aria-label="Dashboard filters">
        <div>
          <span className="control-label">Date range</span>
          <div className="segmented-control" role="group" aria-label="Date range">
            {DATE_PRESETS.map((preset) => (
              <button
                className={datePreset === preset.label ? 'active' : ''}
                type="button"
                key={preset.label}
                onClick={() => { setDatePreset(preset.label); setCustomDateRange(null); }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="branch-select">
          <span className="control-label">Workspace</span>
          <strong>{currentBranch}</strong>
        </div>
      </section>

      <section className="kpis">
        {kpis.map((kpi) => (
          <article className="kpi action-card" key={kpi.label} role="button" tabIndex={0} onClick={() => navigate(kpiRoute(kpi.label))} onKeyDown={(event) => { if (event.key === 'Enter') navigate(kpiRoute(kpi.label)); }}>
            <div className="kpi-head">
              <KpiIcon accent={kpi.accent} />
              <div>
                <h3>{kpi.label}</h3>
                <div className="value">{kpi.value}</div>
              </div>
            </div>
            <div className="delta">{kpi.delta}</div>
            <div className="kpi-footer">
              <ChevronRight />
              View Details
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-action-strip" aria-label="Dashboard actions">
        <p className="command-message">Fast entry actions are grouped here; analytics stay behind More insights so daily work stays clean.</p>
        <div className="sheet-actions toolbar-actions">
          <ActionMenu label="Actions" items={quickActions} />
          <button className="pill" type="button" onClick={() => setMoreInsightsOpen(true)}>More insights <ChevronRight /></button>
        </div>
      </section>

      <section className="appointment-calendar-card" aria-labelledby="appointment-calendar-title">
        <div className="appointment-calendar-head">
          <div>
            <span className="control-label">Appointment history</span>
            <h2 id="appointment-calendar-title">Patient Appointment Calendar</h2>
            <p>Select any date to review its appointments and open the patient&apos;s complete journey.</p>
          </div>
          <div className="calendar-month-actions" aria-label="Calendar month controls">
            <button type="button" onClick={() => setCalendarMonth((month) => addMonths(month, -1))} aria-label="Previous month">‹</button>
            <strong>{calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
            <button type="button" onClick={() => setCalendarMonth((month) => addMonths(month, 1))} aria-label="Next month">›</button>
            <button
              className="calendar-today-button"
              type="button"
              onClick={() => {
                const today = new Date();
                setCalendarMonth(startOfMonth(today));
                setSelectedCalendarDate(toLocalIsoDate(today));
              }}
            >
              Today
            </button>
          </div>
        </div>

        <div className="appointment-calendar-layout">
          <div className="calendar-panel">
            <div className="calendar-weekdays" aria-hidden="true">
              {CALENDAR_WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="calendar-grid" role="grid" aria-label={`${calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} appointments`}>
              {calendarDays.map((day) => {
                const dateKey = toLocalIsoDate(day);
                const appointmentCount = appointmentsByDate.get(dateKey)?.length ?? 0;
                const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                const isSelected = dateKey === selectedCalendarDate;
                const isToday = dateKey === toLocalIsoDate(new Date());
                return (
                  <button
                    className={`calendar-day${isCurrentMonth ? '' : ' outside'}${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}${appointmentCount ? ' has-appointments' : ''}`}
                    type="button"
                    role="gridcell"
                    key={dateKey}
                    aria-selected={isSelected}
                    aria-label={`${day.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}, ${appointmentCount} appointment${appointmentCount === 1 ? '' : 's'}`}
                    onClick={() => {
                      setSelectedCalendarDate(dateKey);
                      if (!isCurrentMonth) setCalendarMonth(startOfMonth(day));
                    }}
                  >
                    <span className="calendar-day-number">{day.getDate()}</span>
                    {appointmentCount > 0 && <span className="calendar-appointment-count">{appointmentCount}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="calendar-day-agenda" aria-live="polite">
            <div className="calendar-agenda-head">
              <div>
                <span className="control-label">Selected date</span>
                <h3>{formatCalendarDate(selectedCalendarDate)}</h3>
              </div>
              <span className="calendar-total">{selectedDateAppointments.length} appointment{selectedDateAppointments.length === 1 ? '' : 's'}</span>
            </div>
            {selectedDateAppointments.length ? (
              <div className="calendar-agenda-list">
                {selectedDateAppointments.map((appointment) => (
                  <button
                    className="calendar-agenda-item"
                    type="button"
                    key={appointment.id}
                    disabled={!appointment.name}
                    onClick={() => navigate(`/journey?client=${encodeURIComponent(appointment.name)}`)}
                  >
                    <span className="calendar-agenda-time">{appointment.time || 'Time pending'}</span>
                    <span className="calendar-agenda-patient">
                      <strong>{appointment.name || 'Unnamed patient'}</strong>
                      <small>{appointment.type || 'Appointment'}{appointment.mobile ? ` · ${appointment.mobile}` : ''}</small>
                    </span>
                    <span className="calendar-agenda-open">View Journey <ChevronRight /></span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="calendar-empty-state">
                <strong>No appointments on this date.</strong>
                <p>Select a date with a count badge or book a new appointment.</p>
                <button className="pill" type="button" onClick={() => navigate('/appointments?action=add')}>Book Appointment</button>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="dashboard-focus-grid">
        <Card title="Action Queue" subtitle="The next best work items for today.">
          {actionQueue.length ? (
            <div className="action-queue">
              {actionQueue.map((item) => (
                <button className="queue-item" type="button" key={`${item.title}-${item.route}`} onClick={() => navigate(item.route)}>
                  <span className={`queue-priority ${item.tone}`} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.note}</small>
                  </span>
                  <ChevronRight />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No actions pending.</strong>
              <p>Follow-ups and unpaid invoices will appear here automatically.</p>
            </div>
          )}
        </Card>

        <Card title="Today&apos;s Schedule" action={<button className="icon-btn inline-icon" type="button" onClick={() => navigate('/appointments')} aria-label="Open appointments"><ChevronRight /></button>}>
          {todaySchedule.length ? (
            <div className="schedule-list">
              {todaySchedule.slice(0, 5).map((item) => (
                <div className="schedule-item" key={`${item.time}-${item.name}`}>
                  <div className="time">{item.time}</div>
                  <div>
                    <div className="item-title">{item.name}</div>
                    <div className="item-sub">{item.note}</div>
                  </div>
                  <StatusPill tone={`st-${item.tone}`}>{item.status}</StatusPill>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No appointments today.</strong>
              <p>Patient Journey mathi check-in karo athva appointment book karo.</p>
            </div>
          )}
          <button className="footer-action button-reset" type="button" onClick={() => navigate('/appointments')}>
            <span>Open Appointments</span><ChevronRight />
          </button>
        </Card>
      </section>

      {moreInsightsOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setMoreInsightsOpen(false)}>
          <div className="modal-shell wide-modal" role="dialog" aria-modal="true" aria-label="More dashboard insights" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>More Insights</h2>
                <p>Operational details are grouped here to keep the main dashboard clean.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setMoreInsightsOpen(false)} aria-label="Close modal">x</button>
            </div>
            <div className="more-insights-grid">
              <Card title="Payment Aging" subtitle="Unpaid collections grouped by age.">
                <InsightBars rows={paymentAging} emptyTitle="No pending payments." emptyCopy="Pending invoices will appear here by age bucket." valueFormatter={(row) => `₹ ${row.amount.toLocaleString('en-IN')}`} />
              </Card>

              <Card title="Lead Source Performance" subtitle={`Showing ${datePreset.toLowerCase()} performance.`}>
                <InsightBars rows={leadSources} emptyTitle="No lead sources yet." emptyCopy="Add leads with sources to compare performance." valueFormatter={(row) => `${row.count} lead${row.count === 1 ? '' : 's'}`} />
              </Card>

              <Card title="Staff Workload" subtitle={`Appointments per team member (${datePreset.toLowerCase()}).`}>
                <InsightBars
                  rows={staffWorkload}
                  emptyTitle="No staff workload yet."
                  emptyCopy="Add staff names to appointments to compare booking load."
                  valueFormatter={(row) => `${row.count} appointment${row.count === 1 ? '' : 's'}`}
                />
              </Card>

              <Card title="Inventory Alerts" subtitle="Low-stock and near-expiry items.">
                <AlertList
                  rows={lowStockAlerts}
                  emptyTitle="Inventory looks healthy."
                  emptyCopy="Low stock and expiry alerts will appear here."
                  route="/inventory"
                />
              </Card>

              <Card title="Medicine & Package Sales" subtitle="Paid collections grouped by sale type.">
                <InsightBars
                  rows={salesSummary}
                  emptyTitle="No sales summary yet."
                  emptyCopy="Paid invoices will be grouped into medicine, package, and treatment sales."
                  valueFormatter={(row) => `₹ ${row.amount.toLocaleString('en-IN')}`}
                />
              </Card>

              <Card title="Treatment Progress" subtitle="Active, completed, and paused plans.">
                <InsightBars
                  rows={treatmentProgress}
                  emptyTitle="No treatment progress yet."
                  emptyCopy="Create treatment plans or update client progress to track outcomes."
                  valueFormatter={(row) => `${row.count} record${row.count === 1 ? '' : 's'}`}
                />
              </Card>

              <Card title="Birthday Reminders" subtitle="Upcoming client birthdays.">
                <AlertList
                  rows={reminders}
                  emptyTitle="No reminders due."
                  emptyCopy="Add birthdays in patient profiles."
                  route="/clients"
                />
              </Card>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

function normalizeDashboardPatient(row) {
  if (Array.isArray(row)) {
    const hasId = row.length >= 7;
    return {
      id: hasId ? String(row[0] ?? '').trim() : '',
      name: String(row[hasId ? 1 : 0] ?? '').trim(),
      mobile: String(row[hasId ? 2 : 1] ?? '').trim(),
      service: String(row[row.length >= 8 ? 7 : hasId ? 6 : 5] ?? '').trim(),
    };
  }
  return {
    id: String(row?.clientId ?? row?.['Client ID'] ?? row?.id ?? '').trim(),
    name: String(row?.name ?? row?.Client ?? row?.client ?? '').trim(),
    mobile: String(row?.mobile ?? row?.Mobile ?? row?.phone ?? '').trim(),
    service: String(row?.service ?? row?.Service ?? row?.program ?? row?.Program ?? '').trim(),
  };
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeAppointmentDate(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  const localMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (localMatch) return `${localMatch[3]}-${localMatch[2].padStart(2, '0')}-${localMatch[1].padStart(2, '0')}`;
  const parsed = parseLooseDate(raw);
  return parsed ? toLocalIsoDate(parsed) : '';
}

function normalizeCalendarAppointment(row, index) {
  const name = String(pickRowValue(row, 0, ['client', 'Client', 'name', 'patient', 'Patient'])).trim();
  const mobile = String(pickRowValue(row, 1, ['mobile', 'Mobile', 'phone'])).trim();
  const date = normalizeAppointmentDate(pickRowValue(row, 2, ['date', 'Date', 'appointmentDate']));
  const time = String(pickRowValue(row, 3, ['time', 'Time', 'appointmentTime'])).trim();
  const type = String(pickRowValue(row, 4, ['type', 'Type', 'service', 'Service'])).trim();
  return {
    id: `${date}-${time}-${name}-${index}`,
    name,
    mobile,
    date,
    time,
    type,
  };
}

function buildCalendarDays(month) {
  const firstDay = startOfMonth(month);
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => (
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
  ));
}

function formatCalendarDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function parseLooseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === 'due') return null;
  if (raw.toLowerCase() === 'today') return new Date();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function filterRowsByPreset(rows, presetLabel, getDate, customRange = null) {
  if (presetLabel === 'Custom' && customRange?.start && customRange?.end) {
    const start = new Date(`${customRange.start}T00:00:00`);
    const end = new Date(`${customRange.end}T23:59:59`);
    return rows.filter((row) => {
      const date = parseLooseDate(getDate(row));
      return date ? date >= start && date <= end : false;
    });
  }
  const preset = DATE_PRESETS.find((item) => item.label === presetLabel);
  if (!preset?.days) return rows;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (preset.days - 1));
  const until = new Date();
  until.setHours(23, 59, 59, 999);
  return rows.filter((row) => {
    const date = parseLooseDate(getDate(row));
    return date ? date >= since && date <= until : false;
  });
}

function buildPaymentAging(payments) {
  const buckets = [
    { label: '0-7 days', count: 0, amount: 0 },
    { label: '8-15 days', count: 0, amount: 0 },
    { label: '16+ days', count: 0, amount: 0 },
  ];
  const today = new Date();
  payments
    .filter((payment) => paymentPendingAmount(payment) > 0)
    .forEach((payment) => {
      const date = parseLooseDate(payment.paidOn);
      const age = date ? Math.max(0, Math.floor((today - date) / 86400000)) : 16;
      const bucket = age <= 7 ? buckets[0] : age <= 15 ? buckets[1] : buckets[2];
      bucket.count += 1;
      bucket.amount += paymentPendingAmount(payment);
    });
  const maxAmount = Math.max(...buckets.map((bucket) => bucket.amount), 1);
  return buckets.map((bucket) => ({ ...bucket, percent: Math.round((bucket.amount / maxAmount) * 100) }));
}

function buildLeadSourcePerformance(leads) {
  const totals = new Map();
  leads.forEach((lead) => {
    const source = lead.source || 'Unknown';
    totals.set(source, (totals.get(source) ?? 0) + 1);
  });
  const maxCount = Math.max(...totals.values(), 1);
  return Array.from(totals.entries())
    .map(([label, count]) => ({ label, count, percent: Math.round((count / maxCount) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function pickRowValue(row, index, keys = []) {
  if (Array.isArray(row)) return row[index] ?? '';
  return keys.map((key) => row?.[key]).find((value) => value !== undefined && value !== null && value !== '') ?? '';
}

function normalizeStatus(value) {
  return String(value ?? '').trim().toLowerCase();
}

function buildStaffWorkload(appointments, staffRows) {
  const staffNames = new Set(staffRows.map((row) => pickRowValue(row, 0, ['name', 'Name'])).filter(Boolean));
  const totals = new Map();
  appointments.forEach((appointment) => {
    const staffName = pickRowValue(appointment, 5, ['staff', 'Staff', 'consultant', 'doctor']) || 'Unassigned';
    totals.set(staffName, (totals.get(staffName) ?? 0) + 1);
  });
  staffNames.forEach((name) => {
    if (!totals.has(name)) totals.set(name, 0);
  });
  const maxCount = Math.max(...totals.values(), 1);
  return Array.from(totals.entries())
    .map(([label, count]) => ({ label, count, percent: Math.round((count / maxCount) * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function daysUntil(value) {
  const date = parseLooseDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / 86400000);
}

function buildLowStockAlerts(inventory) {
  return inventory
    .map((row) => {
      const item = pickRowValue(row, 0, ['item', 'Item', 'name']);
      const category = pickRowValue(row, 1, ['category', 'Category']);
      const quantity = Number(String(pickRowValue(row, 2, ['quantity', 'Quantity', 'stock'])).replace(/[^\d.-]/g, ''));
      const expiry = pickRowValue(row, 3, ['expiry', 'Expiry']);
      const status = normalizeStatus(pickRowValue(row, 4, ['status', 'Status']));
      const expiryDays = daysUntil(expiry);
      const lowStock = status.includes('low') || (Number.isFinite(quantity) && quantity <= 10);
      const expiring = expiryDays !== null && expiryDays >= 0 && expiryDays <= 30;
      if (!lowStock && !expiring) return null;
      return {
        title: item || 'Unnamed item',
        note: `${category || 'Inventory'} · ${Number.isFinite(quantity) ? `${quantity} left` : 'stock pending'}${expiring ? ` · expires in ${expiryDays} day${expiryDays === 1 ? '' : 's'}` : ''}`,
        tone: lowStock ? 'hot' : 'warm',
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

function buildSalesSummary(payments, packageRows, treatmentRows) {
  const packageNames = packageRows.map((row) => String(pickRowValue(row, 0, ['package', 'Package', 'name'])).toLowerCase()).filter(Boolean);
  const treatmentNames = treatmentRows.map((row) => String(pickRowValue(row, 1, ['service', 'Service'])).toLowerCase()).filter(Boolean);
  const buckets = [
    { label: 'Packages', count: 0, amount: 0 },
    { label: 'Treatments', count: 0, amount: 0 },
    { label: 'Medicines', count: 0, amount: 0 },
    { label: 'Other Sales', count: 0, amount: 0 },
  ];
  payments
    .filter((payment) => paymentPaidAmount(payment) > 0)
    .forEach((payment) => {
      const text = `${payment.invoice ?? ''} ${payment.client ?? ''} ${payment.item ?? ''} ${payment.category ?? ''}`.toLowerCase();
      const amount = paymentPaidAmount(payment);
      const bucket = text.includes('medicine') || text.includes('medicin')
        ? buckets[2]
        : packageNames.some((name) => text.includes(name)) || text.includes('package')
          ? buckets[0]
          : treatmentNames.some((name) => text.includes(name)) || text.includes('treatment') || text.includes('therapy')
            ? buckets[1]
            : buckets[3];
      bucket.count += 1;
      bucket.amount += amount;
    });
  const maxAmount = Math.max(...buckets.map((bucket) => bucket.amount), 1);
  return buckets.map((bucket) => ({ ...bucket, percent: Math.round((bucket.amount / maxAmount) * 100) }));
}

function buildTreatmentProgress(treatments, clients) {
  const buckets = [
    { label: 'Active', count: 0 },
    { label: 'Completed', count: 0 },
    { label: 'Paused', count: 0 },
    { label: 'Review Needed', count: 0 },
  ];
  treatments.forEach((row) => {
    const status = normalizeStatus(pickRowValue(row, 7, ['status', 'Status']));
    if (status.includes('complete') || status.includes('done')) buckets[1].count += 1;
    else if (status.includes('pause') || status.includes('hold')) buckets[2].count += 1;
    else if (status.includes('review') || status.includes('follow')) buckets[3].count += 1;
    else buckets[0].count += 1;
  });
  clients.forEach((client) => {
    const progress = normalizeStatus(client.progress ?? pickRowValue(client, 3, ['Progress']));
    if (progress.includes('complete') || progress === '100%' || progress === '100') buckets[1].count += 1;
    else if (progress.includes('pause') || progress.includes('hold')) buckets[2].count += 1;
    else if (progress) buckets[0].count += 1;
  });
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
  return buckets.map((bucket) => ({ ...bucket, percent: Math.round((bucket.count / maxCount) * 100) }));
}

function nextAnnualDate(value) {
  const date = parseLooseDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), date.getMonth(), date.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return next;
}

function buildClientReminders(clients) {
  const rows = [];
  clients.forEach((client) => {
    const name = client.name ?? pickRowValue(client, 0, ['Client']);
    [
      ['Birthday', client.birthday ?? pickRowValue(client, 5, ['Birthday'])],
      ['Anniversary', client.anniversary ?? pickRowValue(client, 6, ['Anniversary'])],
    ].forEach(([label, value]) => {
      const next = nextAnnualDate(value);
      if (!next) return;
      const dueIn = Math.ceil((next - new Date().setHours(0, 0, 0, 0)) / 86400000);
      if (dueIn < 0 || dueIn > 30) return;
      rows.push({
        title: `${label}: ${name || 'Unnamed patient'}`,
        note: dueIn === 0 ? 'Today' : `In ${dueIn} day${dueIn === 1 ? '' : 's'}`,
        tone: dueIn <= 7 ? 'warm' : 'cool',
      });
    });
  });
  return rows.sort((a, b) => Number(a.note.match(/\d+/)?.[0] ?? 0) - Number(b.note.match(/\d+/)?.[0] ?? 0)).slice(0, 6);
}

function buildActionQueue(tasks, leads, payments, lowStockAlerts = [], reminders = []) {
  const followUps = leads
    .filter((lead) => String(lead.status ?? '').toLowerCase().includes('follow'))
    .slice(0, 3)
    .map((lead) => ({
      title: `Follow up: ${lead.name || 'Unnamed lead'}`,
      note: `${lead.source || 'Lead'} · score ${lead.score || '?'}`,
      route: '/crm',
      tone: 'warm',
    }));
  const collections = payments
    .filter((payment) => paymentPendingAmount(payment) > 0)
    .slice(0, 2)
    .map((payment) => ({
      title: `Collect ${payment.invoice || 'pending invoice'}`,
      note: `${payment.client || 'Patient'} · ₹ ${paymentPendingAmount(payment).toLocaleString('en-IN')} pending`,
      route: '/payments',
      tone: 'hot',
    }));
  const stockTasks = lowStockAlerts.slice(0, 1).map((item) => ({
    title: `Inventory: ${item.title}`,
    note: item.note,
    route: '/inventory',
    tone: item.tone,
  }));
  const reminderTasks = reminders.slice(0, 1).map((item) => ({
    title: item.title,
    note: item.note,
    route: '/clients',
    tone: item.tone,
  }));
  const fallback = tasks.slice(0, 3).map((task) => ({
    title: task.title,
    note: task.note,
    route: '/crm',
    tone: 'cool',
  }));
  return [...collections, ...stockTasks, ...reminderTasks, ...followUps, ...fallback].slice(0, 5);
}

function AlertList({ rows, emptyTitle, emptyCopy, route }) {
  const navigate = useNavigate();

  if (!rows.length) {
    return (
      <div className="empty-state compact-empty">
        <strong>{emptyTitle}</strong>
        <p>{emptyCopy}</p>
      </div>
    );
  }

  return (
    <div className="action-queue compact-alerts">
      {rows.map((row) => (
        <button className="queue-item" type="button" key={`${row.title}-${row.note}`} onClick={() => navigate(route)}>
          <span className={`queue-priority ${row.tone}`} />
          <span>
            <strong>{row.title}</strong>
            <small>{row.note}</small>
          </span>
          <ChevronRight />
        </button>
      ))}
    </div>
  );
}

function InsightBars({ rows, emptyTitle, emptyCopy, valueFormatter }) {
  if (!rows.length || rows.every((row) => !row.count && !row.amount)) {
    return (
      <div className="empty-state compact-empty">
        <strong>{emptyTitle}</strong>
        <p>{emptyCopy}</p>
      </div>
    );
  }

  return (
    <div className="insight-bars">
      {rows.map((row) => (
        <div className="insight-row" key={row.label}>
          <div className="insight-line">
            <strong>{row.label}</strong>
            <span>{valueFormatter(row)}</span>
          </div>
          <div className="bar-track" aria-hidden="true">
            <span style={{ width: `${Math.max(row.percent, row.count || row.amount ? 8 : 0)}%` }} />
          </div>
          {'count' in row && row.amount ? <small>{row.count} invoice(s)</small> : null}
        </div>
      ))}
    </div>
  );
}

function ModuleTable({ type, rows = [] }) {
  const navigate = useNavigate();

  if (!rows.length) {
    return (
      <div className="empty-state compact-empty">
        <strong>No {type} yet.</strong>
        <p>Use the app actions to add the first record, then this table will populate automatically.</p>
        <button className="pill" type="button" onClick={() => navigate(type === 'leads' ? '/crm' : '/finance')}>
          Open {type === 'leads' ? 'CRM' : 'Finance'} <ChevronRight />
        </button>
      </div>
    );
  }

  return (
    <div className="data-table">
      <div className="table-head">
        {type === 'leads' ? (
          <>
            <div>Name</div><div>Source</div><div>Status</div><div>Score</div><div>Added On</div><div />
          </>
        ) : (
          <>
            <div>Patient Name</div><div>Invoice #</div><div>Amount</div><div>Status</div><div>Paid On</div><div />
          </>
        )}
      </div>
      {rows.map((row) => (
        <div className="data-row" key={type === 'leads' ? row.name : row.invoice}>
          {type === 'leads' ? (
            <>
              <div>{row.name}</div>
              <div>{row.source}</div>
              <div><Tag tone={row.status === 'Hot' ? 'tag-hot' : row.status === 'Follow-up due' ? 'tag-follow' : row.status === 'Contacted' ? 'tag-contacted' : 'tag-new'}>{row.status}</Tag></div>
              <div>{row.score}</div>
              <div>{row.addedOn}</div>
              <div><button className="row-link" type="button" onClick={() => navigate(type === 'leads' ? '/crm' : '/payments')}>View</button></div>
            </>
          ) : (
            <>
              <div>{row.client}</div>
              <div>{row.invoice}</div>
              <div>{row.amount}</div>
              <div><Tag tone={row.status === 'Paid' ? 'tag-paid' : row.status === 'Partial' ? 'tag-partial' : 'tag-pending'}>{row.status}</Tag></div>
              <div>{row.paidOn}</div>
              <div><button className="row-link" type="button" onClick={() => navigate(type === 'leads' ? '/crm' : '/payments')}>View</button></div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

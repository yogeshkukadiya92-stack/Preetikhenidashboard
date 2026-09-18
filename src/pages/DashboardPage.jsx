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
  const [operationalView, setOperationalView] = useState('queue'); // 'queue' | 'calendar'
  const [activeInsightsTab, setActiveInsightsTab] = useState('aging'); // 'aging' | 'sales' | 'leads' | 'staff' | 'inventory' | 'birthdays'
  const [priorityFilter, setPriorityFilter] = useState('all'); // 'all' | 'collection' | 'followup' | 'stock' | 'reminder'
  const [patientSearch, setPatientSearch] = useState('');
  const [dataRevision, setDataRevision] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toLocalIsoDate(new Date()));

  const liveData = useMemo(() => loadLiveDashboardData(currentBranch), [currentBranch, dataRevision]);
  const { leads, payments, urgentTasks, appointments, clients, inventory, packages, staff, treatments } = liveData;

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

  const todayIsoDate = useMemo(() => toLocalIsoDate(new Date()), []);
  const todayAppointments = useMemo(() => {
    return appointmentsByDate.get(todayIsoDate) ?? [];
  }, [appointmentsByDate, todayIsoDate]);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

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

  const totalBillingSum = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + parseLiveAmount(payment?.amount ?? payment?.['Total Amount'] ?? payment?.Amount), 0);
  }, [filteredPayments]);

  const pendingPaymentsSum = useMemo(() => {
    return filteredPendingPayments.reduce((sum, payment) => sum + paymentPendingAmount(payment), 0);
  }, [filteredPendingPayments]);

  const paymentAging = buildPaymentAging(filteredPayments);
  const leadSources = buildLeadSourcePerformance(filteredLeads);
  const staffWorkload = buildStaffWorkload(filteredAppointments, staff);
  const lowStockAlerts = buildLowStockAlerts(inventory);
  const salesSummary = buildSalesSummary(filteredPayments, packages, treatments);
  const reminders = buildClientReminders(clients);
  const actionQueue = buildActionQueue(urgentTasks, leads, payments, lowStockAlerts, reminders);

  const filteredActionQueue = useMemo(() => {
    if (priorityFilter === 'all') return actionQueue;
    return actionQueue.filter((item) => item.category === priorityFilter);
  }, [actionQueue, priorityFilter]);

  const kpis = [
    {
      label: "Appointments",
      value: String(filteredAppointments.length),
      delta: `${filteredAppointments.length} in range`,
      tone: 'green',
      icon: '🩺',
      onClick: () => navigate('/appointments'),
    },
    {
      label: 'Open Leads',
      value: String(filteredOpenLeads.length),
      delta: `${filteredFollowUps.length} follow-ups due`,
      tone: 'gold',
      icon: '👥',
      onClick: () => navigate('/crm'),
    },
    {
      label: 'Total Billing',
      value: `₹ ${totalBillingSum.toLocaleString('en-IN')}`,
      delta: `${filteredPayments.length} invoices`,
      tone: 'green',
      icon: '💰',
      onClick: () => navigate('/payments'),
    },
    {
      label: 'Pending Dues',
      value: `₹ ${pendingPaymentsSum.toLocaleString('en-IN')}`,
      delta: `${filteredPendingPayments.length} pending collections`,
      tone: 'hot',
      icon: '⏳',
      onClick: () => navigate('/payments'),
    },
    {
      label: 'Action Queue',
      value: String(actionQueue.length),
      delta: 'Urgent clinic tasks',
      tone: 'teal',
      icon: '⚡',
      onClick: () => setOperationalView('queue'),
    },
  ];

  return (
    <>
      {/* 1. Hero Command Center */}
      <section className="dashboard-hero-command" aria-label="Hospital Command Center">
        <div className="dashboard-hero-top">
          <div className="dashboard-hero-info">
            <div className="dashboard-hero-badge-row">
              <span className="dashboard-status-chip">● Live Clinic System</span>
              <span className="dashboard-branch-chip">🏥 Workspace: {currentBranch}</span>
            </div>
            <h1 className="dashboard-hero-title">🌿 Shree Ayurved Hospital</h1>
            <p className="dashboard-hero-desc">
              <span>{todayFormatted}</span>
              <span>•</span>
              <span><strong>{clients.length}</strong> Registered Patients</span>
              <span>•</span>
              <span><strong>{todayAppointments.length}</strong> Today&apos;s Visits</span>
            </p>
          </div>

          <div className="dashboard-hero-actions">
            <button className="dash-btn" type="button" onClick={() => navigate('/appointments?action=add')}>
              📅 Book Appointment
            </button>
            <button className="dash-btn" type="button" onClick={() => navigate('/clients?action=add')}>
              👤 Add Patient
            </button>
            <button className="dash-btn" type="button" onClick={() => navigate('/finance?tab=payments&action=add')}>
              💳 New Invoice
            </button>
            <button className="dash-btn primary" type="button" onClick={() => navigate('/journey')}>
              ✨ Open Patient Journey →
            </button>
          </div>
        </div>

        {/* Hero Subbar: Omnisearch & Date Range */}
        <div className="dashboard-hero-subbar">
          <div className="dashboard-omni-search-wrap">
            <div className="dashboard-omni-search-box">
              <SearchIcon />
              <input
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Instant search patient by name, mobile, patient ID, or service..."
                autoComplete="off"
              />
              {hasPatientSearch && (
                <button
                  type="button"
                  className="omni-clear-btn"
                  onClick={() => setPatientSearch('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {hasPatientSearch && (
              <div className="omnisearch-dropdown" aria-live="polite">
                <div className="omnisearch-dropdown-head">
                  Found {patientResults.length} patient{patientResults.length === 1 ? '' : 's'}
                </div>
                {patientResults.length ? (
                  patientResults.map((patient) => {
                    const initials = String(patient.name || 'P').trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                    return (
                      <button
                        className="omnisearch-item"
                        type="button"
                        key={patient.id || `${patient.name}-${patient.mobile}`}
                        onClick={() => {
                          setPatientSearch('');
                          navigate(`/journey?client=${encodeURIComponent(patient.name)}`);
                        }}
                      >
                        <div className="omnisearch-item-left">
                          <div className="omnisearch-avatar">{initials}</div>
                          <div className="omnisearch-meta">
                            <strong>{patient.name}</strong>
                            <span>{patient.id ? `#${patient.id} · ` : ''}{patient.mobile || 'No mobile'}</span>
                          </div>
                        </div>
                        {patient.service && <span className="omnisearch-service-tag">{patient.service}</span>}
                        <span className="omnisearch-cta">Open Journey <ChevronRight /></span>
                      </button>
                    );
                  })
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#597a6e' }}>
                    <p style={{ margin: '0 0 10px', fontSize: '0.84rem' }}>No patient matched &ldquo;{patientSearch}&rdquo;</p>
                    <button className="dash-btn" type="button" onClick={() => navigate('/clients?action=add')}>
                      + Add New Patient Profile
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="dashboard-date-presets" role="group" aria-label="Date range filter">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`dash-preset-chip ${datePreset === preset.label ? 'active' : ''}`}
                onClick={() => {
                  setDatePreset(preset.label);
                  setCustomDateRange(null);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Executive 5-Column KPI Stat Cards */}
      <section className="dashboard-kpi-grid" aria-label="Key Performance Indicators">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className={`dash-kpi-card tone-${kpi.tone}`}
            role="button"
            tabIndex={0}
            onClick={kpi.onClick}
            onKeyDown={(e) => { if (e.key === 'Enter') kpi.onClick(); }}
          >
            <div className="dash-kpi-head">
              <span className="dash-kpi-label">{kpi.label}</span>
              <div className="dash-kpi-icon-pill">{kpi.icon}</div>
            </div>
            <div className="dash-kpi-value">{kpi.value}</div>
            <div className="dash-kpi-foot">
              <span className="dash-kpi-delta">{kpi.delta}</span>
              <span className="dash-kpi-link">View <ChevronRight /></span>
            </div>
          </article>
        ))}
      </section>

      {/* 3. Balanced 2-Column Operational Center */}
      <section className="dashboard-main-grid" aria-label="Daily Operations and Priority Queue">
        {/* Left Column: Today's Schedule & Interactive Calendar */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-title-wrap">
              <h2 className="dash-panel-title">📋 Patient Scheduling</h2>
              <span className="dash-count-pill">{todayAppointments.length} Today</span>
            </div>
            <div className="dash-panel-tabs">
              <button
                type="button"
                className={`dash-panel-tab-btn ${operationalView === 'queue' ? 'active' : ''}`}
                onClick={() => setOperationalView('queue')}
              >
                Today&apos;s Queue ({todayAppointments.length})
              </button>
              <button
                type="button"
                className={`dash-panel-tab-btn ${operationalView === 'calendar' ? 'active' : ''}`}
                onClick={() => setOperationalView('calendar')}
              >
                Monthly Calendar
              </button>
            </div>
          </div>

          <div className="dash-panel-body">
            {operationalView === 'queue' ? (
              <div className="today-queue-container">
                {todayAppointments.length ? (
                  todayAppointments.map((appointment) => {
                    const initials = String(appointment.name || 'P').trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                    return (
                      <div className="today-queue-item" key={appointment.id}>
                        <div className="today-queue-left">
                          <span className="today-queue-time-badge">{appointment.time || 'Time TBD'}</span>
                          <div className="today-queue-avatar">{initials}</div>
                          <div className="today-queue-info">
                            <strong>{appointment.name || 'Unnamed Patient'}</strong>
                            <span>
                              {appointment.type || 'Consultation'}
                              {appointment.mobile ? ` • 📞 ${appointment.mobile}` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="today-queue-right">
                          <span className="today-status-pill status-checked-in">Scheduled</span>
                          <button
                            className="today-open-journey-btn"
                            type="button"
                            onClick={() => navigate(`/journey?client=${encodeURIComponent(appointment.name)}`)}
                          >
                            Open Journey <ChevronRight />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🌿</div>
                    <strong style={{ fontSize: '1.05rem', color: '#0e382d', display: 'block' }}>
                      No Appointments Scheduled For Today
                    </strong>
                    <p style={{ color: '#5b7a6e', margin: '6px auto 18px', maxWidth: '380px', fontSize: '0.84rem', lineHeight: '1.45' }}>
                      Book a patient appointment or open the Patient Journey to check-in a walk-in patient.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="dash-btn" type="button" onClick={() => navigate('/appointments?action=add')}>
                        📅 Book Appointment
                      </button>
                      <button className="dash-btn primary" type="button" onClick={() => navigate('/journey')}>
                        ✨ Open Patient Journey
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Calendar View */
              <div className="appointment-calendar-card" style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}>
                <div className="appointment-calendar-head" style={{ marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#0e382d' }}>Appointment Calendar</h3>
                    <p style={{ margin: '2px 0 0', color: '#5c7a6e', fontSize: '0.78rem' }}>Click any day with badge to inspect scheduled visits.</p>
                  </div>
                  <div className="calendar-month-actions">
                    <button type="button" onClick={() => setCalendarMonth((m) => addMonths(m, -1))} aria-label="Previous month">‹</button>
                    <strong>{calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
                    <button type="button" onClick={() => setCalendarMonth((m) => addMonths(m, 1))} aria-label="Next month">›</button>
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
                    <div className="calendar-grid" role="grid">
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
                            key={dateKey}
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

                  <aside className="calendar-day-agenda">
                    <div className="calendar-agenda-head">
                      <div>
                        <span className="control-label">Selected Date</span>
                        <h3>{formatCalendarDate(selectedCalendarDate)}</h3>
                      </div>
                      <span className="calendar-total">{selectedDateAppointments.length} visit{selectedDateAppointments.length === 1 ? '' : 's'}</span>
                    </div>

                    {selectedDateAppointments.length ? (
                      <div className="calendar-agenda-list">
                        {selectedDateAppointments.map((app) => (
                          <button
                            className="calendar-agenda-item"
                            type="button"
                            key={app.id}
                            disabled={!app.name}
                            onClick={() => navigate(`/journey?client=${encodeURIComponent(app.name)}`)}
                          >
                            <span className="calendar-agenda-time">{app.time || 'TBD'}</span>
                            <span className="calendar-agenda-patient">
                              <strong>{app.name || 'Unnamed patient'}</strong>
                              <small>{app.type || 'Appointment'}{app.mobile ? ` · ${app.mobile}` : ''}</small>
                            </span>
                            <span className="calendar-agenda-open">Journey <ChevronRight /></span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="calendar-empty-state">
                        <strong>No appointments on this date.</strong>
                        <p>Select a date with a badge count or schedule a new visit.</p>
                        <button className="pill" type="button" onClick={() => navigate('/appointments?action=add')}>
                          Book Appointment
                        </button>
                      </div>
                    )}
                  </aside>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Priority Action Queue */}
        <div className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-title-wrap">
              <h2 className="dash-panel-title">⚡ Priority Action Queue</h2>
              <span className="dash-count-pill">{actionQueue.length}</span>
            </div>
            <button className="dash-btn" type="button" onClick={() => navigate('/crm')}>
              Open CRM <ChevronRight />
            </button>
          </div>

          <div className="dash-panel-body">
            <div className="priority-filter-bar">
              <button
                type="button"
                className={`priority-filter-btn ${priorityFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('all')}
              >
                All ({actionQueue.length})
              </button>
              <button
                type="button"
                className={`priority-filter-btn ${priorityFilter === 'collection' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('collection')}
              >
                💰 Dues ({actionQueue.filter((i) => i.category === 'collection').length})
              </button>
              <button
                type="button"
                className={`priority-filter-btn ${priorityFilter === 'followup' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('followup')}
              >
                📞 Follow-ups ({actionQueue.filter((i) => i.category === 'followup').length})
              </button>
              <button
                type="button"
                className={`priority-filter-btn ${priorityFilter === 'stock' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('stock')}
              >
                📦 Stock ({actionQueue.filter((i) => i.category === 'stock').length})
              </button>
              <button
                type="button"
                className={`priority-filter-btn ${priorityFilter === 'reminder' ? 'active' : ''}`}
                onClick={() => setPriorityFilter('reminder')}
              >
                🎂 Birthdays ({actionQueue.filter((i) => i.category === 'reminder').length})
              </button>
            </div>

            <div className="priority-stream-list">
              {filteredActionQueue.length ? (
                filteredActionQueue.map((item, idx) => (
                  <button
                    key={`${item.title}-${idx}`}
                    type="button"
                    className="priority-stream-item"
                    onClick={() => navigate(item.route)}
                  >
                    <div className="priority-stream-item-left">
                      <span className={`priority-indicator ${item.tone}`} />
                      <div className={`priority-icon-pill ${item.tone}`}>{item.icon || '⚡'}</div>
                      <div className="priority-stream-info">
                        <strong>{item.title}</strong>
                        <span>{item.note}</span>
                      </div>
                    </div>
                    <span className="priority-stream-arrow"><ChevronRight /></span>
                  </button>
                ))
              ) : (
                <div style={{ padding: '30px 14px', textAlign: 'center', color: '#57796d' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>✓</div>
                  <strong style={{ fontSize: '0.94rem', color: '#0e382d', display: 'block' }}>
                    All Clear in This Category
                  </strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>
                    No pending items require immediate attention.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Interactive Clinic Insights Hub (Zero Modals!) */}
      <section className="dashboard-insights-hub" aria-label="Clinic Insights and Analytics">
        <div className="insights-hub-head">
          <div className="dash-panel-title-wrap">
            <h2 className="dash-panel-title">📊 Clinic Insights & Performance Hub</h2>
          </div>

          <div className="insights-hub-tabs">
            <button
              type="button"
              className={`insights-hub-tab-btn ${activeInsightsTab === 'aging' ? 'active' : ''}`}
              onClick={() => setActiveInsightsTab('aging')}
            >
              💳 Payment Aging
            </button>
            <button
              type="button"
              className={`insights-hub-tab-btn ${activeInsightsTab === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveInsightsTab('sales')}
            >
              🛍️ Sales Breakdown
            </button>
            <button
              type="button"
              className={`insights-hub-tab-btn ${activeInsightsTab === 'leads' ? 'active' : ''}`}
              onClick={() => setActiveInsightsTab('leads')}
            >
              🌐 Lead Sources
            </button>
            <button
              type="button"
              className={`insights-hub-tab-btn ${activeInsightsTab === 'staff' ? 'active' : ''}`}
              onClick={() => setActiveInsightsTab('staff')}
            >
              👨‍⚕️ Staff Workload
            </button>
            <button
              type="button"
              className={`insights-hub-tab-btn ${activeInsightsTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveInsightsTab('inventory')}
            >
              📦 Stock Health
            </button>
            <button
              type="button"
              className={`insights-hub-tab-btn ${activeInsightsTab === 'birthdays' ? 'active' : ''}`}
              onClick={() => setActiveInsightsTab('birthdays')}
            >
              🎂 Patient Birthdays
            </button>
          </div>
        </div>

        <div className="insights-hub-body">
          {activeInsightsTab === 'aging' && (
            <InsightBars
              rows={paymentAging}
              emptyTitle="No pending payments."
              emptyCopy="Unpaid client invoices will appear here grouped by age bucket."
              valueFormatter={(row) => `₹ ${row.amount.toLocaleString('en-IN')}`}
            />
          )}

          {activeInsightsTab === 'sales' && (
            <InsightBars
              rows={salesSummary}
              emptyTitle="No sales data recorded in range."
              emptyCopy="Paid invoices will be grouped into medicine, package, and treatment collections."
              valueFormatter={(row) => `₹ ${row.amount.toLocaleString('en-IN')}`}
            />
          )}

          {activeInsightsTab === 'leads' && (
            <InsightBars
              rows={leadSources}
              emptyTitle="No lead sources registered yet."
              emptyCopy="Inquiry sources (Google, Instagram, Referrals) will display their relative contribution here."
              valueFormatter={(row) => `${row.count} lead${row.count === 1 ? '' : 's'}`}
            />
          )}

          {activeInsightsTab === 'staff' && (
            <InsightBars
              rows={staffWorkload}
              emptyTitle="No staff workload recorded yet."
              emptyCopy="Add doctor and therapist names to appointments to track appointment distribution."
              valueFormatter={(row) => `${row.count} appointment${row.count === 1 ? '' : 's'}`}
            />
          )}

          {activeInsightsTab === 'inventory' && (
            <AlertList
              rows={lowStockAlerts}
              emptyTitle="Medicine Inventory is Healthy."
              emptyCopy="Items below 10 units or expiring within 30 days will alert here."
              route="/inventory"
            />
          )}

          {activeInsightsTab === 'birthdays' && (
            <AlertList
              rows={reminders}
              emptyTitle="No Patient Birthdays in Next 30 Days."
              emptyCopy="Birthdays and anniversaries recorded in patient profiles will appear here for warm wishes."
              route="/clients"
            />
          )}
        </div>
      </section>

      {/* 5. Quick Module Shortcuts */}
      <section className="dashboard-shortcuts-panel" aria-label="Hospital Navigation Shortcuts">
        <div className="dashboard-shortcuts-head">
          <h3>🚀 Quick Module Access</h3>
          <span style={{ fontSize: '0.78rem', color: '#5b7a6e' }}>Direct 1-click launch to primary hospital departments</span>
        </div>

        <div className="dashboard-shortcuts-grid">
          <div className="module-shortcut-card" role="button" tabIndex={0} onClick={() => navigate('/journey')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/journey'); }}>
            <div className="module-shortcut-icon">🌟</div>
            <div className="module-shortcut-title">Patient Journey</div>
            <div className="module-shortcut-desc">All-in-one clinic flow: intake, consult, diet, therapy & checkout.</div>
          </div>

          <div className="module-shortcut-card" role="button" tabIndex={0} onClick={() => navigate('/appointments')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/appointments'); }}>
            <div className="module-shortcut-icon">📅</div>
            <div className="module-shortcut-title">Appointments</div>
            <div className="module-shortcut-desc">Patient bookings, calendar schedules, and room allocations.</div>
          </div>

          <div className="module-shortcut-card" role="button" tabIndex={0} onClick={() => navigate('/treatments')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/treatments'); }}>
            <div className="module-shortcut-icon">🌿</div>
            <div className="module-shortcut-title">Treatments & Diets</div>
            <div className="module-shortcut-desc">Prescription plans, Panchakarma cycles, and nutrition schedules.</div>
          </div>

          <div className="module-shortcut-card" role="button" tabIndex={0} onClick={() => navigate('/medicines')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/medicines'); }}>
            <div className="module-shortcut-icon">💊</div>
            <div className="module-shortcut-title">Medicines Catalog</div>
            <div className="module-shortcut-desc">Ayurvedic formulations, dosages, herbs, and therapeutic usage.</div>
          </div>

          <div className="module-shortcut-card" role="button" tabIndex={0} onClick={() => navigate('/payments')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/payments'); }}>
            <div className="module-shortcut-icon">💳</div>
            <div className="module-shortcut-title">Billing & Accounts</div>
            <div className="module-shortcut-desc">Invoices, pending collections, payment receipts, and reports.</div>
          </div>

          <div className="module-shortcut-card" role="button" tabIndex={0} onClick={() => navigate('/forms')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/forms'); }}>
            <div className="module-shortcut-icon">📋</div>
            <div className="module-shortcut-title">Clinical Forms</div>
            <div className="module-shortcut-desc">Patient health questionnaires, consent, and intake surveys.</div>
          </div>
        </div>
      </section>

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
    .slice(0, 4)
    .map((lead) => ({
      title: `Follow up: ${lead.name || 'Unnamed lead'}`,
      note: `${lead.source || 'Lead'} · score ${lead.score || '?'}`,
      route: '/crm',
      tone: 'warm',
      icon: '📞',
      category: 'followup',
    }));
  const collections = payments
    .filter((payment) => paymentPendingAmount(payment) > 0)
    .slice(0, 4)
    .map((payment) => ({
      title: `Collect ${payment.invoice || 'pending invoice'}`,
      note: `${payment.client || 'Patient'} · ₹ ${paymentPendingAmount(payment).toLocaleString('en-IN')} pending`,
      route: '/payments',
      tone: 'hot',
      icon: '💰',
      category: 'collection',
    }));
  const stockTasks = lowStockAlerts.slice(0, 3).map((item) => ({
    title: `Inventory: ${item.title}`,
    note: item.note,
    route: '/inventory',
    tone: item.tone,
    icon: '📦',
    category: 'stock',
  }));
  const reminderTasks = reminders.slice(0, 3).map((item) => ({
    title: item.title,
    note: item.note,
    route: '/clients',
    tone: item.tone,
    icon: '🎂',
    category: 'reminder',
  }));
  const fallback = tasks.slice(0, 3).map((task) => ({
    title: task.title,
    note: task.note,
    route: '/crm',
    tone: 'cool',
    icon: '⚡',
    category: 'task',
  }));
  return [...collections, ...stockTasks, ...reminderTasks, ...followUps, ...fallback];
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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionMenu, Card, StatusPill, Tag } from '../components/ui.jsx';
import { FunnelChart, RevenueChart } from '../components/Charts.jsx';
import { ChevronRight } from '../components/icons.jsx';
import { loadLiveDashboardData, parseLiveAmount } from '../data/liveData.js';
import { useBranch } from '../context/BranchContext.jsx';

const DATE_PRESETS = [
  { label: 'Today', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: 'All Time', days: null },
];

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
  const { branches, currentBranch, setCurrentBranch } = useBranch();
  const [revenuePeriod, setRevenuePeriod] = useState('Week');
  const [datePreset, setDatePreset] = useState('7 Days');
  const [moreInsightsOpen, setMoreInsightsOpen] = useState(false);
  const liveData = loadLiveDashboardData(currentBranch);
  const { funnelStages, kpis, leads, payments, todaySchedule, urgentTasks, revenueSeries, appointments, clients, inventory, packages, staff, treatments } = liveData;
  const filteredLeads = filterRowsByPreset(leads, datePreset, (lead) => lead.addedOn);
  const filteredPayments = filterRowsByPreset(payments, datePreset, (payment) => payment.paidOn);
  const filteredAppointments = filterRowsByPreset(appointments, datePreset, (appointment) => appointment[2] ?? appointment.date);
  const totalRevenue = filteredPayments.reduce((sum, payment) => sum + parseLiveAmount(payment.amount), 0);
  const totalCollections = filteredPayments
    .filter((payment) => String(payment.status ?? '').toLowerCase() === 'paid')
    .reduce((sum, payment) => sum + parseLiveAmount(payment.amount), 0);
  const paymentAging = buildPaymentAging(payments);
  const leadSources = buildLeadSourcePerformance(filteredLeads.length ? filteredLeads : leads);
  const branchComparison = buildBranchComparison(branches, currentBranch);
  const staffWorkload = buildStaffWorkload(filteredAppointments.length ? filteredAppointments : appointments, staff);
  const lowStockAlerts = buildLowStockAlerts(inventory);
  const salesSummary = buildSalesSummary(filteredPayments.length ? filteredPayments : payments, packages, treatments);
  const treatmentProgress = buildTreatmentProgress(treatments, clients);
  const renewalAlerts = buildRenewalAlerts(clients, packages);
  const reminders = buildClientReminders(clients);
  const actionQueue = buildActionQueue(urgentTasks, leads, payments, lowStockAlerts, renewalAlerts, reminders);

  const kpiRoute = (label) => {
    if (label.includes('Appointment')) return '/appointments';
    if (label.includes('Payment')) return '/payments';
    return '/crm';
  };
  const quickActions = [
    ['Add Lead', '/crm?action=add', 'Create new enquiry'],
    ['Add Client', '/clients?action=add', 'Create client profile'],
    ['Book Appointment', '/appointments?action=add', 'Schedule visit'],
    ['Send Form', '/operations?tab=forms', 'Open forms'],
    ['Create Invoice', '/finance?tab=payments&action=add', 'Prepare bill'],
    ['Add Payment', '/finance?tab=payments&action=add', 'Record collection'],
    ['Create Treatment Plan', '/operations?tab=treatments&action=add', 'Start plan'],
    ['Add Coaching Student', '/operations?tab=coaching&action=add', 'Add student'],
  ].map(([label, path, description]) => ({ label, description, onClick: () => navigate(path) }));

  return (
    <>
      <section className="dashboard-controls" aria-label="Dashboard filters">
        <div>
          <span className="control-label">Date range</span>
          <div className="segmented-control" role="group" aria-label="Date range">
            {DATE_PRESETS.map((preset) => (
              <button
                className={datePreset === preset.label ? 'active' : ''}
                type="button"
                key={preset.label}
                onClick={() => setDatePreset(preset.label)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <label className="branch-select">
          <span className="control-label">Branch</span>
          <select value={currentBranch} onChange={(event) => setCurrentBranch(event.target.value)}>
            {branches.map((branch) => (
              <option value={branch} key={branch}>{branch}</option>
            ))}
          </select>
        </label>
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
        <p className="command-message">Use Actions for entry work; open More insights for detailed operational panels.</p>
        <div className="sheet-actions toolbar-actions">
          <ActionMenu label="Actions" items={quickActions} />
          <button className="pill" type="button" onClick={() => setMoreInsightsOpen(true)}>More insights <ChevronRight /></button>
        </div>
      </section>

      <section className="insights-grid">
        <Card title="Branch Comparison" subtitle="Quick health check across active branches.">
          <div className="branch-comparison">
            {branchComparison.map((branch) => (
              <button className={`branch-row ${branch.name === currentBranch ? 'active' : ''}`} type="button" key={branch.name} onClick={() => setCurrentBranch(branch.name)}>
                <span>
                  <strong>{branch.name}</strong>
                  <small>{branch.leads} leads · {branch.appointments} appointments</small>
                </span>
                <b>₹ {branch.revenue.toLocaleString('en-IN')}</b>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Payment Aging" subtitle="Unpaid collections grouped by age.">
          <InsightBars
            rows={paymentAging}
            emptyTitle="No pending payments."
            emptyCopy="Pending invoices will appear here by age bucket."
            valueFormatter={(row) => `₹ ${row.amount.toLocaleString('en-IN')}`}
          />
        </Card>

        <Card title="Lead Source Performance" subtitle={`Showing ${datePreset.toLowerCase()} performance.`}>
          <InsightBars
            rows={leadSources}
            emptyTitle="No lead sources yet."
            emptyCopy="Add leads with sources to compare performance."
            valueFormatter={(row) => `${row.count} lead${row.count === 1 ? '' : 's'}`}
          />
        </Card>

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

              <Card title="Renewals & Expiring Packages" subtitle="Upcoming client package renewals.">
                <AlertList
                  rows={renewalAlerts}
                  emptyTitle="No renewals due."
                  emptyCopy="Package renewal reminders will appear before expiry."
                  route="/packages"
                />
              </Card>

              <Card title="Birthdays & Anniversaries" subtitle="Client dates coming up soon.">
                <AlertList
                  rows={reminders}
                  emptyTitle="No reminders due."
                  emptyCopy="Add birthdays and anniversaries in client profiles."
                  route="/clients"
                />
              </Card>
            </div>
          </div>
        </div>
      )}

      <section className="grid">
        <div className="stack">
          <Card title="Lead Conversion Funnel">
            <FunnelChart stages={funnelStages} />
            <div className="footer-action" style={{ marginTop: 18 }}>
              <span>Conversion Rate: <strong style={{ color: 'var(--green)' }}>0%</strong></span>
              <span className="delta">Awaiting records</span>
            </div>
          </Card>
        </div>

        <Card title="Revenue Trend" action={<button className="pill" type="button" onClick={() => setRevenuePeriod((current) => (current === 'Week' ? 'Month' : 'Week'))}>By {revenuePeriod} <ChevronRight /></button>}>
          <RevenueChart series={revenueSeries} />
          <div className="chart-stats">
            <div className="mini-stat">
              <span>Total Revenue ({datePreset})</span>
              <strong>₹ {totalRevenue.toLocaleString('en-IN')} <span className="delta">{filteredPayments.length ? `${filteredPayments.length} invoice(s)` : 'Awaiting records'}</span></strong>
            </div>
            <div className="mini-stat">
              <span>Total Collections ({datePreset})</span>
              <strong>₹ {totalCollections.toLocaleString('en-IN')} <span className="delta">{totalCollections ? 'Collected' : 'Awaiting records'}</span></strong>
            </div>
          </div>
        </Card>

        <aside className="stack tasks">
          <Card title="Today's Schedule" action={<button className="icon-btn inline-icon" type="button" onClick={() => navigate('/appointments')} aria-label="Open appointments"><ChevronRight /></button>}>
            {todaySchedule.length ? (
              <div className="schedule-list">
                {todaySchedule.map((item) => (
                  <div className="schedule-item" key={`${item.time}-${item.name}`}>
                    <div className="time">{item.time}</div>
                    <div className="tiny-avatar" />
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
                <strong>No appointments yet today.</strong>
                <p>Create the first booking or import data to populate this panel.</p>
              </div>
            )}
            <button className="footer-action button-reset" type="button" onClick={() => navigate('/appointments')}>
              <span>View Full Schedule</span>
              <ChevronRight />
            </button>
          </Card>

          <Card title="Urgent Tasks" action={<StatusPill tone="st-bad">{urgentTasks.length}</StatusPill>}>
            {urgentTasks.length ? (
              <div className="task-list">
                {urgentTasks.map((task, index) => (
                  <div className="task-item" key={task.title}>
                    <div className={`task-icon ${index === 1 ? 'gold' : index === 2 ? 'blue' : index === 3 ? 'green' : ''}`} />
                    <div>
                      <div className="item-title">{task.title}</div>
                      <div className="item-sub">{task.note}</div>
                    </div>
                    <span style={{ color: index === 0 ? '#e35c3e' : '#d98a17', fontWeight: 700 }}>{task.due}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <strong>No urgent tasks.</strong>
                <p>Once records arrive, follow-ups and collections will appear here.</p>
              </div>
            )}
            <button className="footer-action button-reset" type="button" onClick={() => navigate('/crm')}>
              <span>View All Tasks</span>
              <ChevronRight />
            </button>
          </Card>
        </aside>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <Card title="Recent Leads" action={<button className="row-link" type="button" onClick={() => navigate('/crm')}>View All</button>}>
          <ModuleTable type="leads" rows={leads} />
        </Card>
        <Card title="Recent Payments" action={<button className="row-link" type="button" onClick={() => navigate('/payments')}>View All</button>}>
          <ModuleTable type="payments" rows={payments} />
        </Card>
      </section>
    </>
  );
}

function parseLooseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === 'due') return null;
  if (raw.toLowerCase() === 'today') return new Date();
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function filterRowsByPreset(rows, presetLabel, getDate) {
  const preset = DATE_PRESETS.find((item) => item.label === presetLabel);
  if (!preset?.days) return rows;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (preset.days - 1));
  return rows.filter((row) => {
    const date = parseLooseDate(getDate(row));
    return date ? date >= since : preset.days !== 1;
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
    .filter((payment) => String(payment.status ?? '').toLowerCase() !== 'paid')
    .forEach((payment) => {
      const date = parseLooseDate(payment.paidOn);
      const age = date ? Math.max(0, Math.floor((today - date) / 86400000)) : 16;
      const bucket = age <= 7 ? buckets[0] : age <= 15 ? buckets[1] : buckets[2];
      bucket.count += 1;
      bucket.amount += parseLiveAmount(payment.amount);
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

function buildBranchComparison(branches, currentBranch) {
  return branches.map((branch) => {
    const data = loadLiveDashboardData(branch);
    const revenue = data.payments
      .filter((payment) => String(payment.status ?? '').toLowerCase() === 'paid')
      .reduce((sum, payment) => sum + parseLiveAmount(payment.amount), 0);
    return {
      name: branch,
      selected: branch === currentBranch,
      leads: data.leads.length,
      appointments: data.appointments.length,
      revenue,
    };
  });
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
    .filter((payment) => normalizeStatus(payment.status) === 'paid')
    .forEach((payment) => {
      const text = `${payment.invoice ?? ''} ${payment.client ?? ''} ${payment.item ?? ''} ${payment.category ?? ''}`.toLowerCase();
      const amount = parseLiveAmount(payment.amount);
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

function buildRenewalAlerts(clients, packageRows) {
  const packageNames = new Set(packageRows.map((row) => pickRowValue(row, 0, ['package', 'Package', 'name'])).filter(Boolean));
  return clients
    .map((client) => {
      const name = client.name ?? pickRowValue(client, 0, ['Client']);
      const program = client.program ?? pickRowValue(client, 2, ['Program']);
      const nextVisit = client.nextVisit ?? pickRowValue(client, 4, ['Next Visit']);
      const dueIn = daysUntil(nextVisit);
      if (dueIn === null || dueIn < 0 || dueIn > 30) return null;
      return {
        title: name || 'Unnamed client',
        note: `${program || 'Package'}${packageNames.has(program) ? '' : ' renewal'} · due in ${dueIn} day${dueIn === 1 ? '' : 's'}`,
        tone: dueIn <= 7 ? 'hot' : 'warm',
      };
    })
    .filter(Boolean)
    .slice(0, 6);
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
        title: `${label}: ${name || 'Unnamed client'}`,
        note: dueIn === 0 ? 'Today' : `In ${dueIn} day${dueIn === 1 ? '' : 's'}`,
        tone: dueIn <= 7 ? 'warm' : 'cool',
      });
    });
  });
  return rows.sort((a, b) => Number(a.note.match(/\d+/)?.[0] ?? 0) - Number(b.note.match(/\d+/)?.[0] ?? 0)).slice(0, 6);
}

function buildActionQueue(tasks, leads, payments, lowStockAlerts = [], renewalAlerts = [], reminders = []) {
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
    .filter((payment) => String(payment.status ?? '').toLowerCase() !== 'paid')
    .slice(0, 2)
    .map((payment) => ({
      title: `Collect ${payment.invoice || 'pending invoice'}`,
      note: `${payment.client || 'Client'} · ${payment.amount || 'Amount pending'}`,
      route: '/payments',
      tone: 'hot',
    }));
  const stockTasks = lowStockAlerts.slice(0, 1).map((item) => ({
    title: `Inventory: ${item.title}`,
    note: item.note,
    route: '/inventory',
    tone: item.tone,
  }));
  const renewalTasks = renewalAlerts.slice(0, 1).map((item) => ({
    title: `Renewal: ${item.title}`,
    note: item.note,
    route: '/packages',
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
  return [...collections, ...stockTasks, ...renewalTasks, ...reminderTasks, ...followUps, ...fallback].slice(0, 5);
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
            <div>Client</div><div>Invoice #</div><div>Amount</div><div>Status</div><div>Paid On</div><div />
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

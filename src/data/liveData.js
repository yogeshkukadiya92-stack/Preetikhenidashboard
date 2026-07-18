function readStorage(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseAmount(value) {
  const numeric = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function isToday(value) {
  if (!value) return false;
  const today = new Date().toISOString().slice(0, 10);
  const normalized = String(value).trim();
  return normalized === today || normalized.toLowerCase() === 'today';
}

function branchKey(branch, key) {
  return `moms-pathshala:Main Branch:${key}`;
}

function readBranchArray(branch, key, legacyKey, fallback = []) {
  const branchRows = asArray(readStorage(branchKey(branch, key), []));
  if (branchRows.length) return branchRows;
  return asArray(readStorage(legacyKey, fallback));
}

export function loadLiveDashboardData(branch) {
  const leads = asArray(readStorage(branchKey(branch, 'crm:leads:v4'), []));
  const appointments = readBranchArray(branch, 'Appointments:rows:v3', 'ayurflow:Appointments:rows:v2');
  const payments = readBranchArray(branch, 'ayurflow-payments:rows:v3', 'ayurflow:ayurflow-payments:rows:v3');
  const clients = readBranchArray(branch, 'ayurflow-clients:rows:v3', 'ayurflow:ayurflow-clients:rows:v3');
  const inventory = readBranchArray(branch, 'Inventory:rows:v3', 'ayurflow:Inventory:rows:v2');
  const packages = readBranchArray(branch, 'Packages:rows:v3', 'ayurflow:Packages:rows:v2');
  const staff = readBranchArray(branch, 'Staff:rows:v3', 'ayurflow:Staff:rows:v2');
  const treatments = readBranchArray(branch, 'Treatment Plans:rows:v2', 'ayurflow:Treatment Plans:rows:v2');

  const openLeads = leads.filter((lead) => !['Won', 'Lost', 'Closed'].includes(String(lead.status ?? '')));
  const followUps = leads.filter((lead) => String(lead.status ?? '').toLowerCase().includes('follow'));
  const pendingPayments = payments.filter((payment) => String(payment.status ?? '').toLowerCase() !== 'paid');
  const todaysAppointments = appointments.filter((row) => isToday(row[2]));

  return {
    leads,
    appointments,
    payments,
    clients,
    inventory,
    packages,
    staff,
    treatments,
    kpis: [
      { label: "Today's Appointments", value: String(todaysAppointments.length), delta: todaysAppointments.length ? 'Scheduled today' : 'Awaiting records', accent: 'green' },
      { label: 'Open Leads', value: String(openLeads.length), delta: openLeads.length ? `${followUps.length} follow-up due` : 'Awaiting records', accent: 'gold' },
      { label: 'Pending Payments', value: `₹ ${pendingPayments.reduce((sum, payment) => sum + parseAmount(payment.amount), 0).toLocaleString('en-IN')}`, delta: pendingPayments.length ? `${pendingPayments.length} invoice(s)` : 'Awaiting records', accent: 'teal' },
      { label: 'Follow-ups Due', value: String(followUps.length), delta: followUps.length ? 'Needs attention' : 'Awaiting records', accent: 'gold' },
    ],
    funnelStages: buildFunnel(leads),
    revenueSeries: buildRevenueSeries(payments),
    todaySchedule: todaysAppointments.slice(0, 5).map((row) => ({
      time: row[3] || 'Time pending',
      name: row[0] || 'Unnamed patient',
      note: row[4] || 'Appointment',
      status: row[6] || row[5] || 'Pending',
      tone: String(row[6] ?? row[5] ?? '').toLowerCase().includes('confirm') ? 'good' : 'warn',
    })),
    urgentTasks: [
      ...followUps.slice(0, 3).map((lead) => ({
        title: `Follow up with ${lead.name}`,
        note: `${lead.source || 'Lead'} - score ${lead.score || '?'}`,
        due: lead.addedOn || 'Today',
      })),
      ...pendingPayments.slice(0, 2).map((payment) => ({
        title: `Collect ${payment.invoice || 'invoice'}`,
        note: payment.client || 'Payment pending',
        due: payment.paidOn || 'Due',
      })),
    ].slice(0, 5),
  };
}

function buildFunnel(leads) {
  if (!leads.length) return [];
  const stages = [
    ['New', (lead) => String(lead.status ?? '').toLowerCase() === 'new'],
    ['Contacted', (lead) => String(lead.status ?? '').toLowerCase().includes('contact')],
    ['Hot', (lead) => String(lead.status ?? '').toLowerCase() === 'hot'],
    ['Follow-up', (lead) => String(lead.status ?? '').toLowerCase().includes('follow')],
    ['Won', (lead) => String(lead.status ?? '').toLowerCase() === 'won'],
  ];
  return stages.map(([label, match]) => {
    const value = leads.filter(match).length;
    return { label, value, percent: `${Math.round((value / leads.length) * 100)}%` };
  });
}

function buildRevenueSeries(payments) {
  const paidRows = payments.filter((payment) => String(payment.status ?? '').toLowerCase() === 'paid');
  if (!paidRows.length) return [];
  const buckets = new Map();
  paidRows.forEach((payment) => {
    const label = payment.paidOn || 'Unscheduled';
    const current = buckets.get(label) ?? { label, revenue: 0, collections: 0 };
    current.revenue += parseAmount(payment.amount);
    current.collections += parseAmount(payment.amount);
    buckets.set(label, current);
  });
  return Array.from(buckets.values()).slice(-7);
}

export function parseLiveAmount(value) {
  return parseAmount(value);
}

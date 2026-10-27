import { parseLiveAmount } from './liveData.js';
const key = (v) => String(v ?? '').trim().toLowerCase();
export function reportDate(value) {
  const raw = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}
export function serviceGroup(value) {
  const v = key(value);
  if (/weight|obesity|slim/.test(v)) return 'Weight Loss';
  if (/garbh|pregnan/.test(v)) return 'Garbhsanskar';
  if (/skin|hair/.test(v)) return /skin/.test(v) && /hair/.test(v) ? 'Skin & Hair' : /skin/.test(v) ? 'Skin' : 'Hair';
  return String(value ?? '').trim() || 'Unassigned';
}
const social = (v) => /social|instagram|facebook|youtube|whatsapp|\binsta\b|\bfb\b/.test(key(v));
export function buildMonthlyClinicReport({ clients = [], appointments = [], payments = [], leads = [], carePrograms = {} }, month, filters = {}) {
  const patients = new Map();
  const names = new Map();
  clients.forEach((row) => {
    const a = Array.isArray(row); const hasId = a && row.length >= 7;
    const patient = {
      id: String(a ? (hasId ? row[0] : '') : row.clientId ?? row['Client ID'] ?? row.id ?? ''),
      name: String(a ? row[hasId ? 1 : 0] ?? '' : row.name ?? row.Client ?? row.client ?? ''),
      mobile: String(a ? row[hasId ? 2 : 1] ?? '' : row.mobile ?? row.Mobile ?? ''),
      firstDate: reportDate(a ? row.length >= 8 ? row[3] : '' : row.visitDate ?? row['Visit Date'] ?? row.createdAt),
      service: serviceGroup(a ? row[row.length >= 13 ? 8 : row.length >= 8 ? 7 : hasId ? 6 : 5] : row.service ?? row.Service ?? row.program),
      source: String(a ? row.length >= 13 ? row[9] ?? '' : '' : row.reference ?? row.Reference ?? row.source ?? row.referredBy ?? ''),
      dates: [],
    };
    if (!patient.name) return;
    patient.key = patient.id ? `id:${key(patient.id)}` : `person:${key(patient.name)}:${key(patient.mobile)}`;
    const existing = patients.get(patient.key);
    if (existing) {
      if (patient.firstDate && (!existing.firstDate || patient.firstDate < existing.firstDate)) existing.firstDate = patient.firstDate;
      if (patient.firstDate) existing.dates.push(patient.firstDate);
    } else {
      if (patient.firstDate) patient.dates.push(patient.firstDate);
      patients.set(patient.key, patient);
      const n = key(patient.name); names.set(n, [...(names.get(n) ?? []), patient]);
    }
  });
  const match = (id, name, mobile) => {
    if (id && patients.has(`id:${key(id)}`)) return patients.get(`id:${key(id)}`);
    const candidates = names.get(key(name)) ?? [];
    return (mobile && candidates.find(p => key(p.mobile) === key(mobile))) || (candidates.length === 1 ? candidates[0] : null);
  };
  appointments.forEach(row => {
    const a = Array.isArray(row);
    if (/cancel|no.show/.test(key(a ? row[6] ?? row[5] : row.status ?? row.Status))) return;
    const patient = match(a ? '' : row.clientId, a ? row[0] : row.client ?? row.name ?? row.Client, a ? row[1] : row.mobile);
    const date = reportDate(a ? row[2] : row.date ?? row.appointmentDate);
    if (patient && date) { patient.dates.push(date); if (!patient.firstDate || date < patient.firstDate) patient.firstDate = date; }
  });
  (carePrograms.enrollments ?? []).forEach(e => {
    const patient = match(e.clientId, e.patientName, e.mobile);
    if (!patient) return;
    patient.services = [...new Set([...(patient.services || [patient.service]), e.program === 'panchakarma' ? 'Panchakarma' : 'Garbhsanskar'])];
    const start = reportDate(e.startDate);
    if (start) { patient.dates.push(start); if (!patient.firstDate || start < patient.firstDate) patient.firstDate = start; }
    (carePrograms.sessions ?? []).filter(s => s.enrollmentId === e.id && s.status === 'Completed' && s.attendance === 'Present').forEach(s => { const date = reportDate(s.date); if (date) patient.dates.push(date); });
  });
  patients.forEach(p => {
    if (!p.source) {
      const matches = leads.filter(l => key(l.name) === key(p.name) && (!l.mobile || key(l.mobile) === key(p.mobile)));
      if (matches.length === 1) p.source = matches[0].source ?? '';
    }
    p.type = !p.firstDate ? 'Unknown' : p.firstDate.slice(0, 7) === month ? 'New' : 'Old';
    p.sourceGroup = social(p.source) ? 'Social Media' : p.source ? 'Other' : 'Unknown';
  });
  const fits = p => (!filters.type || p.type === filters.type) && (!filters.source || p.sourceGroup === filters.source) && (!filters.service || (p.services || [p.service]).includes(filters.service) || ((p.services || [p.service]).includes('Skin & Hair') && ['Skin', 'Hair'].includes(filters.service)));
  const selected = [...patients.values()].filter(p => p.dates.some(d => d.slice(0, 7) === month) && fits(p));
  const collections = [];
  payments.forEach(row => {
    const a = Array.isArray(row);
    const p = a ? { client: row[0], amount: row[2], paidAmount: row[3], status: row[5], paymentMode: row[6], paidOn: row[7] } : row;
    if (reportDate(p.paidOn ?? p['Paid On']).slice(0, 7) !== month) return;
    const patient = match(p.clientId ?? p['Client ID'], p.client ?? p.Client, p.mobile);
    const mode = /gpay|google\s*pay/.test(key(p.paymentMode ?? p['Payment Mode'])) ? 'GPay' : key(p.paymentMode ?? p['Payment Mode']) === 'cash' ? 'Cash' : 'Other / Unknown';
    const receiptService = p.service || p.Service;
    if (filters.service && receiptService && serviceGroup(receiptService) !== filters.service && !(serviceGroup(receiptService) === 'Skin & Hair' && ['Skin','Hair'].includes(filters.service))) return;
    if ((filters.mode && filters.mode !== mode) || ((filters.type || filters.source || filters.service) && (!patient || !fits(patient)))) return;
    const explicit = p.paidAmount ?? p['Paid Amount'];
    const amount = explicit !== undefined && explicit !== '' ? parseLiveAmount(explicit) : key(p.status ?? p.Status) === 'paid' ? parseLiveAmount(p.amount ?? p['Total Amount']) : 0;
    if (amount <= 0) return;
    collections.push({ mode, amount, category: p.feeType || p['Fee Type'] || 'Unclassified' });
  });
  return { patients: selected, collections, services: [...new Set([...patients.values()].flatMap(p => p.services || [p.service]))].sort(), unknownDates: [...patients.values()].filter(p => !p.firstDate).length };
}

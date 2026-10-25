import { parseLiveAmount } from './liveData.js';

const keyOf = (value) => String(value ?? '').trim().toLowerCase();

export function buildServiceOverview(patients, payments, catalog = []) {
  const groups = new Map();
  const groupFor = (service) => {
    const label = String(service ?? '').trim() || 'Unassigned';
    const key = keyOf(label);
    if (!groups.has(key)) groups.set(key, { key, label, clients: 0, invoices: 0, collection: 0, billing: 0, pending: 0 });
    return groups.get(key);
  };
  catalog.forEach(groupFor);
  const names = new Map();
  const ids = new Map();
  const seen = new Set();
  patients.forEach((patient) => {
    const identity = patient.id ? `id:${keyOf(patient.id)}` : `person:${keyOf(patient.name)}:${keyOf(patient.mobile)}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    groupFor(patient.service).clients += 1;
    const name = keyOf(patient.name);
    names.set(name, [...(names.get(name) ?? []), patient]);
    if (patient.id) ids.set(keyOf(patient.id), patient);
  });
  payments.forEach((payment) => {
    const matches = names.get(keyOf(payment.client)) ?? [];
    const patient = ids.get(keyOf(payment.clientId ?? payment['Client ID'])) ?? (matches.length === 1 ? matches[0] : null);
    const group = groupFor(payment.service || payment.Service || patient?.service);
    const total = parseLiveAmount(payment.amount);
    const status = keyOf(payment.status);
    const explicit = payment.paidAmount !== undefined && payment.paidAmount !== null && payment.paidAmount !== '';
    const paid = explicit ? parseLiveAmount(payment.paidAmount) : status === 'paid' ? total : 0;
    group.invoices += 1;
    group.billing += total;
    group.collection += paid;
    group.pending += status === 'paid' ? 0 : Math.max(total - paid, 0);
  });
  return [...groups.values()].sort((a, b) => b.collection - a.collection || a.label.localeCompare(b.label));
}

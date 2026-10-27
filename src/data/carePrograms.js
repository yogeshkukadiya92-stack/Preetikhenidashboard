import { parseLiveAmount } from './liveData.js';

export const CARE_STORAGE = 'care-programs:v1';
export const PROGRAMS = {
  panchakarma: { name: 'Panchakarma', description: 'Therapy courses, daily treatment charts and patient care.', services: [
    ['Vamana', 'Main Procedure'], ['Virechana', 'Main Procedure'], ['Basti', 'Main Procedure'], ['Niruha Basti', 'Main Procedure'], ['Anuvasana Basti', 'Main Procedure'], ['Matra Basti', 'Main Procedure'], ['Nasya', 'Main Procedure'], ['Raktamokshana', 'Main Procedure'],
    ['Snehapana', 'Preparation'], ['Abhyanga / Massage', 'Preparation'], ['Swedana / Steam', 'Preparation'], ['Deepana / Pachana', 'Preparation'],
    ['Shirodhara', 'Therapy'], ['Shiroabhyanga', 'Therapy'], ['Shiropichu', 'Therapy'], ['Shirobasti', 'Therapy'], ['Udvartana', 'Therapy'], ['Kati Basti', 'Therapy'], ['Janu Basti', 'Therapy'], ['Greeva Basti', 'Therapy'], ['Nadi Sweda', 'Therapy'], ['Patra Pinda Sweda', 'Therapy'], ['Churna Pinda Sweda', 'Therapy'], ['Shashtika Shali Pinda Sweda', 'Therapy'], ['Pizhichil / Kayaseka', 'Therapy'], ['Netra Tarpana', 'Therapy'], ['Karna Purana', 'Therapy'], ['Gandusha / Kavala', 'Therapy'], ['Lepa / Upanaha', 'Therapy'], ['Diet & Aftercare', 'Aftercare'], ['Follow-up Consultation', 'Consultation'],
  ] },
  garbhsanskar: { name: 'Garbhsanskar', description: 'Personal programmes, guided activities, classes and follow-ups.', services: [
    ['Pregnancy Planning Counselling', 'Planning'], ['Couple Counselling', 'Planning'], ['Diet & Lifestyle Counselling', 'Counselling'], ['Pregnancy-safe Yoga', 'Activity'], ['Breathing Practice', 'Activity'], ['Meditation', 'Activity'], ['Music / Garbh Sangeet', 'Activity'], ['Garbh Samvad', 'Activity'], ['Reading & Positive Stories', 'Activity'], ['Shloka / Prayer', 'Activity'], ['Creative Activities / Puzzles', 'Activity'], ['Personal Counselling', 'Counselling'], ['Partner / Family Session', 'Class'], ['Group Garbhsanskar Class', 'Class'], ['Birth Preparation Education', 'Class'], ['Breastfeeding Education', 'Class'], ['Postnatal Support', 'Postnatal'], ['Newborn Care Education', 'Postnatal'], ['Follow-up Consultation', 'Consultation'],
  ] },
};
export const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const newCareId = () => globalThis.crypto.randomUUID();
export function emptyCareState() { return { enrollments: [], sessions: [], packages: [], services: [] }; }
export function readCareState(storage, branch) {
  try { const state = JSON.parse(storage.getItem(`moms-pathshala:${branch}:${CARE_STORAGE}`) ?? '{}'); return Object.fromEntries(Object.keys(emptyCareState()).map(k => [k, Array.isArray(state?.[k]) ? state[k] : []])); } catch { return emptyCareState(); }
}
export function programServices(state, program) {
  const defaults = PROGRAMS[program].services.map(([name, category], i) => ({ id: `${program}-service-${i}`, program, name, category, duration: 30, price: '', active: true }));
  const map = new Map(defaults.map(s => [s.id, s]));
  state.services.filter(s => s.program === program).forEach(s => map.set(s.id, s));
  return [...map.values()];
}
export function carePatients(rows = []) {
  const result = new Map();
  rows.forEach((r) => {
    const a = Array.isArray(r); const h = a && r.length >= 7;
    const id = String(a ? h ? r[0] ?? '' : '' : r.clientId ?? r['Client ID'] ?? r.id ?? '');
    const name = String(a ? r[h ? 1 : 0] ?? '' : r.name ?? r.Client ?? r.client ?? '');
    const mobile = String(a ? r[h ? 2 : 1] ?? '' : r.mobile ?? r.Mobile ?? '');
    if (!name.trim()) return;
    const key = id ? `id:${id.trim().toLowerCase()}` : `person:${name.trim().toLowerCase()}:${mobile.trim()}`;
    const previous = result.get(key);
    result.set(key, { key, id, name, mobile, source: a ? r.length >= 13 ? r[9] ?? '' : '' : r.reference || r.Reference || r.source || previous?.source || '', registeredOn: a ? r.length >= 8 ? r[3] ?? '' : '' : r.visitDate ?? r['Visit Date'] ?? '' });
  });
  return [...result.values()];
}
export function receivedAmount(p) {
  const explicit = p.paidAmount ?? p['Paid Amount'];
  return Math.max(0, explicit !== undefined && explicit !== '' ? parseLiveAmount(explicit) : String(p.status ?? p.Status).toLowerCase() === 'paid' ? parseLiveAmount(p.amount ?? p['Total Amount']) : 0);
}
export function enrollmentBalance(enrollment, payments) {
  const received = payments.filter(p => p.careEnrollmentId === enrollment.id).reduce((n,p) => n + receivedAmount(p), 0);
  return { received, pending: Math.max(0, Number(enrollment.fee || 0) - received) };
}
export function usedSessions(enrollmentId, sessions) { return sessions.filter(s => s.enrollmentId === enrollmentId && s.status === 'Completed' && s.attendance === 'Present' && s.consumesCredit !== false).length; }
export function validateEnrollment(row, state, payments = []) {
  if (!row.patientKey || !row.startDate || !row.name?.trim()) return 'Select a patient, course name and start date.';
  if (!Number.isInteger(Number(row.totalSessions)) || Number(row.totalSessions) < 1) return 'Enter at least one whole session.';
  if (!Number.isFinite(Number(row.fee)) || Number(row.fee) < 0) return 'Enter a valid course fee.';
  if (!row.serviceIds?.length) return 'Select at least one service for this course.';
  const existing = state.enrollments.find(e => e.id === row.id);
  if (existing && existing.patientKey !== row.patientKey) return 'An existing course cannot be reassigned to another patient.';
  const linkedSessions = state.sessions.filter(s => s.enrollmentId === row.id);
  if (linkedSessions.some(s => !row.serviceIds.includes(s.serviceId))) return 'Keep services that have saved sessions in this course.';
  if (linkedSessions.some(s => s.date < row.startDate || (row.endDate && s.date > row.endDate))) return 'Course dates must include all saved session dates.';
  if (row.endDate && row.endDate < row.startDate) return 'End date must be after the start date.';
  if (Number(row.totalSessions) < usedSessions(row.id, state.sessions)) return 'Total sessions cannot be less than sessions already used.';
  if (Number(row.fee) < enrollmentBalance(row, payments).received) return 'Fee cannot be lower than the amount already collected.';
  return '';
}
export function validateSession(row, state) {
  const enrollment = state.enrollments.find(e => e.id === row.enrollmentId && e.program === row.program);
  if (!enrollment) return 'Select a valid patient course.';
  if (!row.date || !/^\d{2}:\d{2}$/.test(row.time ?? '') || !row.serviceId) return 'Select a service, date and time.';
  if (!enrollment.serviceIds.includes(row.serviceId)) return 'This service is not included in the selected course.';
  if (row.status === 'Planned' && enrollment.status !== 'Active') return 'Resume this course before scheduling a planned session.';
  if (!Number.isFinite(Number(row.buffer || 0)) || Number(row.buffer || 0) < 0) return 'Cleanup time must be zero or greater.';
  if (!Number.isFinite(Number(row.duration)) || Number(row.duration) <= 0) return 'Duration must be greater than zero.';
  if (row.date < enrollment.startDate || (enrollment.endDate && row.date > enrollment.endDate)) return 'Session date must be within the course dates.';
  if (row.status === 'Completed' && row.attendance !== 'Present') return 'Mark attendance Present before completing a session.';
  if (row.attendance === 'Absent' && row.status !== 'Missed') return 'Absent attendance must have Missed status.';
  if (['Cancelled', 'Missed'].includes(row.status) && row.attendance === 'Present') return 'A cancelled or missed session cannot be marked Present.';
  if (row.status === 'Planned' && row.consumesCredit !== false && state.sessions.filter(s => s.id !== row.id && s.enrollmentId === row.enrollmentId && s.consumesCredit !== false && ['Planned','Completed'].includes(s.status)).length >= Number(enrollment.totalSessions)) return 'All package sessions are already used or scheduled. Increase the course sessions or choose a no-credit follow-up.';
  if (row.status === 'Completed' && row.consumesCredit !== false && usedSessions(row.enrollmentId, state.sessions.filter(s => s.id !== row.id)) >= Number(enrollment.totalSessions)) return 'All package sessions have been used. Increase the course sessions or mark this as a no-credit follow-up.';
  if (['Cancelled','Missed'].includes(row.status)) return '';
  const minutes = time => Number(time.split(':')[0]) * 60 + Number(time.split(':')[1]);
  const begin = minutes(row.time), end = begin + Number(row.duration) + Number(row.buffer || 0);
  if (end > 1440) return 'Session and cleanup time must finish within the same day.';
  const norm = v => String(v ?? '').trim().toLowerCase();
  const conflict = state.sessions.find(s => {
    if (s.id === row.id || s.date !== row.date || ['Cancelled','Missed'].includes(s.status)) return false;
    const otherEnrollment = state.enrollments.find(e => e.id === s.enrollmentId);
    const samePatient = otherEnrollment?.patientKey === enrollment.patientKey;
    const sharedClass = row.program === 'garbhsanskar' && s.program === row.program && norm(row.batch) && norm(row.batch) === norm(s.batch) && row.serviceId === s.serviceId && row.time === s.time && Number(row.duration) === Number(s.duration);
    const resourceConflict = !sharedClass && ((norm(row.therapist) && norm(s.therapist) === norm(row.therapist)) || (norm(row.room) && norm(s.room) === norm(row.room)));
    return (samePatient || resourceConflict) && begin < minutes(s.time) + Number(s.duration) + Number(s.buffer || 0) && end > minutes(s.time);
  });
  return conflict ? 'This patient course, therapist or room already has a session during this time (including cleanup).' : '';
}
export function createCarePayment({ enrollment, amount, mode, date, feeType, note = '', id, existingPayments = [] }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a collection greater than zero.');
  if (!['Cash','GPay'].includes(mode) || !date) throw new Error('Select Cash or GPay and a payment date.');
  const balance = enrollmentBalance(enrollment, existingPayments);
  if (value > balance.pending) throw new Error('Collection cannot exceed the remaining course fee.');
  if (!['Consultation','Therapy / Activity','Package','Medicine','Other'].includes(feeType)) throw new Error('Select a fee type.');
  return { id, invoice: `CARE-${id}`, client: enrollment.patientName, clientId: enrollment.clientId, service: PROGRAMS[enrollment.program].name, careProgramId: enrollment.program, careEnrollmentId: enrollment.id, amount: String(value), paidAmount: String(value), pendingAmount: '0', status: 'Paid', paymentMode: mode, paidOn: date, feeType, note };
}
export function careMonthlySummary(state, payments, month, program, patients = []) {
  const enrollments = state.enrollments.filter(e => e.program === program);
  const sessions = state.sessions.filter(s => s.program === program && s.date?.startsWith(month));
  const relevant = enrollments.filter(e => e.startDate?.startsWith(month) || sessions.some(s => s.enrollmentId === e.id && s.status === 'Completed' && s.attendance === 'Present'));
  const ids = new Set(relevant.map(e => e.patientKey));
  const newPatients = [...ids].filter(key => !enrollments.some(e => e.patientKey === key && e.startDate < `${month}-01`));
  const receipts = payments.filter(p => p.careProgramId === program && String(p.paidOn ?? '').startsWith(month));
  const sum = mode => receipts.filter(p => !mode || p.paymentMode === mode).reduce((n,p) => n + receivedAmount(p), 0);
  const atEnd = enrollments.filter(e => e.startDate < `${month}-32`);
  const asOfPayments = payments.filter(p => (p.paidOn ?? '') < `${month}-32`);
  const sources = new Map(patients.map(p => [p.key, p.source]));
  return { patients: ids.size, newPatients: newPatients.length, oldPatients: ids.size-newPatients.length,
    social: [...ids].filter(k => /social|instagram|facebook|youtube|whatsapp|\bfb\b|\binsta\b/i.test(sources.get(k) || relevant.find(e => e.patientKey === k)?.source || '')).length,
    sessions: sessions.length, completed: sessions.filter(s => s.status === 'Completed' && s.attendance === 'Present').length, missed: sessions.filter(s => s.status === 'Missed').length,
    present: sessions.filter(s => s.attendance === 'Present').length, absent: sessions.filter(s => s.attendance === 'Absent').length,
    collection: sum(), cash: sum('Cash'), gpay: sum('GPay'), consultation: receipts.filter(p => p.feeType === 'Consultation').reduce((n,p) => n+receivedAmount(p),0),
    pending: atEnd.reduce((n,e) => n+enrollmentBalance(e,asOfPayments).pending,0), active: enrollments.filter(e => e.status === 'Active').length };
}

export function scheduleCareSessions(draft, state, idFactory = newCareId) {
  const count = draft.id ? 1 : Number(draft.repeatCount || 1);
  const interval = Number(draft.intervalDays || 1);
  if (!Number.isInteger(count) || count < 1 || count > 60 || !Number.isInteger(interval) || interval < 1) throw Error('Repeat sessions must be 1–60 with at least one day between sessions.');
  let next = {...state, sessions: state.sessions.filter(s => s.id !== draft.id)};
  for (let i=0;i<count;i+=1) {
    const date = new Date(`${draft.date}T12:00:00`);
    date.setDate(date.getDate()+i*interval);
    const row = {...draft, id:draft.id || idFactory(), date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`};
    delete row.repeatCount; delete row.intervalDays;
    const issue = validateSession(row,next); if(issue) throw Error(`${row.date}: ${issue}`);
    next = {...next,sessions:[...next.sessions,row]};
  }
  return next;
}
export function validateCareReceiptEdit(payment, state, otherPayments) {
  const course=state.enrollments.find(e=>e.id===payment.careEnrollmentId);
  if (!course) return 'The linked course could not be found.';
  if (payment.client !== course.patientName) return 'This receipt belongs to the enrolled patient; its patient cannot be changed.';
  if (receivedAmount(payment) > enrollmentBalance(course,otherPayments).pending) return 'Collection cannot exceed the remaining course fee.';
  return '';
}

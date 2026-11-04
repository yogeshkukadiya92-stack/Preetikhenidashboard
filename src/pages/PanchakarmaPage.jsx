import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui.jsx';
import { useBranch } from '../context/BranchContext.jsx';
import { loadLiveDashboardData } from '../data/liveData.js';
import { CARE_STORAGE, carePatients, readCareState, newCareId, enrollmentBalance } from '../data/carePrograms.js';
import { Field, Modal } from './CareProgramPage.jsx';

const dateLabel = value => value ? value.split('-').reverse().join('/') : '—';
export function PanchakarmaPage() {
  const { currentBranch, branchKey } = useBranch();
  const [revision, refresh] = useState(0);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const update = () => refresh(v => v + 1);
    const events = ['storage', 'moms-pathshala:cloud-hydrated', 'moms-pathshala:care-updated'];
    events.forEach(e => window.addEventListener(e, update));
    return () => events.forEach(e => window.removeEventListener(e, update));
  }, []);
  const state = useMemo(() => readCareState(window.localStorage, currentBranch), [currentBranch, revision]);
  const live = useMemo(() => loadLiveDashboardData(currentBranch), [currentBranch, revision]);
  const patients = carePatients(live.clients);
  const rows = state.enrollments.filter(e => e.program === 'panchakarma' && `${e.patientName} ${e.name}`.toLowerCase().includes(search.toLowerCase()));
  const update = (key, value) => setDraft(d => ({ ...d, [key]: value }));
  const open = row => {
    setError('');
    const days = row ? (row.treatmentDays || state.sessions.filter(s => s.enrollmentId === row.id).sort((a,b) => a.date.localeCompare(b.date)).map(s => ({ date: s.date, staff: s.therapist || '' }))) : [];
    setDraft({ patientKey: '', name: '', totalSessions: 1, installmentDate: '', feedbackBy: '', feedbackDate: '', reviewBy: '', reviewDate: '', ...row,
      payment: row?.payment ?? (row ? live.payments.filter(p => p.careEnrollmentId === row.id).map(p => p.paidAmount || '').join(' / ') : ''),
      remainingPayment: row?.remainingPayment ?? (row ? enrollmentBalance(row, live.payments).pending : ''), treatmentDays: days });
  };
  const save = () => {
    const patient = patients.find(p => p.key === draft.patientKey);
    if (!patient && !draft.id) { setError('Select a patient name.'); return; }
    if (!draft.name.trim() || !Number.isInteger(Number(draft.totalSessions)) || Number(draft.totalSessions) < 1) { setError('Enter the type of Panchkarma and total days suggested by doctor.'); return; }
    if (draft.treatmentDays.length > Number(draft.totalSessions)) { setError('Total days cannot be fewer than the day entries.'); return; }
    if (draft.treatmentDays.some(d => !d.date)) { setError('Enter a date for each day.'); return; }
    if (draft.remainingPayment !== '' && (!Number.isFinite(Number(draft.remainingPayment)) || Number(draft.remainingPayment) < 0)) { setError('Enter a valid remaining payment.'); return; }
    try {
      const latest = readCareState(window.localStorage, currentBranch);
      const row = { ...draft, id: draft.id || newCareId(), program: 'panchakarma', patientName: patient?.name || draft.patientName, clientId: patient?.id || draft.clientId, mobile: patient?.mobile || draft.mobile,
        totalSessions: Number(draft.totalSessions), startDate: draft.treatmentDays[0]?.date || draft.startDate || '', serviceIds: draft.serviceIds || [], status: draft.status || 'Active', fee: draft.fee || 0 };
      window.localStorage.setItem(branchKey(CARE_STORAGE), JSON.stringify({ ...latest, enrollments: [...latest.enrollments.filter(e => e.id !== row.id), row] }));
      window.dispatchEvent(new Event('moms-pathshala:care-updated'));
      setDraft(null); setMessage('Panchkarma record saved.');
    } catch { setError('Could not save. Please try again.'); }
  };
  return <div className="care-page care-panchakarma">
    <div className="care-page-heading"><h1>Panchkarma</h1><button className="pill primary-action" onClick={() => open()}>+ Add Patient</button></div>
    {message && <p className="care-notice" role="status">{message}</p>}
    <Card title="Patients">
      <Field label="Search patient" value={search} onChange={setSearch}/>
      <div className="care-table-wrap"><table className="care-table"><thead><tr><th>Patient name</th><th>Type of Panchkarma</th><th>Total days suggested by doctor</th><th>Day, date & staff</th><th>Payment</th><th>Remain payment</th><th>Installment date</th><th>Feedback taken by & date</th><th>Google review taken by & date</th><th>Action</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.patientName}</strong></td><td>{row.name}</td><td>{row.totalSessions}</td><td>{(row.treatmentDays || state.sessions.filter(s => s.enrollmentId === row.id).map(s => ({date:s.date,staff:s.therapist}))).map((day,i) => <small key={i}>Day {i+1}: {dateLabel(day.date)} · {day.staff || '—'}</small>)}</td><td>{(row.payment ?? live.payments.filter(p => p.careEnrollmentId === row.id).map(p => p.paidAmount).join(' / ')) || '—'}</td><td>{row.remainingPayment ?? enrollmentBalance(row,live.payments).pending}</td><td>{dateLabel(row.installmentDate)}</td><td>{row.feedbackBy || '—'}<small>{dateLabel(row.feedbackDate)}</small></td><td>{row.reviewBy || '—'}<small>{dateLabel(row.reviewDate)}</small></td><td><button className="pill" onClick={() => open(row)}>Edit</button></td></tr>)}</tbody>
      </table>{!rows.length && <p className="care-empty">No Panchkarma records found.</p>}</div>
    </Card>
    {draft && <Modal title="Panchkarma" onClose={() => setDraft(null)} onSave={save} error={error}>
      <Field label="Patient name" required disabled={Boolean(draft.id)} value={draft.patientKey} onChange={v => update('patientKey',v)} options={[{value:'',label:draft.patientName || 'Select patient'},...patients.map(p => ({value:p.key,label:p.name}))]}/>
      <Field label="Type of Panchkarma" required value={draft.name} onChange={v => update('name',v)}/>
      <Field label="Total days suggested by doctor" type="number" min="1" step="1" required value={draft.totalSessions} onChange={v => update('totalSessions',v)}/>
      <div className="care-full"><h3>Day and date</h3>{draft.treatmentDays.map((day,i) => <div className="care-form-grid" key={i}>
        <Field label={`Day ${i+1} date`} type="date" required value={day.date} onChange={v => update('treatmentDays',draft.treatmentDays.map((d,j) => j===i ? {...d,date:v} : d))}/>
        <Field label={`Day ${i+1} process done by (staff name)`} value={day.staff} onChange={v => update('treatmentDays',draft.treatmentDays.map((d,j) => j===i ? {...d,staff:v} : d))}/>
        <button type="button" className="pill" onClick={() => update('treatmentDays',draft.treatmentDays.filter((_,j) => j!==i))}>Remove day {i+1}</button>
      </div>)}<button type="button" className="pill" disabled={draft.treatmentDays.length >= Number(draft.totalSessions)} onClick={() => update('treatmentDays',[...draft.treatmentDays,{date:'',staff:''}])}>+ Add day</button></div>
      <Field label="Payment (e.g. 300 / 1500 / 800)" value={draft.payment} onChange={v => update('payment',v)}/>
      <Field label="Remain payment" type="number" min="0" step="0.01" value={draft.remainingPayment} onChange={v => update('remainingPayment',v)}/>
      <Field label="Installment date" type="date" value={draft.installmentDate} onChange={v => update('installmentDate',v)}/>
      <Field label="Feedback taken by" value={draft.feedbackBy} onChange={v => update('feedbackBy',v)}/><Field label="Feedback date" type="date" value={draft.feedbackDate} onChange={v => update('feedbackDate',v)}/>
      <Field label="Google review taken by" value={draft.reviewBy} onChange={v => update('reviewBy',v)}/><Field label="Google review date" type="date" value={draft.reviewDate} onChange={v => update('reviewDate',v)}/>
    </Modal>}
  </div>;
}

import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui.jsx';
import { useBranch } from '../context/BranchContext.jsx';
import { loadLiveDashboardData } from '../data/liveData.js';
import { CARE_STORAGE, carePatients, readCareState, newCareId, enrollmentBalance, receivedAmount } from '../data/carePrograms.js';
import { Field, Modal } from './CareProgramPage.jsx';

const completionOptions = [{ value: '', label: 'Select status' }, { value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }];
const completionLabel = value => value === 'Yes' || value === 'No' ? value : 'Not recorded';
const money = value => `₹ ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
    setDraft({ doctorName: '', staffName: '', duration: '', dose: '', patientEntryMode: 'existing', patientName: '', patientKey: '', name: '', totalSessions: 1, installmentDate: '', feedbackTaken: '', reviewGiven: '', feedbackBy: '', feedbackDate: '', reviewBy: '', reviewDate: '', ...row,
      fee: row ? (row.fee != null && row.fee !== '' ? Number(row.fee) : (enrollmentBalance(row, live.payments).received + Number(row.remainingPayment || 0))) : '',
      openingPaidAmount: row ? enrollmentBalance(row, live.payments).received - (row.paymentEntries || []).reduce((sum, entry) => sum + Number(entry.amount), 0) - live.payments.filter(p => p.careEnrollmentId === row.id).reduce((sum, p) => sum + receivedAmount(p), 0) : 0,
      newPayment: '', paymentDate: new Date().toLocaleDateString('en-CA'), treatmentDays: days });
  };
  const save = () => {
    const directEntry = draft.patientEntryMode === 'direct';
    const patient = directEntry ? null : patients.find(p => p.key === draft.patientKey);
    if (!draft.id && (directEntry ? !draft.patientName.trim() : !patient)) {
      setError(directEntry ? 'Enter the patient name.' : 'Select a patient name.'); return;
    }
    if (!draft.name.trim() || !Number.isInteger(Number(draft.totalSessions)) || Number(draft.totalSessions) < 1) { setError('Enter the type of Panchkarma and total days suggested by doctor.'); return; }
    if (draft.treatmentDays.length > Number(draft.totalSessions)) { setError('Total days cannot be fewer than the day entries.'); return; }
    if (draft.treatmentDays.some(d => !d.date)) { setError('Enter a date for each day.'); return; }
    if (draft.fee === '' || !Number.isFinite(Number(draft.fee)) || Number(draft.fee) < 0) { setError('Enter a valid total service amount.'); return; }
    if (!Number.isFinite(Number(draft.openingPaidAmount)) || Number(draft.openingPaidAmount) < 0) { setError('Enter a valid earlier paid amount.'); return; }
    if (!Number.isFinite(Number(draft.newPayment)) || Number(draft.newPayment) < 0) { setError('Enter a valid payment amount.'); return; }
    if (Number(draft.newPayment) > 0 && !draft.paymentDate) { setError('Enter the payment date.'); return; }
    try {
      const latest = readCareState(window.localStorage, currentBranch);
      const latestPayments = loadLiveDashboardData(currentBranch).payments;
      const existing = latest.enrollments.find(e => e.id === draft.id);
      const balance = enrollmentBalance({ ...existing, ...draft }, latestPayments);
      if (balance.received + Number(draft.newPayment) > Number(draft.fee)) { setError('Total service amount cannot be less than the payments received.'); return; }
      const paymentEntries = [...(draft.paymentEntries || [])];
      if (Number(draft.newPayment) > 0) paymentEntries.push({ id: newCareId(), amount: Number(draft.newPayment), date: draft.paymentDate });
      const row = { ...draft, openingPaidAmount: Number(draft.openingPaidAmount), paymentEntries, id: draft.id || newCareId(), program: 'panchakarma', patientKey: draft.patientKey || `direct:${newCareId()}`, patientName: patient?.name || draft.patientName.trim(), clientId: patient?.id || draft.clientId, mobile: patient?.mobile || draft.mobile,
        totalSessions: Number(draft.totalSessions), startDate: draft.treatmentDays[0]?.date || draft.startDate || '', serviceIds: draft.serviceIds || [], status: draft.status || 'Active', fee: Number(draft.fee), remainingPayment: Number(draft.fee) - balance.received - Number(draft.newPayment) };
      delete row.newPayment; delete row.paymentDate; delete row.patientEntryMode;
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
      <div className="care-table-wrap"><table className="care-table"><thead><tr><th>Patient name</th><th>Type of Panchkarma / Duration / Dose</th><th>Doctor & staff</th><th>Total days suggested by doctor</th><th>Day, date & staff</th><th>Total service amount</th><th>Paid amount & history</th><th>Pending amount</th><th>Installment date</th><th>Feedback taken? / By & date</th><th>Google review given? / By & date</th><th>Action</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.patientName}</strong></td><td><strong>{row.name}</strong><small>Duration: {row.duration || '—'}</small><small>Dose: {row.dose || '—'}</small></td><td><small>Doctor: {row.doctorName || '—'}</small><small>Staff: {row.staffName || '—'}</small></td><td>{row.totalSessions}</td><td>{(row.treatmentDays || state.sessions.filter(s => s.enrollmentId === row.id).map(s => ({date:s.date,staff:s.therapist}))).map((day,i) => <small key={i}>Day {i+1}: {dateLabel(day.date)} · {day.staff || '—'}</small>)}</td><td>{money(row.fee != null && row.fee !== '' ? Number(row.fee) : (enrollmentBalance(row,live.payments).received + Number(row.remainingPayment || 0)))}</td><td><strong>{money(enrollmentBalance(row,live.payments).received)}</strong>{Number(row.openingPaidAmount) > 0 ? <small>Earlier payments: {money(row.openingPaidAmount)}</small> : row.openingPaidAmount == null && row.payment ? <small>Earlier payments: {row.payment}</small> : null}{(row.paymentEntries || []).map(entry => <small key={entry.id}>{dateLabel(entry.date)} · {money(entry.amount)}</small>)}</td><td>{money(Math.max(0, (row.fee != null && row.fee !== '' ? Number(row.fee) : (enrollmentBalance(row,live.payments).received + Number(row.remainingPayment || 0))) - enrollmentBalance(row,live.payments).received))}</td><td>{dateLabel(row.installmentDate)}</td><td><strong>{completionLabel(row.feedbackTaken)}</strong><small>{row.feedbackBy || '—'}</small><small>{dateLabel(row.feedbackDate)}</small></td><td><strong>{completionLabel(row.reviewGiven)}</strong><small>{row.reviewBy || '—'}</small><small>{dateLabel(row.reviewDate)}</small></td><td><button className="pill" onClick={() => open(row)}>Edit</button></td></tr>)}</tbody>
      </table>{!rows.length && <p className="care-empty">No Panchkarma records found.</p>}</div>
    </Card>
    {draft && <Modal title="Panchkarma" onClose={() => setDraft(null)} onSave={save} error={error}>
      <fieldset className="care-full care-form-grid panchkarma-details-box">
        <legend>Doctor details</legend>
        <Field label="Doctor name" value={draft.doctorName} onChange={v => update('doctorName',v)}/>
      {!draft.id && <div className="care-full">
        <Field label="Patient entry" value={draft.patientEntryMode} onChange={v => setDraft(d => ({ ...d, patientEntryMode: v, patientKey: '', patientName: '' }))} options={[{value:'existing',label:'Select existing patient'},{value:'direct',label:'Type patient name (without consultation)'}]}/>
      </div>}
      {draft.id ? <div className="field-block"><span>Patient name</span><strong>{draft.patientName}</strong></div> : draft.patientEntryMode === 'direct' ?
        <Field label="Patient name" required value={draft.patientName} onChange={v => update('patientName',v)}/> :
        <Field label="Patient name" required value={draft.patientKey} onChange={v => update('patientKey',v)} options={[{value:'',label:'Select patient'},...patients.map(p => ({value:p.key,label:p.name}))]}/>}

      <Field label="Type of Panchkarma" required value={draft.name} onChange={v => update('name',v)}/>
      <Field label="Duration (include unit, e.g. minutes or days)" value={draft.duration} onChange={v => update('duration',v)}/>
      <Field label="Dose (include unit)" value={draft.dose} onChange={v => update('dose',v)}/>
      <Field label="Total days suggested by doctor" type="number" min="1" step="1" required value={draft.totalSessions} onChange={v => update('totalSessions',v)}/>
      </fieldset>
      <fieldset className="care-full care-form-grid panchkarma-details-box">
        <legend>Staff details & payment</legend>
        <Field label="Staff name" value={draft.staffName} onChange={v => update('staffName',v)}/>
      <div className="care-full"><h3>Day and date</h3>{draft.treatmentDays.map((day,i) => <div className="care-form-grid" key={i}>
        <Field label={`Day ${i+1} date`} type="date" required value={day.date} onChange={v => update('treatmentDays',draft.treatmentDays.map((d,j) => j===i ? {...d,date:v} : d))}/>
        <Field label={`Day ${i+1} process done by (staff name)`} value={day.staff} onChange={v => update('treatmentDays',draft.treatmentDays.map((d,j) => j===i ? {...d,staff:v} : d))}/>
        <button type="button" className="pill" onClick={() => update('treatmentDays',draft.treatmentDays.filter((_,j) => j!==i))}>Remove day {i+1}</button>
      </div>)}<button type="button" className="pill" disabled={draft.treatmentDays.length >= Number(draft.totalSessions)} onClick={() => update('treatmentDays',[...draft.treatmentDays,{date:'',staff:''}])}>+ Add day</button></div>
      <Field label="Total service amount" type="number" min="0" step="0.01" required value={draft.fee} onChange={v => update('fee',v)}/>
      <div className="field-block"><Field label="Earlier paid amount" type="number" min="0" step="0.01" value={draft.openingPaidAmount} onChange={v => update('openingPaidAmount',v)}/><button type="button" className="pill" onClick={() => update('openingPaidAmount', 0)}>Clear earlier amount</button></div>
      <div className="field-block"><span>Already paid (automatic)</span><strong>{money(enrollmentBalance(draft,live.payments).received)}</strong></div>
      <Field label="Add payment this visit" type="number" min="0" step="0.01" value={draft.newPayment} onChange={v => update('newPayment',v)}/>
      <Field label="Payment date" type="date" value={draft.paymentDate} onChange={v => update('paymentDate',v)}/>
      <div className="field-block"><span>Pending amount (automatic)</span><strong>{money(Math.max(0, Number(draft.fee || 0) - enrollmentBalance(draft,live.payments).received - Number(draft.newPayment || 0)))}</strong></div>
      {(draft.paymentEntries || []).length > 0 && <div className="care-full"><h3>Payment history</h3>{draft.paymentEntries.map((entry, index) => <p key={entry.id}>{dateLabel(entry.date)} · {money(entry.amount)} <button type="button" className="pill" onClick={() => update('paymentEntries', draft.paymentEntries.filter((_, i) => i !== index))}>Remove payment</button></p>)}</div>}
      <Field label="Installment date" type="date" value={draft.installmentDate} onChange={v => update('installmentDate',v)}/>
      </fieldset>
      <Field label="Feedback taken?" value={draft.feedbackTaken} onChange={v => update('feedbackTaken',v)} options={completionOptions}/>
      <Field label="Google review given?" value={draft.reviewGiven} onChange={v => update('reviewGiven',v)} options={completionOptions}/>
      <Field label="Feedback taken by" value={draft.feedbackBy} onChange={v => update('feedbackBy',v)}/><Field label="Feedback date" type="date" value={draft.feedbackDate} onChange={v => update('feedbackDate',v)}/>
      <Field label="Google review taken by" value={draft.reviewBy} onChange={v => update('reviewBy',v)}/><Field label="Google review date" type="date" value={draft.reviewDate} onChange={v => update('reviewDate',v)}/>
    </Modal>}
  </div>;
}

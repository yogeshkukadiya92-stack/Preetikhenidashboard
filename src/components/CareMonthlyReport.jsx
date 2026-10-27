import { useMemo, useState } from 'react';
import { Card } from './ui.jsx';
import { PROGRAMS, careMonthlySummary, carePatients, isoToday, programServices } from '../data/carePrograms.js';
const money = n => `₹ ${n.toLocaleString('en-IN')}`;
export function CareMonthlyReport({ state, payments, clients = [], fixedProgram }) {
  const [month, setMonth] = useState(() => isoToday().slice(0,7));
  const [program, setProgram] = useState('');
  const rows = useMemo(() => Object.entries(PROGRAMS).filter(([id]) => !(fixedProgram || program) || id === (fixedProgram || program)).map(([id, config]) => ({ id, name: config.name, ...careMonthlySummary(state, payments, month, id, carePatients(clients)) })), [state,payments,clients,month,program,fixedProgram]);
  const breakdown = useMemo(() => rows.flatMap(row => {
    const names = new Map(programServices(state,row.id).map(service => [service.id,service.name]));
    const groups = new Map();
    state.sessions.filter(s => s.program === row.id && s.date?.startsWith(month)).forEach(s => {
      if (!groups.has(s.serviceId)) groups.set(s.serviceId,{name:names.get(s.serviceId)||s.serviceId,program:row.name,patients:new Set(),total:0,completed:0,present:0,absent:0});
      const group=groups.get(s.serviceId); const enrollment=state.enrollments.find(e => e.id === s.enrollmentId);
      group.total+=1;
      if (s.status === 'Completed' && s.attendance === 'Present') { group.completed+=1; if(enrollment) group.patients.add(enrollment.patientKey); }
      if(s.attendance==='Present') group.present+=1;
      if(s.attendance==='Absent') group.absent+=1;
    });
    return [...groups.values()];
  }),[rows,state,month]);
  const exportReport = () => {
    const headers = ['Service','Month','Patients','New to Service','Returning','Social Media','Sessions','Completed','Present','Absent','Cash','GPay','Consultation Collection','Total Collection','Outstanding at Month End'];
    const lines = rows.map(r => [r.name,month,r.patients,r.newPatients,r.oldPatients,r.social,r.sessions,r.completed,r.present,r.absent,r.cash,r.gpay,r.consultation,r.collection,r.pending]);
    const blob = new Blob(['\uFEFF'+[headers,...lines].map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`care-report-${month}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return <Card title="Monthly Care Programme Report" subtitle="Service enrolments, attendance and actual collections" className="care-report">
    <div className="care-toolbar"><label className="field-block"><span>Report month</span><input className="lead-input" type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} /></label>{!fixedProgram && <label className="field-block"><span>Report service</span><select className="lead-input" value={program} onChange={e=>setProgram(e.target.value)}><option value="">Both services</option>{Object.entries(PROGRAMS).map(([id,c])=><option key={id} value={id}>{c.name}</option>)}</select></label>}<button className="pill" onClick={exportReport}>Export CSV</button></div>
    <div className="care-table-wrap"><table className="care-table"><thead><tr><th>Service</th><th>Patients</th><th>New to service</th><th>Returning</th><th>Social media</th><th>Sessions / Completed</th><th>Present / Absent</th><th>Cash</th><th>GPay</th><th>Consultation</th><th>Total collection</th><th>Outstanding</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.name}</strong></td><td>{r.patients}</td><td>{r.newPatients}</td><td>{r.oldPatients}</td><td>{r.social}</td><td>{r.sessions} / {r.completed}</td><td>{r.present} / {r.absent}</td><td>{money(r.cash)}</td><td>{money(r.gpay)}</td><td>{money(r.consultation)}</td><td>{money(r.collection)}</td><td>{money(r.pending)}</td></tr>)}</tbody></table></div>
    {breakdown.length > 0 && <div className="care-table-wrap"><table className="care-table"><caption style={{textAlign:'left',padding:'16px 18px',fontWeight:700}}>Therapy / Activity Breakdown</caption><thead><tr><th>Service</th><th>Therapy / Activity</th><th>Attended patients</th><th>Sessions</th><th>Completed</th><th>Present / Absent</th></tr></thead><tbody>{breakdown.map(r=><tr key={`${r.program}-${r.name}`}><td>{r.program}</td><td>{r.name}</td><td>{r.patients.size}</td><td>{r.total}</td><td>{r.completed}</td><td>{r.present} / {r.absent}</td></tr>)}</tbody></table></div>}
    <p className="care-hint">Patients are unique within each service: enrolled this month or attended a completed session. New means first enrolment in that service; returning means enrolled earlier. Outstanding includes all courses started by month end, less collections recorded by then. Attendance counts sessions. Consultation is included in total collection.</p>
  </Card>;
}

import { useMemo, useState } from 'react';
import { Card } from './ui.jsx';
import { buildMonthlyClinicReport } from '../data/monthlyClinicReport.js';
const money = value => `₹ ${value.toLocaleString('en-IN')}`;
export function MonthlyClinicReport({ data, branch }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [filters, setFilters] = useState({ type: '', source: '', service: '', mode: '' });
  const report = useMemo(() => buildMonthlyClinicReport(data, month, filters), [data, month, filters]);
  const sum = (mode, category) => report.collections.filter(p => (!mode || p.mode === mode) && (!category || p.category === category)).reduce((n, p) => n + p.amount, 0);
  const cards = [
    ['Total Patients', report.patients.length], ['New Patients', report.patients.filter(p => p.type === 'New').length],
    ['Old Patients', report.patients.filter(p => p.type === 'Old').length], ['Social Media Patients', report.patients.filter(p => p.sourceGroup === 'Social Media').length],
    ...['Weight Loss', 'Skin', 'Hair', 'Panchakarma', 'Garbhsanskar'].map(service => [service, report.patients.filter(p => (p.services || [p.service]).includes(service) || ((p.services || [p.service]).includes('Skin & Hair') && ['Skin', 'Hair'].includes(service))).length]),
    ['Consultation Collection', money(sum('', 'Consultation'))], ['Consultation · GPay', money(sum('GPay', 'Consultation'))], ['Consultation · Cash', money(sum('Cash', 'Consultation'))],
    ['Total Collection', money(sum())], ['All Fees · GPay', money(sum('GPay'))], ['All Fees · Cash', money(sum('Cash'))], ['Unclassified Fees', money(sum('', 'Unclassified'))], ['Other / Unknown Mode', money(sum('Other / Unknown'))],
  ];
  const select = (field, label, values) => <label className="field-block"><span>{label}</span><select className="lead-input" value={filters[field]} onChange={e => setFilters(f => ({ ...f, [field]: e.target.value }))}><option value="">All</option>{values.map(v => <option key={v}>{v}</option>)}</select></label>;
  return <Card title="Monthly Patient & Collection Report" subtitle={`${branch} · Month-end summary`} className="monthly-clinic-report">
    <div className="monthly-report-filters">
      <label className="field-block"><span>Report Month</span><input className="lead-input" type="month" value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }} /></label>
      {select('type', 'Patient Type', ['New', 'Old'])}{select('source', 'Patient Source', ['Social Media', 'Other', 'Unknown'])}
      {select('service', 'Service', [...new Set(['Weight Loss', 'Skin', 'Hair', 'Garbhsanskar', ...report.services])])}
      {select('mode', 'Collection Mode', ['GPay', 'Cash', 'Other / Unknown'])}
      <button className="pill" type="button" onClick={() => setFilters({ type: '', source: '', service: '', mode: '' })}>Reset Filters</button>
    </div>
    <p className="subtle">Unique patients with a registration, programme enrolment, completed programme session or non-cancelled appointment in this month. New = first recorded date in this month; old = earlier date. Mode filters collections; patient filters apply to both. Only received amounts count as collection.</p>
    <div className="monthly-report-stats">{cards.map(([label, value]) => <div className="mini-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <p className="subtle">Skin & Hair patients appear in both service counts. Unclassified fees need a Fee Type in Payments before they count as consultation fees.{report.unknownDates ? ` ${report.unknownDates} patient(s) have no recorded date and are excluded.` : ''}</p>
    <div className="table-wrap"><table><thead><tr><th>Patient</th><th>Patient ID</th><th>Type</th><th>Service</th><th>Source / Reference</th></tr></thead><tbody>{report.patients.map(p => <tr key={p.key}><td>{p.name}</td><td>{p.id || '—'}</td><td>{p.type}</td><td>{(p.services || [p.service]).join(', ')}</td><td>{p.source || 'Unknown'}</td></tr>)}</tbody></table>{!report.patients.length && <p className="subtle">No patients match this month and filters.</p>}</div>
  </Card>;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, StatusPill } from '../components/ui.jsx';
import { useBranch } from '../context/BranchContext.jsx';

const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Excused'];

function loadValue(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
}

function patientDetails(row) {
  if (Array.isArray(row)) return row.length >= 7
    ? { id: row[0] ?? '', name: row[1] ?? '', mobile: row[2] ?? '' }
    : { id: '', name: row[0] ?? '', mobile: row[1] ?? '' };
  return {
    id: row?.clientId ?? row?.['Client ID'] ?? row?.id ?? '',
    name: row?.name ?? row?.Client ?? row?.client ?? '',
    mobile: row?.mobile ?? row?.Mobile ?? row?.phone ?? '',
  };
}

function localDate() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function localTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function makeRosterRecord(person, source = 'Student') {
  return { id: person.id || `member_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: person.name, mobile: person.mobile || '', source, status: 'Present', note: '' };
}

function percent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9\u0900-\u097f\u0a80-\u0aff]+/g, ' ').replace(/\s+/g, ' ');
}

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += character;
  }
  cells.push(value.trim());
  return cells;
}

function parseZoomParticipants(csv) {
  const lines = String(csv ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const findIndex = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const nameIndex = findIndex('name (original name)', 'participant name', 'name');
  const durationIndex = findIndex('duration (minutes)', 'duration');
  const emailIndex = findIndex('user email', 'email');
  if (nameIndex < 0) return [];
  const rows = lines.slice(1).map(parseCsvLine).map((cells) => ({
    name: cells[nameIndex] ?? '',
    email: emailIndex >= 0 ? cells[emailIndex] ?? '' : '',
    minutes: durationIndex >= 0 ? Number(String(cells[durationIndex] ?? '').replace(/[^\d.]/g, '')) || 0 : 1,
  })).filter((participant) => participant.name);
  const combined = new Map();
  rows.forEach((participant) => {
    const key = participant.email.toLowerCase() || normalizeName(participant.name);
    const existing = combined.get(key);
    combined.set(key, existing ? { ...existing, minutes: existing.minutes + participant.minutes } : participant);
  });
  return Array.from(combined.values());
}

function validZoomUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)zoom\.us$/i.test(url.hostname);
  } catch { return false; }
}

function downloadCsv(sessions) {
  const rows = [['Date', 'Time', 'Session', 'Group', 'Mode', 'Name', 'Mobile', 'Status', 'Note']];
  sessions.forEach((session) => session.records.forEach((record) => rows.push([
    session.date, session.time, session.title, session.group, session.mode, record.name, record.mobile, record.status, record.note,
  ])));
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-${localDate()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AttendancePage() {
  const { branchKey } = useBranch();
  const sessionsKey = branchKey('attendance-sessions:v1');
  const patientsKey = branchKey('ayurflow-clients:rows:v3');
  const [sessions, setSessions] = useState(() => loadValue(sessionsKey, []));
  const [sessionForm, setSessionForm] = useState(() => ({ title: '', group: 'Students', date: localDate(), time: localTime(), mode: 'Offline', zoomLink: '', minimumMinutes: 20, notes: '' }));
  const [roster, setRoster] = useState([]);
  const [newMember, setNewMember] = useState({ name: '', mobile: '' });
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('Create a session and mark attendance.');
  const zoomCsvInputRef = useRef(null);

  const patients = useMemo(() => loadValue(patientsKey, []).map(patientDetails).filter((patient) => patient.name), [patientsKey]);
  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => [session.title, session.group, session.mode, session.date, ...session.records.map((record) => record.name)].join(' ').toLowerCase().includes(query));
  }, [search, sessions]);
  const todaySessions = sessions.filter((session) => session.date === localDate());
  const totalMarked = sessions.reduce((sum, session) => sum + session.records.length, 0);
  const totalPresent = sessions.reduce((sum, session) => sum + session.records.filter((record) => ['Present', 'Late'].includes(record.status)).length, 0);
  const currentPresent = roster.filter((record) => record.status === 'Present').length;

  useEffect(() => {
    try { window.localStorage.setItem(sessionsKey, JSON.stringify(sessions)); } catch { setMessage('Attendance could not be saved. Browser storage is unavailable.'); }
  }, [sessions, sessionsKey]);

  useEffect(() => {
    const refresh = () => setSessions(loadValue(sessionsKey, []));
    window.addEventListener('storage', refresh);
    window.addEventListener('moms-pathshala:cloud-hydrated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('moms-pathshala:cloud-hydrated', refresh);
    };
  }, [sessionsKey]);

  const addMember = (person = newMember, source = sessionForm.group === 'Patients' ? 'Patient' : 'Student') => {
    const name = String(person.name ?? '').trim();
    if (!name) return;
    const duplicate = roster.some((record) => (person.id && record.id === person.id) || (record.name.toLowerCase() === name.toLowerCase() && record.mobile === (person.mobile || '')));
    if (duplicate) {
      setMessage(`${name} is already in this attendance roster.`);
      return;
    }
    setRoster((current) => [...current, makeRosterRecord({ ...person, name }, source)]);
    setNewMember({ name: '', mobile: '' });
    setMessage(`${name} added to the roster.`);
  };

  const importPatients = () => {
    const existing = new Set(roster.map((record) => record.id || `${record.name}-${record.mobile}`));
    const additions = patients.filter((patient) => !existing.has(patient.id || `${patient.name}-${patient.mobile}`)).map((patient) => makeRosterRecord(patient, 'Patient'));
    setRoster((current) => [...current, ...additions]);
    setSessionForm((current) => ({ ...current, group: 'Patients' }));
    setMessage(`${additions.length} patient${additions.length === 1 ? '' : 's'} added to the roster.`);
  };

  const updateRecord = (id, key, value) => setRoster((current) => current.map((record) => record.id === id ? { ...record, [key]: value } : record));
  const markEveryone = (status) => setRoster((current) => current.map((record) => ({ ...record, status })));

  const importZoomAttendance = async (file) => {
    if (!file) return;
    const participants = parseZoomParticipants(await file.text());
    if (!participants.length) {
      setMessage('Zoom CSV could not be read. Export the participant report from Zoom and try again.');
      return;
    }
    const minimumMinutes = Math.max(1, Number(sessionForm.minimumMinutes) || 1);
    let matched = 0;
    const nextRoster = roster.map((record) => {
      const recordName = normalizeName(record.zoomName || record.name);
      const participant = participants.find((item) => {
        const zoomName = normalizeName(item.name);
        return zoomName === recordName || zoomName.includes(recordName) || recordName.includes(zoomName);
      });
      if (!participant) return { ...record, status: 'Absent', zoomMinutes: 0 };
      matched += 1;
      return {
        ...record,
        status: participant.minutes >= minimumMinutes ? 'Present' : 'Late',
        zoomMinutes: participant.minutes,
        zoomParticipantName: participant.name,
        note: `Zoom: ${participant.minutes} min${record.note ? ` · ${record.note}` : ''}`,
      };
    });
    setRoster(nextRoster);
    setSessionForm((current) => ({ ...current, mode: current.mode === 'Offline' ? 'Online' : current.mode }));
    setMessage(`Zoom attendance imported: ${matched}/${roster.length} roster members matched. Minimum present duration: ${minimumMinutes} minutes.`);
  };

  const saveSession = () => {
    if (!sessionForm.title.trim()) return setMessage('Enter a class/session name before saving.');
    if (!roster.length) return setMessage('Add at least one student or patient to the roster.');
    const session = { id: `attendance_${Date.now()}`, ...sessionForm, title: sessionForm.title.trim(), records: roster, createdAt: new Date().toISOString() };
    setSessions((current) => [session, ...current]);
    setRoster([]);
    setSessionForm((current) => ({ ...current, title: '', date: localDate(), time: localTime(), notes: '' }));
    setMessage(`Attendance saved for ${session.title}: ${currentPresent}/${roster.length} present.`);
  };

  return (
    <section className="module-page attendance-page">
      <div className="module-hero compact-hero">
        <div><h1>Attendance</h1><p>Take structured attendance for students, patients, online classes, and offline sessions.</p><p className="subtle">Shared cloud workspace</p></div>
        <div className="module-stats">
          <div className="mini-stat"><span>Today&apos;s Sessions</span><strong>{todaySessions.length}</strong></div>
          <div className="mini-stat"><span>Total Marked</span><strong>{totalMarked}</strong></div>
          <div className="mini-stat"><span>Attendance Rate</span><strong>{percent(totalPresent, totalMarked)}%</strong></div>
        </div>
      </div>

      <div className="action-note" role="status">{message}</div>
      <Card title="New Attendance Session" subtitle="Set the class details, build the roster, then mark and save attendance.">
        <div className="attendance-session-form">
          <label className="field-block"><span>Class / Session name *</span><input className="lead-input" value={sessionForm.title} onChange={(event) => setSessionForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Garbhasanskar Batch A" /></label>
          <label className="field-block"><span>Attendance for</span><select className="lead-input" value={sessionForm.group} onChange={(event) => setSessionForm((current) => ({ ...current, group: event.target.value }))}><option>Students</option><option>Patients</option><option>Mixed Group</option></select></label>
          <label className="field-block"><span>Date</span><input className="lead-input" type="date" value={sessionForm.date} onChange={(event) => setSessionForm((current) => ({ ...current, date: event.target.value }))} /></label>
          <label className="field-block"><span>Time</span><input className="lead-input" type="time" value={sessionForm.time} onChange={(event) => setSessionForm((current) => ({ ...current, time: event.target.value }))} /></label>
          <label className="field-block"><span>Mode</span><select className="lead-input" value={sessionForm.mode} onChange={(event) => setSessionForm((current) => ({ ...current, mode: event.target.value }))}><option>Offline</option><option>Online</option><option>Hybrid</option></select></label>
          <label className="field-block"><span>Session notes</span><input className="lead-input" value={sessionForm.notes} onChange={(event) => setSessionForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Topic, teacher, or batch note" /></label>
          <label className="field-block attendance-zoom-link"><span>Zoom Meeting Link</span><div className="attendance-link-input"><input className="lead-input" type="url" value={sessionForm.zoomLink} onChange={(event) => setSessionForm((current) => ({ ...current, zoomLink: event.target.value, mode: event.target.value ? 'Online' : current.mode }))} placeholder="https://zoom.us/j/..." /><button className="pill" type="button" disabled={!validZoomUrl(sessionForm.zoomLink)} onClick={() => window.open(sessionForm.zoomLink, '_blank', 'noopener,noreferrer')}>Open Zoom</button></div></label>
          <label className="field-block"><span>Minimum minutes for Present</span><input className="lead-input" type="number" min="1" value={sessionForm.minimumMinutes} onChange={(event) => setSessionForm((current) => ({ ...current, minimumMinutes: event.target.value }))} /><small className="field-help">Less time is marked Late; no Zoom match is marked Absent.</small></label>
        </div>

        <div className="attendance-roster-tools">
          <div><strong>Attendance Roster</strong><span>{roster.length} member{roster.length === 1 ? '' : 's'} · {currentPresent} present</span></div>
          <div className="card-action-group"><input ref={zoomCsvInputRef} className="hidden-file-input" type="file" accept=".csv,text/csv" onChange={(event) => { importZoomAttendance(event.target.files?.[0]); event.target.value = ''; }} /><button className="pill" type="button" onClick={importPatients} disabled={!patients.length}>Import Patients</button><button className="pill" type="button" disabled={!roster.length} onClick={() => zoomCsvInputRef.current?.click()}>Import Zoom CSV</button><button className="pill" type="button" disabled={!roster.length} onClick={() => markEveryone('Present')}>Mark all Present</button><button className="pill" type="button" disabled={!roster.length} onClick={() => markEveryone('Absent')}>Mark all Absent</button></div>
        </div>

        <div className="attendance-add-member">
          <input className="lead-input" value={newMember.name} onChange={(event) => setNewMember((current) => ({ ...current, name: event.target.value }))} placeholder="Student / patient name" />
          <input className="lead-input" type="tel" value={newMember.mobile} onChange={(event) => setNewMember((current) => ({ ...current, mobile: event.target.value }))} placeholder="Mobile (optional)" />
          <button className="pill" type="button" disabled={!newMember.name.trim()} onClick={() => addMember()}>+ Add to Roster</button>
        </div>

        <div className="attendance-roster">
          {roster.map((record, index) => (
            <div className="attendance-roster-row" key={record.id}>
              <span className="attendance-number">{index + 1}</span>
              <div className="attendance-person"><strong>{record.name}</strong><small>{record.zoomMinutes !== undefined ? `Zoom ${record.zoomMinutes} min` : record.mobile || record.source}</small></div>
              <select className={`lead-input attendance-status status-${record.status.toLowerCase()}`} value={record.status} onChange={(event) => updateRecord(record.id, 'status', event.target.value)}>{ATTENDANCE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
              <input className="lead-input" value={record.note} onChange={(event) => updateRecord(record.id, 'note', event.target.value)} placeholder="Note (optional)" />
              <button className="icon-btn" type="button" onClick={() => setRoster((current) => current.filter((item) => item.id !== record.id))} aria-label={`Remove ${record.name}`}>x</button>
            </div>
          ))}
          {!roster.length && <div className="empty-state compact-empty"><strong>Roster is empty.</strong><p>Add students manually or import registered patients.</p></div>}
        </div>
        <div className="attendance-save-bar"><span>{roster.length ? `${currentPresent} present · ${roster.length - currentPresent} other` : 'No attendance marked yet'}</span><button className="pill primary-action" type="button" onClick={saveSession}>Save Attendance</button></div>
      </Card>

      <Card title="Attendance History" subtitle="Search previous sessions and review every marked record." action={<button className="pill" type="button" disabled={!sessions.length} onClick={() => downloadCsv(sessions)}>Export CSV</button>}>
        <input className="lead-input attendance-history-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by session, student, patient, date, or mode..." />
        <div className="attendance-history-list">
          {filteredSessions.map((session) => {
            const present = session.records.filter((record) => ['Present', 'Late'].includes(record.status)).length;
            return <details className="attendance-history-session" key={session.id}>
              <summary><div><strong>{session.title}</strong><span>{session.date} · {session.time} · {session.group} · {session.mode}{session.zoomLink ? ' · Zoom linked' : ''}</span></div><div><strong>{present}/{session.records.length}</strong><small>{percent(present, session.records.length)}% attended</small></div></summary>
              {validZoomUrl(session.zoomLink) && <div className="attendance-history-zoom"><span>Zoom meeting linked to this session.</span><a className="pill" href={session.zoomLink} target="_blank" rel="noreferrer">Open Zoom</a></div>}
              <div className="attendance-history-records">{session.records.map((record) => <div key={record.id}><span><strong>{record.name}</strong><small>{record.mobile || 'No mobile'}{record.note ? ` · ${record.note}` : ''}</small></span><StatusPill tone={record.status === 'Present' ? 'st-ok' : record.status === 'Absent' ? 'st-draft' : 'st-progress'}>{record.status}</StatusPill></div>)}</div>
            </details>;
          })}
          {!filteredSessions.length && <div className="empty-state compact-empty"><strong>No attendance sessions found.</strong><p>Saved sessions will appear here date-wise.</p></div>}
        </div>
      </Card>
    </section>
  );
}

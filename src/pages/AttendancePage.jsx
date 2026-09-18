import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, StatusPill } from '../components/ui.jsx';
import { useBranch } from '../context/BranchContext.jsx';
import { useParams } from 'react-router-dom';

const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Excused'];

const QUESTION_TYPES = [
  { value: 'text', label: 'Short answer', icon: '—', group: 'Basic' },
  { value: 'textarea', label: 'Paragraph (Long text)', icon: '¶', group: 'Basic' },
  { value: 'radio', label: 'Multiple choice', icon: '◉', group: 'Choice' },
  { value: 'checkbox', label: 'Checkboxes (Multi-select)', icon: '☑', group: 'Choice' },
  { value: 'select', label: 'Dropdown', icon: '▾', group: 'Choice' },
  { value: 'number', label: 'Number / Vitals', icon: '#', group: 'Input' },
  { value: 'date', label: 'Date', icon: '📅', group: 'Input' },
  { value: 'time', label: 'Time', icon: '⏰', group: 'Input' },
  { value: 'rating', label: 'Star Rating (1-5)', icon: '★', group: 'Rating' },
  { value: 'scale', label: 'Linear Scale (1-10)', icon: '1-10', group: 'Rating' },
  { value: 'yesno', label: 'Yes / No', icon: '⇌', group: 'Choice' },
  { value: 'file', label: 'File upload (Name / Photo)', icon: '📎', group: 'Advanced' },
  { value: 'heading', label: 'Section Heading / Notice', icon: 'H', group: 'Layout' },
];

const QUESTION_TEMPLATES = [
  {
    name: 'Simple Check-in',
    description: 'Name, mobile and general remarks',
    fields: [
      { id: 'f_rem', type: 'text', label: 'Remark / Center / Location', placeholder: 'e.g. Center Room 2 / Online', required: false, options: [] },
    ],
  },
  {
    name: 'Pregnancy & Vitals',
    description: 'Trimester, mood, vitals, symptoms, and doubts',
    fields: [
      { id: 'f_tri', type: 'select', label: 'Current Trimester', options: ['1st Trimester (1-12 wks)', '2nd Trimester (13-27 wks)', '3rd Trimester (28-40 wks)', 'Postnatal Mother'], required: true },
      { id: 'f_mood', type: 'rating', label: 'How are you feeling today?', required: true, options: [] },
      { id: 'f_weight', type: 'number', label: 'Current Weight (kg)', placeholder: 'e.g. 62.5', required: false, options: [] },
      { id: 'f_bp', type: 'text', label: 'Blood Pressure (BP)', placeholder: 'e.g. 120/80', required: false, options: [] },
      { id: 'f_symp', type: 'checkbox', label: 'Any symptoms or concerns today?', options: ['Nausea / Vomiting', 'Back / Pelvic Pain', 'Swelling in Feet', 'Fatigue / Low Energy', 'Headache', 'None - Feeling Great!'], required: false },
      { id: 'f_query', type: 'textarea', label: 'Questions for Doctor / Yoga Instructor', placeholder: 'Write anything you want to ask...', required: false, options: [] },
    ],
  },
  {
    name: 'Yoga & Wellness Class',
    description: 'Mode, exercises done, energy score, and feedback',
    fields: [
      { id: 'f_mode', type: 'radio', label: 'Attendance Mode', options: ['Attending in Center (Offline)', 'Joining from Home (Online)'], required: true },
      { id: 'f_asanas', type: 'checkbox', label: 'Practices completed today', options: ['Pranayama (Breathing)', 'Gentle Stretches', 'Garbhasanskar Meditation', 'Pelvic Floor Exercises', 'Music Therapy'], required: false },
      { id: 'f_energy', type: 'scale', label: 'Energy & Relaxation Level (1 to 10)', min: 1, max: 10, required: false, options: [] },
      { id: 'f_meds', type: 'yesno', label: 'Did you take your prescribed medicines / supplements today?', required: false, options: [] },
      { id: 'f_feedback', type: 'textarea', label: 'Session feedback or notes', placeholder: 'Share your experience today...', required: false, options: [] },
    ],
  },
  {
    name: 'Student Workshop Feedback',
    description: 'Topic comprehension, task status, class rating',
    fields: [
      { id: 'f_topic_comp', type: 'yesno', label: 'Was today’s lesson easy to follow?', required: true, options: [] },
      { id: 'f_class_rate', type: 'rating', label: 'Rate today’s session', required: true, options: [] },
      { id: 'f_task_status', type: 'radio', label: 'Assignment / Task status', options: ['Completed', 'In Progress', 'Need help from teacher'], required: false },
      { id: 'f_doubts', type: 'textarea', label: 'Any doubts or questions?', placeholder: 'Describe your query...', required: false, options: [] },
    ],
  },
];

const PRESET_OPTIONS = [
  { label: 'Yes / No', options: ['Yes', 'No'] },
  { label: 'Rating (1-5)', options: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'] },
  { label: 'Trimester', options: ['1st Trimester', '2nd Trimester', '3rd Trimester', 'Postnatal'] },
  { label: 'Session Mode', options: ['Offline (Center)', 'Online (Zoom/Meet)'] },
  { label: 'Batch Timing', options: ['Morning 7:00 AM', 'Morning 10:00 AM', 'Afternoon 3:00 PM', 'Evening 6:00 PM'] },
];

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

function makeRosterRecord(person, source = 'Student', answers = {}) {
  return {
    id: person.id || `member_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: person.name,
    mobile: person.mobile || '',
    source,
    status: 'Present',
    note: person.note || '',
    answers,
  };
}

function makeQuestionField(type = 'text', label = '') {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: label || (type === 'heading' ? 'New Section' : 'Untitled Question'),
    help: '',
    placeholder: '',
    required: false,
    options: ['radio', 'checkbox', 'select'].includes(type) ? ['Option 1', 'Option 2'] : [],
    min: type === 'scale' ? 1 : 0,
    max: type === 'scale' ? 10 : 100,
  };
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

function attendanceSlug(title) {
  const base = String(title || 'attendance').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'attendance';
  return `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function attendanceRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Attendance form service is unavailable.');
  return body;
}

function downloadCsv(sessions) {
  const questionMap = new Map();
  sessions.forEach((session) => {
    (session.records || []).forEach((record) => {
      if (record.answers) {
        Object.entries(record.answers).forEach(([qId, val]) => {
          if (!questionMap.has(qId)) {
            const field = (session.fields || []).find((f) => f.id === qId);
            questionMap.set(qId, field?.label || qId);
          }
        });
      }
    });
  });

  const questionKeys = Array.from(questionMap.keys());
  const header = ['Date', 'Time', 'Session', 'Group', 'Mode', 'Name', 'Mobile', 'Status', 'Note', ...questionKeys.map((k) => `[Q] ${questionMap.get(k)}`)];
  const rows = [header];

  sessions.forEach((session) => session.records.forEach((record) => {
    const customCells = questionKeys.map((k) => {
      const val = record.answers?.[k];
      if (Array.isArray(val)) return val.join('; ');
      if (val && typeof val === 'object') return val.name || JSON.stringify(val);
      return val ?? '';
    });
    rows.push([
      session.date,
      session.time,
      session.title,
      session.group,
      session.mode,
      record.name,
      record.mobile,
      record.status,
      record.note,
      ...customCells,
    ]);
  }));
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
  const formsKey = branchKey('attendance-forms:v1');
  const patientsKey = branchKey('ayurflow-clients:rows:v3');

  const [sessions, setSessions] = useState(() => loadValue(sessionsKey, []));
  const [attendanceForms, setAttendanceForms] = useState(() => loadValue(formsKey, []));
  const [sessionForm, setSessionForm] = useState(() => ({
    title: '',
    group: 'Students',
    date: localDate(),
    time: localTime(),
    mode: 'Offline',
    zoomLink: '',
    minimumMinutes: 20,
    notes: '',
    fields: [],
  }));
  const [roster, setRoster] = useState([]);
  const [newMember, setNewMember] = useState({ name: '', mobile: '' });
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  // Modals & Panels
  const [selectedAttendanceForm, setSelectedAttendanceForm] = useState(null);
  const [activeAttendanceForm, setActiveAttendanceForm] = useState(null);
  const [editingAttendanceForm, setEditingAttendanceForm] = useState(null);
  const [builderTab, setBuilderTab] = useState('questions'); // 'settings' | 'questions' | 'preview'
  const [sharingForm, setSharingForm] = useState(null);
  const [viewingAnswersRecord, setViewingAnswersRecord] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const zoomCsvInputRef = useRef(null);

  const patients = useMemo(() => loadValue(patientsKey, []).map(patientDetails).filter((patient) => patient.name), [patientsKey]);
  const patientMatches = useMemo(() => {
    const query = `${newMember.name} ${newMember.mobile}`.trim().toLowerCase().replace(/\s+/g, ' ');
    if (query.length < 2) return [];
    return patients.filter((patient) => `${patient.name} ${patient.mobile}`.toLowerCase().includes(query)).slice(0, 6);
  }, [newMember, patients]);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => [
      session.title,
      session.group,
      session.mode,
      session.date,
      ...session.records.map((record) => record.name),
    ].join(' ').toLowerCase().includes(query));
  }, [search, sessions]);

  const todaySessions = sessions.filter((session) => session.date === localDate());
  const totalMarked = sessions.reduce((sum, session) => sum + session.records.length, 0);
  const totalPresent = sessions.reduce((sum, session) => sum + session.records.filter((record) => ['Present', 'Late'].includes(record.status)).length, 0);
  const currentPresent = roster.filter((record) => record.status === 'Present').length;

  useEffect(() => {
    try { window.localStorage.setItem(sessionsKey, JSON.stringify(sessions)); }
    catch { setMessage('Attendance could not be saved. Browser storage is unavailable.'); }
  }, [sessions, sessionsKey]);

  useEffect(() => {
    try { window.localStorage.setItem(formsKey, JSON.stringify(attendanceForms)); }
    catch { setMessage('Attendance forms could not be saved. Browser storage is unavailable.'); }
  }, [attendanceForms, formsKey]);

  useEffect(() => {
    const refresh = () => {
      setSessions(loadValue(sessionsKey, []));
      setAttendanceForms(loadValue(formsKey, []));
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('moms-pathshala:cloud-hydrated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('moms-pathshala:cloud-hydrated', refresh);
    };
  }, [formsKey, sessionsKey]);

  // Live synchronisation of public submissions while taking attendance
  useEffect(() => {
    if (!activeAttendanceForm?.slug) return;
    const interval = setInterval(() => {
      const currentSessions = loadValue(sessionsKey, []);
      const match = currentSessions.find((s) => s.publicSlug === activeAttendanceForm.slug || s.title === activeAttendanceForm.title);
      if (match?.records?.length) {
        setRoster((currentRoster) => {
          const existingIds = new Set(currentRoster.map((r) => r.id));
          const newEntries = match.records.filter((r) => !existingIds.has(r.id));
          if (newEntries.length > 0) {
            setMessage(`${newEntries.length} new attendance response(s) received from public form.`);
            return [...currentRoster, ...newEntries];
          }
          return currentRoster;
        });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeAttendanceForm, sessionsKey]);

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

  const updateRecord = (id, key, value) => setRoster((current) => current.map((record) => (record.id === id ? { ...record, [key]: value } : record)));
  const markEveryone = (status) => setRoster((current) => current.map((record) => ({ ...record, status })));

  const blankAttendanceForm = () => ({
    id: `attendance_form_${Date.now()}`,
    title: '',
    slug: attendanceSlug('form'),
    group: 'Students',
    mode: 'Offline',
    notes: '',
    zoomLink: '',
    minimumMinutes: 20,
    fields: [
      makeQuestionField('text', 'Any remarks or questions today?'),
    ],
    updatedAt: new Date().toISOString(),
  });

  const saveAttendanceForm = async () => {
    const title = editingAttendanceForm?.title?.trim();
    if (!title) {
      setMessage('Please enter a Form Name.');
      return;
    }
    const slug = editingAttendanceForm.slug || attendanceSlug(title);
    const form = {
      ...editingAttendanceForm,
      title,
      slug,
      fields: editingAttendanceForm.fields || [],
      updatedAt: new Date().toISOString(),
    };

    setAttendanceForms((current) => [form, ...current.filter((item) => item.id !== form.id)]);
    setEditingAttendanceForm(null);
    setMessage(`"${title}" attendance form saved.`);

    try {
      await attendanceRequest(`/api/attendance/forms/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          sessionId: form.id,
        }),
      });
    } catch {
      // Local offline storage is preserved
    }
  };

  const deleteAttendanceForm = (form) => {
    if (!window.confirm(`Delete "${form.title}" attendance form? Saved attendance history will remain available.`)) return;
    setAttendanceForms((current) => current.filter((item) => item.id !== form.id));
    setSelectedAttendanceForm(null);
    setEditingAttendanceForm(null);
    setSharingForm(null);
    setMessage(`"${form.title}" attendance form deleted.`);
  };

  const startMarkingAttendance = (form) => {
    setSessionForm({
      title: form.title,
      group: form.group,
      mode: form.mode,
      notes: form.notes || '',
      zoomLink: form.zoomLink || '',
      minimumMinutes: form.minimumMinutes || 20,
      fields: form.fields || [],
      slug: form.slug,
      date: localDate(),
      time: localTime(),
    });
    setRoster([]);
    setSelectedAttendanceForm(null);
    setActiveAttendanceForm(form);
    setMessage('');
  };

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
    setMessage(`Zoom attendance imported: ${matched}/${roster.length} members matched.`);
  };

  const saveSession = () => {
    if (!sessionForm.title.trim()) return setMessage('Enter a class/session name before saving.');
    if (!roster.length) return setMessage('Add at least one student or patient to the roster.');
    const sessionId = activeAttendanceForm?.id ? `session_${activeAttendanceForm.id}_${Date.now()}` : `attendance_${Date.now()}`;
    const session = {
      id: sessionId,
      ...sessionForm,
      title: sessionForm.title.trim(),
      records: roster,
      fields: activeAttendanceForm?.fields || sessionForm.fields || [],
      publicSlug: activeAttendanceForm?.slug || sessionForm.slug || '',
      createdAt: new Date().toISOString(),
    };
    setSessions((current) => [session, ...current]);
    setRoster([]);
    setMessage(`Attendance saved for "${session.title}": ${currentPresent}/${roster.length} present.`);
    setActiveAttendanceForm(null);
  };

  // Question builder operations
  const addQuestion = (type = 'text', label = '') => {
    const newField = makeQuestionField(type, label);
    setEditingAttendanceForm((current) => ({
      ...current,
      fields: [...(current?.fields || []), newField],
    }));
  };

  const updateQuestion = (index, key, value) => {
    setEditingAttendanceForm((current) => {
      const fields = [...(current?.fields || [])];
      fields[index] = { ...fields[index], [key]: value };
      return { ...current, fields };
    });
  };

  const removeQuestion = (index) => {
    setEditingAttendanceForm((current) => {
      const fields = [...(current?.fields || [])];
      fields.splice(index, 1);
      return { ...current, fields };
    });
  };

  const duplicateQuestion = (index) => {
    setEditingAttendanceForm((current) => {
      const fields = [...(current?.fields || [])];
      const source = fields[index];
      const copy = {
        ...source,
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: `${source.label} (Copy)`,
        options: [...(source.options || [])],
      };
      fields.splice(index + 1, 0, copy);
      return { ...current, fields };
    });
  };

  const moveQuestion = (index, direction) => {
    setEditingAttendanceForm((current) => {
      const fields = [...(current?.fields || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= fields.length) return current;
      const temp = fields[index];
      fields[index] = fields[targetIndex];
      fields[targetIndex] = temp;
      return { ...current, fields };
    });
  };

  const applyTemplate = (template) => {
    if (editingAttendanceForm?.fields?.length > 0) {
      if (!window.confirm(`Replace current questions with the "${template.name}" template?`)) return;
    }
    const clonedFields = template.fields.map((f) => ({
      ...f,
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      options: [...(f.options || [])],
    }));
    setEditingAttendanceForm((current) => ({
      ...current,
      fields: clonedFields,
    }));
    setMessage(`"${template.name}" template questions loaded.`);
  };

  const addOption = (questionIndex) => {
    setEditingAttendanceForm((current) => {
      const fields = [...(current?.fields || [])];
      const options = [...(fields[questionIndex].options || [])];
      options.push(`Option ${options.length + 1}`);
      fields[questionIndex] = { ...fields[questionIndex], options };
      return { ...current, fields };
    });
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    setEditingAttendanceForm((current) => {
      const fields = [...(current?.fields || [])];
      const options = [...(fields[questionIndex].options || [])];
      options[optionIndex] = value;
      fields[questionIndex] = { ...fields[questionIndex], options };
      return { ...current, fields };
    });
  };

  const removeOption = (questionIndex, optionIndex) => {
    setEditingAttendanceForm((current) => {
      const fields = [...(current?.fields || [])];
      const options = [...(fields[questionIndex].options || [])];
      options.splice(optionIndex, 1);
      fields[questionIndex] = { ...fields[questionIndex], options };
      return { ...current, fields };
    });
  };

  const publicUrlFor = (form) => {
    const slug = form?.slug || attendanceSlug(form?.title || 'form');
    return `${window.location.origin}/public/attendance/${slug}`;
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
      setMessage('Public attendance link copied to clipboard.');
    } catch {
      setMessage('Copy was blocked. Please select and copy manually.');
    }
  };

  return (
    <section className="module-page attendance-page">
      <div className="module-hero compact-hero">
        <div>
          <h1>Attendance</h1>
          <p>Create Google Forms-style attendance forms, collect custom responses, take live attendance, or share QR codes.</p>
          <p className="subtle">Shared cloud workspace</p>
        </div>
        <div className="module-stats">
          <div className="mini-stat"><span>Today&apos;s Sessions</span><strong>{todaySessions.length}</strong></div>
          <div className="mini-stat"><span>Total Marked</span><strong>{totalMarked}</strong></div>
          <div className="mini-stat"><span>Attendance Rate</span><strong>{percent(totalPresent, totalMarked)}%</strong></div>
        </div>
      </div>

      {message && (
        <div className="action-note attendance-message" role="status">
          <span>{message}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {/* Attendance Forms Card */}
      <Card
        title="Attendance Forms"
        subtitle="Choose a form to start marking attendance, or build custom forms with Google Forms features."
        action={
          <button
            className="pill primary-action"
            type="button"
            onClick={() => {
              setEditingAttendanceForm(blankAttendanceForm());
              setBuilderTab('questions');
            }}
          >
            + Create form
          </button>
        }
      >
        <div className="attendance-form-grid">
          {attendanceForms.map((form) => (
            <article className="attendance-form-card" key={form.id}>
              <button className="attendance-form-main" type="button" onClick={() => startMarkingAttendance(form)}>
                <span className="attendance-form-icon" aria-hidden="true">✓</span>
                <span>
                  <strong>{form.title}</strong>
                  <small>{form.group} · {form.mode}{form.fields?.length ? ` · ${form.fields.length} question(s)` : ''}</small>
                  {form.notes && <small>{form.notes}</small>}
                </span>
                <b aria-hidden="true">›</b>
              </button>
              <div className="attendance-form-card-actions" aria-label={`${form.title} form actions`}>
                <button
                  className="pill"
                  type="button"
                  onClick={() => {
                    setEditingAttendanceForm({
                      ...form,
                      fields: form.fields || [],
                      slug: form.slug || attendanceSlug(form.title),
                    });
                    setBuilderTab('questions');
                    setSelectedAttendanceForm(null);
                  }}
                >
                  Edit form
                </button>
                <button
                  className="pill"
                  type="button"
                  onClick={() => setSharingForm(form)}
                  title="Share link & QR code"
                >
                  Share & QR
                </button>
                <button
                  className="pill danger-action"
                  type="button"
                  onClick={() => deleteAttendanceForm(form)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
          {!attendanceForms.length && (
            <div className="empty-state compact-empty attendance-forms-empty">
              <strong>No attendance forms yet</strong>
              <p>Click &quot;+ Create form&quot; above to design your first Google Forms-style attendance questionnaire.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Attendance History Card */}
      <Card
        title="Attendance History"
        subtitle="Search previous sessions, review marked attendees, view submitted custom answers, or export to CSV."
        action={
          <button className="pill" type="button" disabled={!sessions.length} onClick={() => downloadCsv(sessions)}>
            Export CSV
          </button>
        }
      >
        <input
          className="lead-input attendance-history-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by session, student, patient, date, or mode..."
        />
        <div className="attendance-history-list">
          {filteredSessions.map((session) => {
            const present = session.records.filter((record) => ['Present', 'Late'].includes(record.status)).length;
            return (
              <details className="attendance-history-session" key={session.id}>
                <summary>
                  <div>
                    <strong>{session.title}</strong>
                    <span>{session.date} · {session.time} · {session.group} · {session.mode}{session.zoomLink ? ' · Zoom' : ''}{session.publicSlug ? ' · Public form linked' : ''}</span>
                  </div>
                  <div>
                    <strong>{present}/{session.records.length}</strong>
                    <small>{percent(present, session.records.length)}% attended</small>
                  </div>
                </summary>
                {validZoomUrl(session.zoomLink) && (
                  <div className="attendance-history-zoom">
                    <span>Zoom meeting linked to this session.</span>
                    <a className="pill" href={session.zoomLink} target="_blank" rel="noreferrer">Open Zoom</a>
                  </div>
                )}
                <div className="attendance-history-records">
                  {session.records.map((record) => {
                    const hasAnswers = record.answers && Object.keys(record.answers).length > 0;
                    return (
                      <div key={record.id}>
                        <span>
                          <strong>{record.name}</strong>
                          <small>
                            {record.mobile || 'No mobile'}
                            {record.note ? ` · ${record.note}` : ''}
                            {record.source ? ` · ${record.source}` : ''}
                          </small>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {hasAnswers && (
                            <button
                              type="button"
                              className="attendance-answers-badge"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingAnswersRecord({
                                  ...record,
                                  sessionTitle: session.title,
                                  fields: session.fields || [],
                                });
                              }}
                            >
                              📋 View Answers
                            </button>
                          )}
                          <StatusPill tone={record.status === 'Present' ? 'st-ok' : record.status === 'Absent' ? 'st-draft' : 'st-progress'}>
                            {record.status}
                          </StatusPill>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
          {!filteredSessions.length && (
            <div className="empty-state compact-empty">
              <strong>No attendance sessions found.</strong>
              <p>Saved sessions and check-in records will appear here date-wise.</p>
            </div>
          )}
        </div>
      </Card>

      {/* MODAL 1: GOOGLE FORMS BUILDER MODAL */}
      {editingAttendanceForm && (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditingAttendanceForm(null)}>
          <div className="modal-shell attendance-builder-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{attendanceForms.some((item) => item.id === editingAttendanceForm.id) ? 'Edit attendance form' : 'Create Google Forms-Style Attendance Form'}</h2>
                <p>Customize questions, choice options, ratings, and details for self check-in or manual marking.</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setEditingAttendanceForm(null)}>×</button>
            </div>

            {/* Builder Tabs */}
            <div className="attendance-builder-tabs">
              <button
                type="button"
                className={`attendance-builder-tab-btn ${builderTab === 'questions' ? 'active' : ''}`}
                onClick={() => setBuilderTab('questions')}
              >
                <span>📋 Form Questions</span>
                <span className="attendance-builder-tab-badge">{editingAttendanceForm.fields?.length || 0}</span>
              </button>
              <button
                type="button"
                className={`attendance-builder-tab-btn ${builderTab === 'settings' ? 'active' : ''}`}
                onClick={() => setBuilderTab('settings')}
              >
                <span>⚙ Class & Mode Settings</span>
              </button>
              <button
                type="button"
                className={`attendance-builder-tab-btn ${builderTab === 'preview' ? 'active' : ''}`}
                onClick={() => setBuilderTab('preview')}
              >
                <span>👁 Live Form Preview</span>
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: 'calc(90vh - 170px)', overflowY: 'auto', padding: '18px 20px' }}>
              {/* TAB 1: FORM QUESTIONS (GOOGLE FORMS BUILDER) */}
              {builderTab === 'questions' && (
                <div>
                  {/* Quick template loader */}
                  <div className="attendance-templates-bar">
                    <span>⚡ Quick Templates:</span>
                    {QUESTION_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.name}
                        type="button"
                        className="attendance-template-chip"
                        onClick={() => applyTemplate(tpl)}
                        title={tpl.description}
                      >
                        + {tpl.name}
                      </button>
                    ))}
                  </div>

                  {/* Form Title & Description quick block */}
                  <div style={{ background: '#f6faf8', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(19, 143, 134, 0.2)', marginBottom: '16px' }}>
                    <label className="field-block">
                      <span>Form Title *</span>
                      <input
                        className="lead-input"
                        style={{ fontSize: '1.1rem', fontWeight: 800 }}
                        value={editingAttendanceForm.title}
                        onChange={(e) => setEditingAttendanceForm((curr) => ({ ...curr, title: e.target.value }))}
                        placeholder="e.g. Garbhasanskar Morning Batch / Pregnancy Fun Club"
                        autoFocus
                      />
                    </label>
                  </div>

                  {/* Question Cards List */}
                  <div className="attendance-questions-list">
                    {(editingAttendanceForm.fields || []).map((field, index) => {
                      const isHeading = field.type === 'heading';
                      const hasOptions = ['radio', 'checkbox', 'select'].includes(field.type);

                      return (
                        <div className="attendance-question-card" key={field.id || index}>
                          <div className="attendance-question-card-head">
                            <span className="attendance-question-order">
                              <span>#{index + 1}</span>
                              <span>{QUESTION_TYPES.find((t) => t.value === field.type)?.icon}</span>
                              <span>{QUESTION_TYPES.find((t) => t.value === field.type)?.label}</span>
                            </span>

                            <select
                              className="lead-input attendance-question-type-select"
                              value={field.type}
                              onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                            >
                              {QUESTION_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.icon} {type.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="attendance-question-card-body">
                            <label className="field-block">
                              <span>{isHeading ? 'Section Header Text' : 'Question Title *'}</span>
                              <input
                                className="lead-input"
                                value={field.label}
                                onChange={(e) => updateQuestion(index, 'label', e.target.value)}
                                placeholder={isHeading ? 'Enter section heading...' : 'What do you want to ask?'}
                              />
                            </label>

                            {!isHeading && (
                              <label className="field-block">
                                <span>Helper / Description (Optional)</span>
                                <input
                                  className="lead-input"
                                  value={field.help || ''}
                                  onChange={(e) => updateQuestion(index, 'help', e.target.value)}
                                  placeholder="Additional instructions for respondents"
                                />
                              </label>
                            )}

                            {/* Option list for Radio, Checkbox, Select */}
                            {hasOptions && (
                              <div className="attendance-question-options">
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)' }}>Choices / Options:</span>
                                {(field.options || []).map((opt, optIdx) => (
                                  <div className="attendance-question-option-row" key={optIdx}>
                                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                                      {field.type === 'radio' ? '○' : field.type === 'checkbox' ? '□' : `${optIdx + 1}.`}
                                    </span>
                                    <input
                                      className="lead-input"
                                      value={opt}
                                      onChange={(e) => updateOption(index, optIdx, e.target.value)}
                                      placeholder={`Option ${optIdx + 1}`}
                                    />
                                    <button
                                      type="button"
                                      className="icon-btn"
                                      onClick={() => removeOption(index, optIdx)}
                                      aria-label="Remove option"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                  <button
                                    type="button"
                                    className="pill"
                                    style={{ fontSize: '0.74rem' }}
                                    onClick={() => addOption(index)}
                                  >
                                    + Add Option
                                  </button>
                                  {PRESET_OPTIONS.map((preset) => (
                                    <button
                                      key={preset.label}
                                      type="button"
                                      className="pill"
                                      style={{ fontSize: '0.72rem', background: '#f7faf8' }}
                                      onClick={() => updateQuestion(index, 'options', [...preset.options])}
                                    >
                                      Preset: {preset.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Limits for Scale */}
                            {field.type === 'scale' && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <label className="field-block">
                                  <span>Min Scale</span>
                                  <input
                                    className="lead-input"
                                    type="number"
                                    value={field.min ?? 1}
                                    onChange={(e) => updateQuestion(index, 'min', Number(e.target.value))}
                                  />
                                </label>
                                <label className="field-block">
                                  <span>Max Scale</span>
                                  <input
                                    className="lead-input"
                                    type="number"
                                    value={field.max ?? 10}
                                    onChange={(e) => updateQuestion(index, 'max', Number(e.target.value))}
                                  />
                                </label>
                              </div>
                            )}

                            {/* Placeholder for text / textarea / number */}
                            {['text', 'textarea', 'number'].includes(field.type) && (
                              <label className="field-block">
                                <span>Input Placeholder Hint</span>
                                <input
                                  className="lead-input"
                                  value={field.placeholder || ''}
                                  onChange={(e) => updateQuestion(index, 'placeholder', e.target.value)}
                                  placeholder="e.g. Enter value..."
                                />
                              </label>
                            )}
                          </div>

                          <div className="attendance-question-card-foot">
                            {!isHeading ? (
                              <label className="toggle-row" style={{ cursor: 'pointer', userSelect: 'none' }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(field.required)}
                                  onChange={(e) => updateQuestion(index, 'required', e.target.checked)}
                                />
                                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: field.required ? 'var(--green)' : 'var(--muted)' }}>
                                  {field.required ? '★ Required Question' : 'Optional Question'}
                                </span>
                              </label>
                            ) : <div />}

                            <div className="attendance-question-actions">
                              <button
                                type="button"
                                className="pill"
                                disabled={index === 0}
                                onClick={() => moveQuestion(index, -1)}
                                title="Move question up"
                              >
                                ↑ Up
                              </button>
                              <button
                                type="button"
                                className="pill"
                                disabled={index === (editingAttendanceForm.fields?.length || 0) - 1}
                                onClick={() => moveQuestion(index, 1)}
                                title="Move question down"
                              >
                                ↓ Down
                              </button>
                              <button
                                type="button"
                                className="pill"
                                onClick={() => duplicateQuestion(index)}
                                title="Duplicate question"
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                className="pill danger-action"
                                onClick={() => removeQuestion(index)}
                                title="Delete question"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {!(editingAttendanceForm.fields?.length) && (
                      <div className="empty-state compact-empty">
                        <strong>No questions added yet</strong>
                        <p>Use the buttons below to add custom questions like text, rating, dropdowns or checkboxes.</p>
                      </div>
                    )}
                  </div>

                  {/* Bottom Add Question Controls */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="pill primary-action"
                      style={{ padding: '8px 16px' }}
                      onClick={() => addQuestion('text')}
                    >
                      + Add Question
                    </button>
                    <button
                      type="button"
                      className="pill"
                      style={{ padding: '8px 14px' }}
                      onClick={() => addQuestion('rating', 'How was today’s session?')}
                    >
                      + Star Rating
                    </button>
                    <button
                      type="button"
                      className="pill"
                      style={{ padding: '8px 14px' }}
                      onClick={() => addQuestion('radio', 'Choose your option')}
                    >
                      + Multiple Choice
                    </button>
                    <button
                      type="button"
                      className="pill"
                      style={{ padding: '8px 14px' }}
                      onClick={() => addQuestion('heading', 'Important Instructions')}
                    >
                      + Section Heading
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: CLASS & SESSION SETTINGS */}
              {builderTab === 'settings' && (
                <div className="attendance-form-editor-grid">
                  <label className="field-block full-field">
                    <span>Form Name *</span>
                    <input
                      className="lead-input"
                      value={editingAttendanceForm.title}
                      onChange={(e) => setEditingAttendanceForm((curr) => ({ ...curr, title: e.target.value }))}
                      placeholder="e.g. Garbhasanskar Morning Batch"
                    />
                  </label>
                  <label className="field-block">
                    <span>Attendance For</span>
                    <select
                      className="lead-input"
                      value={editingAttendanceForm.group}
                      onChange={(e) => setEditingAttendanceForm((curr) => ({ ...curr, group: e.target.value }))}
                    >
                      <option>Students</option>
                      <option>Patients</option>
                      <option>Mixed Group</option>
                    </select>
                  </label>
                  <label className="field-block">
                    <span>Default Mode</span>
                    <select
                      className="lead-input"
                      value={editingAttendanceForm.mode}
                      onChange={(e) => setEditingAttendanceForm((curr) => ({ ...curr, mode: e.target.value }))}
                    >
                      <option>Offline</option>
                      <option>Online</option>
                      <option>Hybrid</option>
                    </select>
                  </label>
                  <label className="field-block full-field">
                    <span>Instructions / Description</span>
                    <textarea
                      className="lead-input"
                      rows="3"
                      value={editingAttendanceForm.notes}
                      onChange={(e) => setEditingAttendanceForm((curr) => ({ ...curr, notes: e.target.value }))}
                      placeholder="Teacher, topic, location, or instructions for attendees"
                    />
                  </label>
                  <label className="field-block">
                    <span>Zoom Meeting Link</span>
                    <input
                      className="lead-input"
                      type="url"
                      value={editingAttendanceForm.zoomLink || ''}
                      onChange={(e) => setEditingAttendanceForm((curr) => ({ ...curr, zoomLink: e.target.value }))}
                      placeholder="https://zoom.us/j/..."
                    />
                  </label>
                  <label className="field-block">
                    <span>Minimum Present Duration (minutes)</span>
                    <input
                      className="lead-input"
                      type="number"
                      min="1"
                      value={editingAttendanceForm.minimumMinutes || 20}
                      onChange={(e) => setEditingAttendanceForm((curr) => ({ ...curr, minimumMinutes: e.target.value }))}
                    />
                  </label>
                  <label className="field-block full-field">
                    <span>Custom Public URL Slug</span>
                    <input
                      className="lead-input"
                      value={editingAttendanceForm.slug || ''}
                      onChange={(e) => setEditingAttendanceForm((curr) => ({ ...curr, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                      placeholder="e.g. batch-a-morning"
                    />
                    <small className="field-help">Public link: {publicUrlFor(editingAttendanceForm)}</small>
                  </label>
                </div>
              )}

              {/* TAB 3: LIVE FORM PREVIEW */}
              {builderTab === 'preview' && (
                <div style={{ maxWidth: '640px', margin: '0 auto', background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid rgba(19, 143, 134, 0.2)', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
                  <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '18px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase' }}>Previewing Attendance Form</span>
                    <h2 style={{ margin: '6px 0 4px', fontSize: '1.4rem' }}>{editingAttendanceForm.title || 'Untitled Attendance Form'}</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>{editingAttendanceForm.notes || 'Please fill in your details to record your attendance.'}</p>
                  </div>

                  <div style={{ display: 'grid', gap: '16px' }}>
                    <label className="field-block">
                      <span>Full Name <span style={{ color: '#ef4444' }}>*</span></span>
                      <input className="lead-input" placeholder="e.g. Priya Patel" readOnly />
                    </label>

                    <label className="field-block">
                      <span>Mobile Number</span>
                      <input className="lead-input" placeholder="e.g. 9876543210" readOnly />
                    </label>

                    {(editingAttendanceForm.fields || []).map((field, idx) => (
                      <div key={idx} style={{ padding: '12px 0', borderTop: '1px dashed #e5e7eb' }}>
                        {field.type === 'heading' ? (
                          <h3 style={{ fontSize: '1.05rem', margin: '4px 0', color: 'var(--green)' }}>{field.label}</h3>
                        ) : (
                          <>
                            <span style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', marginBottom: '6px' }}>
                              {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                            </span>
                            {field.help && <small style={{ display: 'block', color: 'var(--muted)', marginBottom: '8px' }}>{field.help}</small>}

                            {field.type === 'text' && <input className="lead-input" placeholder={field.placeholder || 'Your answer'} readOnly />}
                            {field.type === 'textarea' && <textarea className="lead-input" rows="2" placeholder={field.placeholder || 'Your detailed answer'} readOnly />}
                            {field.type === 'number' && <input className="lead-input" type="number" placeholder={field.placeholder || '0'} readOnly />}
                            {field.type === 'date' && <input className="lead-input" type="date" readOnly />}
                            {field.type === 'time' && <input className="lead-input" type="time" readOnly />}
                            {field.type === 'select' && (
                              <select className="lead-input" disabled>
                                <option>Select an option</option>
                                {(field.options || []).map((opt, oIdx) => <option key={oIdx}>{opt}</option>)}
                              </select>
                            )}
                            {field.type === 'radio' && (
                              <div className="attendance-choice-group">
                                {(field.options || []).map((opt, oIdx) => (
                                  <div className="attendance-choice-pill" key={oIdx}>
                                    <span>○</span>
                                    <span>{opt}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {field.type === 'checkbox' && (
                              <div className="attendance-choice-group">
                                {(field.options || []).map((opt, oIdx) => (
                                  <div className="attendance-choice-pill" key={oIdx}>
                                    <span>□</span>
                                    <span>{opt}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {field.type === 'yesno' && (
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <div className="attendance-scale-btn">Yes</div>
                                <div className="attendance-scale-btn">No</div>
                              </div>
                            )}
                            {field.type === 'rating' && (
                              <div className="attendance-star-rating">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span key={star} className="attendance-star-btn filled">★</span>
                                ))}
                              </div>
                            )}
                            {field.type === 'scale' && (
                              <div className="attendance-scale-bar">
                                {Array.from({ length: (field.max || 10) - (field.min || 1) + 1 }, (_, i) => (field.min || 1) + i).map((num) => (
                                  <div key={num} className="attendance-scale-btn">{num}</div>
                                ))}
                              </div>
                            )}
                            {field.type === 'file' && (
                              <div style={{ padding: '14px', border: '1px dashed var(--border)', borderRadius: '10px', textAlign: 'center', background: '#fafbfc' }}>
                                📎 Click to upload file / photo
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                    <button className="pill primary-action" type="button" disabled style={{ width: '100%', justifyContent: 'center' }}>
                      Mark My Attendance (Preview)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setEditingAttendanceForm(null)}>
                Cancel
              </button>
              <button
                className="pill primary-action"
                type="button"
                disabled={!editingAttendanceForm.title.trim()}
                onClick={saveAttendanceForm}
              >
                Save Attendance Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SHARE & QR CODE MODAL */}
      {sharingForm && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSharingForm(null)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Share Attendance Form</h2>
                <p>{sharingForm.title}</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setSharingForm(null)}>×</button>
            </div>

            <div className="modal-body attendance-share-card">
              <div className="attendance-qr-frame">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrlFor(sharingForm))}`}
                  alt="Attendance Form QR Code"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <small style={{ color: 'var(--muted)', marginTop: '8px' }}>Scan with mobile camera to check in</small>
              </div>

              <div style={{ display: 'grid', gap: '8px', textAlign: 'left' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-heading)' }}>Public Link:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="lead-input" readOnly value={publicUrlFor(sharingForm)} />
                  <button className="pill primary-action" type="button" onClick={() => copyUrl(publicUrlFor(sharingForm))}>
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <a
                  className="pill"
                  href={`https://wa.me/?text=${encodeURIComponent(`Please mark your attendance for *${sharingForm.title}* here: ${publicUrlFor(sharingForm)}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 Share on WhatsApp
                </a>
                <a
                  className="pill"
                  href={publicUrlFor(sharingForm)}
                  target="_blank"
                  rel="noreferrer"
                >
                  ↗ Open in new tab
                </a>
              </div>
            </div>

            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setSharingForm(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW ATTENDEE CUSTOM QUESTION ANSWERS */}
      {viewingAnswersRecord && (
        <div className="modal-backdrop" role="presentation" onClick={() => setViewingAnswersRecord(null)}>
          <div className="modal-shell modal-small" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{viewingAnswersRecord.name}</h2>
                <p>Answers for {viewingAnswersRecord.sessionTitle || 'Attendance Session'}</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setViewingAnswersRecord(null)}>×</button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border)', marginBottom: '12px' }}>
                <div><small style={{ color: 'var(--muted)' }}>Mobile:</small> <strong>{viewingAnswersRecord.mobile || 'N/A'}</strong></div>
                <div><small style={{ color: 'var(--muted)' }}>Status:</small> <strong>{viewingAnswersRecord.status}</strong></div>
                <div><small style={{ color: 'var(--muted)' }}>Source:</small> <strong>{viewingAnswersRecord.source || 'Public Form'}</strong></div>
              </div>

              <div className="attendance-answers-detail-list">
                {viewingAnswersRecord.answers && Object.keys(viewingAnswersRecord.answers).length > 0 ? (
                  Object.entries(viewingAnswersRecord.answers).map(([qId, val]) => {
                    const field = (viewingAnswersRecord.fields || []).find((f) => f.id === qId);
                    const label = field?.label || qId;
                    const displayVal = Array.isArray(val) ? val.join(', ') : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val ?? '');

                    return (
                      <div className="attendance-answer-item" key={qId}>
                        <span>{label}</span>
                        <strong>{displayVal || '—'}</strong>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state compact-empty">
                    <strong>No custom answers recorded</strong>
                    <p>This attendee only submitted basic contact details.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setViewingAnswersRecord(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: MARK ATTENDANCE POPUP */}
      {activeAttendanceForm && (
        <div className="modal-backdrop" role="presentation" onClick={() => setActiveAttendanceForm(null)}>
          <div className="modal-shell attendance-form-editor" role="dialog" aria-modal="true" aria-labelledby="mark-attendance-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2 id="mark-attendance-title">Mark attendance: {activeAttendanceForm.title}</h2>
                <p>{sessionForm.group} · {sessionForm.mode} {activeAttendanceForm.fields?.length ? `· ${activeAttendanceForm.fields.length} custom question(s)` : ''}</p>
              </div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setActiveAttendanceForm(null)}>×</button>
            </div>

            <div className="modal-body">
              <div className="attendance-roster-tools">
                <div>
                  <strong>Attendance Roster</strong>
                  <span>{roster.length} attendee{roster.length === 1 ? '' : 's'} · {currentPresent} present</span>
                </div>
                <div className="card-action-group">
                  <button className="pill" type="button" onClick={() => setSharingForm(activeAttendanceForm)}>
                    📲 Share Form & QR
                  </button>
                  <button className="pill" type="button" onClick={importPatients} disabled={!patients.length}>
                    Import patients
                  </button>
                  <button className="pill" type="button" disabled={!roster.length} onClick={() => markEveryone('Present')}>
                    All present
                  </button>
                  <button className="pill" type="button" disabled={!roster.length} onClick={() => markEveryone('Absent')}>
                    All absent
                  </button>
                </div>
              </div>

              {/* Add member row */}
              <div className="attendance-add-member">
                <input
                  id="attendance-popup-member-name"
                  className="lead-input"
                  autoFocus
                  value={newMember.name}
                  onChange={(e) => setNewMember((curr) => ({ ...curr, name: e.target.value }))}
                  placeholder="Student or patient name"
                  onKeyDown={(e) => { if (e.key === 'Enter' && newMember.name.trim()) addMember(); }}
                />
                <input
                  id="attendance-popup-member-mobile"
                  className="lead-input"
                  type="tel"
                  inputMode="numeric"
                  value={newMember.mobile}
                  onChange={(e) => setNewMember((curr) => ({ ...curr, mobile: e.target.value }))}
                  placeholder="Mobile number (optional)"
                />
                <button className="pill" type="button" disabled={!newMember.name.trim()} onClick={() => addMember()}>
                  Add member
                </button>
                {patientMatches.length > 0 && (
                  <div className="attendance-patient-results" role="listbox" aria-label="Matching patients">
                    {patientMatches.map((patient) => (
                      <button type="button" role="option" key={patient.id || `${patient.name}-${patient.mobile}`} onClick={() => addMember(patient, 'Patient')}>
                        <span><strong>{patient.name}</strong><small>{patient.mobile || 'No mobile number'}</small></span>
                        <b>Add</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Roster list */}
              <div className="attendance-roster">
                {roster.map((record, index) => {
                  const hasAnswers = record.answers && Object.keys(record.answers).length > 0;
                  return (
                    <div className="attendance-roster-row" key={record.id}>
                      <span className="attendance-number">{index + 1}</span>
                      <div className="attendance-person">
                        <strong>{record.name}</strong>
                        <small>{record.mobile || record.source}</small>
                      </div>
                      <select
                        className={`lead-input attendance-status status-${record.status.toLowerCase()}`}
                        value={record.status}
                        onChange={(e) => updateRecord(record.id, 'status', e.target.value)}
                      >
                        {ATTENDANCE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                      </select>

                      {hasAnswers ? (
                        <button
                          type="button"
                          className="attendance-answers-badge"
                          onClick={() => setViewingAnswersRecord({
                            ...record,
                            sessionTitle: activeAttendanceForm.title,
                            fields: activeAttendanceForm.fields || [],
                          })}
                        >
                          📋 Answers ({Object.keys(record.answers).length})
                        </button>
                      ) : (
                        <input
                          className="lead-input"
                          value={record.note || ''}
                          onChange={(e) => updateRecord(record.id, 'note', e.target.value)}
                          placeholder="Note"
                        />
                      )}

                      <button
                        className="icon-btn"
                        type="button"
                        onClick={() => setRoster((curr) => curr.filter((item) => item.id !== record.id))}
                        aria-label={`Remove ${record.name}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {!roster.length && (
                  <div className="empty-state compact-empty">
                    <strong>No attendees added yet</strong>
                    <p>Add students manually, or share the public QR code/link so attendees can check in on their own phones.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setActiveAttendanceForm(null)}>Cancel</button>
              <button className="pill primary-action" type="button" disabled={!roster.length} onClick={saveSession}>
                Save attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------------------
// PUBLIC ATTENDANCE CHECK-IN PAGE (/public/attendance/:slug)
// -----------------------------------------------------------------------------------------

export function PublicAttendancePage() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, form: null, error: '' });
  const [person, setPerson] = useState({ name: '', mobile: '' });
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;

    // First try API
    attendanceRequest(`/api/attendance/forms/${encodeURIComponent(slug)}`)
      .then(({ form }) => {
        if (active) setState({ loading: false, form, error: '' });
      })
      .catch(() => {
        // Fallback to local storage
        try {
          const allForms = JSON.parse(window.localStorage.getItem('moms-pathshala:Main Branch:attendance-forms:v1') || '[]');
          const match = allForms.find((f) => f.slug === slug || f.id === slug);
          if (match && active) {
            setState({ loading: false, form: match, error: '' });
            return;
          }
        } catch {
          // ignore
        }
        if (active) {
          setState({ loading: false, form: null, error: 'This attendance form could not be loaded.' });
        }
      });

    return () => { active = false; };
  }, [slug]);

  const validate = () => {
    const errs = {};
    if (!person.name.trim()) errs.name = 'Please enter your full name.';

    (state.form?.fields || []).forEach((field) => {
      if (field.type === 'heading') return;
      if (field.required) {
        const val = answers[field.id];
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          errs[field.id] = `${field.label || 'This field'} is required.`;
        }
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const submissionId = `public_attendance_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload = {
      id: submissionId,
      name: person.name.trim(),
      mobile: person.mobile.trim(),
      answers,
      submittedAt: new Date().toISOString(),
    };

    try {
      await attendanceRequest(`/api/attendance/forms/${encodeURIComponent(slug)}/responses`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSubmitted(true);
    } catch (error) {
      // Local fallback in case PostgreSQL is offline
      try {
        const key = 'moms-pathshala:Main Branch:attendance-sessions:v1';
        const sessions = JSON.parse(window.localStorage.getItem(key) || '[]');
        const record = {
          id: payload.id,
          name: payload.name,
          mobile: payload.mobile,
          source: 'Public Form',
          status: 'Present',
          note: 'Marked through public form',
          answers,
          submittedAt: payload.submittedAt,
        };
        const idx = sessions.findIndex((s) => s.publicSlug === slug || s.title === state.form?.title);
        if (idx >= 0) {
          sessions[idx].records = [...(sessions[idx].records || []).filter((r) => r.id !== record.id), record];
        } else {
          sessions.unshift({
            id: `attendance_${Date.now()}`,
            title: state.form?.title || 'Attendance Session',
            group: state.form?.group || 'Mixed Group',
            date: localDate(),
            time: localTime(),
            mode: state.form?.mode || 'Offline',
            notes: state.form?.notes || '',
            publicSlug: slug,
            fields: state.form?.fields || [],
            records: [record],
            createdAt: new Date().toISOString(),
          });
        }
        window.localStorage.setItem(key, JSON.stringify(sessions));
        setSubmitted(true);
      } catch {
        setState((curr) => ({ ...curr, error: error.message }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const setFieldValue = (fieldId, value) => {
    setAnswers((curr) => ({ ...curr, [fieldId]: value }));
    setErrors((curr) => ({ ...curr, [fieldId]: '' }));
  };

  const toggleCheckbox = (fieldId, option) => {
    setAnswers((curr) => {
      const existing = Array.isArray(curr[fieldId]) ? [...curr[fieldId]] : [];
      const index = existing.indexOf(option);
      if (index >= 0) existing.splice(index, 1);
      else existing.push(option);
      return { ...curr, [fieldId]: existing };
    });
    setErrors((curr) => ({ ...curr, [fieldId]: '' }));
  };

  return (
    <main className="public-form-page">
      <div className="public-form-brand">
        <span className="public-brand-mark" aria-hidden="true">M</span>
        <span>Mom&apos;s Pathshala</span>
      </div>

      <div className="public-form-card attendance-public-card">
        {state.loading ? (
          <div className="public-form-state">
            <strong>Loading attendance form...</strong>
            <p>Please wait a moment.</p>
          </div>
        ) : submitted ? (
          <div className="public-form-state attendance-success" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e1f3ec', color: 'var(--green)', fontSize: '2rem', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontWeight: 900 }}>
              ✓
            </div>
            <strong style={{ fontSize: '1.4rem' }}>Attendance Marked!</strong>
            <p style={{ margin: '8px 0 20px', color: 'var(--muted)' }}>
              Thank you, <strong>{person.name}</strong>. Your attendance for <strong>{state.form?.title}</strong> has been recorded as <strong>Present</strong>.
            </p>
            <button
              className="pill primary-action"
              type="button"
              onClick={() => {
                setPerson({ name: '', mobile: '' });
                setAnswers({});
                setSubmitted(false);
              }}
            >
              Submit another response
            </button>
          </div>
        ) : state.form ? (
          <>
            <div className="public-form-title">
              <span>Attendance Form</span>
              <h1>{state.form.title}</h1>
              <p>
                {state.form.group} · {state.form.mode}
                {state.form.notes ? ` · ${state.form.notes}` : ''}
              </p>
            </div>

            <form className="public-form attendance-checkin-form" onSubmit={submit} noValidate>
              {/* Primary identification */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                <label className="field-block">
                  <span>Your Full Name <span style={{ color: '#ef4444' }}>*</span></span>
                  <input
                    className={`lead-input ${errors.name ? 'input-error' : ''}`}
                    value={person.name}
                    onChange={(e) => {
                      setPerson((curr) => ({ ...curr, name: e.target.value }));
                      setErrors((curr) => ({ ...curr, name: '' }));
                    }}
                    autoComplete="name"
                    placeholder="Enter your full name"
                    required
                  />
                  {errors.name && <p className="field-error">{errors.name}</p>}
                </label>

                <label className="field-block">
                  <span>Mobile Number (WhatsApp)</span>
                  <input
                    className="lead-input"
                    type="tel"
                    value={person.mobile}
                    onChange={(e) => setPerson((curr) => ({ ...curr, mobile: e.target.value }))}
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                  />
                </label>
              </div>

              {/* Dynamic Google Forms Fields */}
              {(state.form.fields || []).map((field) => {
                if (field.type === 'heading') {
                  return (
                    <div key={field.id} style={{ margin: '20px 0 10px', borderTop: '2px solid rgba(19, 143, 134, 0.15)', paddingTop: '14px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)' }}>{field.label}</h3>
                      {field.help && <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>{field.help}</p>}
                    </div>
                  );
                }

                const value = answers[field.id];
                const hasError = Boolean(errors[field.id]);

                return (
                  <div key={field.id} style={{ marginBottom: '18px' }}>
                    <label className="field-block">
                      <span style={{ fontWeight: 700 }}>
                        {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                      </span>
                      {field.help && <small style={{ color: 'var(--muted)', marginBottom: '6px', display: 'block' }}>{field.help}</small>}

                      {field.type === 'text' && (
                        <input
                          className={`lead-input ${hasError ? 'input-error' : ''}`}
                          value={value || ''}
                          onChange={(e) => setFieldValue(field.id, e.target.value)}
                          placeholder={field.placeholder || 'Your answer'}
                        />
                      )}

                      {field.type === 'textarea' && (
                        <textarea
                          className={`lead-input ${hasError ? 'input-error' : ''}`}
                          rows="3"
                          value={value || ''}
                          onChange={(e) => setFieldValue(field.id, e.target.value)}
                          placeholder={field.placeholder || 'Your answer'}
                        />
                      )}

                      {field.type === 'number' && (
                        <input
                          className={`lead-input ${hasError ? 'input-error' : ''}`}
                          type="number"
                          value={value || ''}
                          onChange={(e) => setFieldValue(field.id, e.target.value)}
                          placeholder={field.placeholder || 'Enter number'}
                        />
                      )}

                      {field.type === 'date' && (
                        <input
                          className={`lead-input ${hasError ? 'input-error' : ''}`}
                          type="date"
                          value={value || ''}
                          onChange={(e) => setFieldValue(field.id, e.target.value)}
                        />
                      )}

                      {field.type === 'time' && (
                        <input
                          className={`lead-input ${hasError ? 'input-error' : ''}`}
                          type="time"
                          value={value || ''}
                          onChange={(e) => setFieldValue(field.id, e.target.value)}
                        />
                      )}

                      {field.type === 'select' && (
                        <select
                          className={`lead-input ${hasError ? 'input-error' : ''}`}
                          value={value || ''}
                          onChange={(e) => setFieldValue(field.id, e.target.value)}
                        >
                          <option value="">Choose an option...</option>
                          {(field.options || []).map((opt, oIdx) => (
                            <option key={oIdx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {field.type === 'radio' && (
                        <div className="attendance-choice-group">
                          {(field.options || []).map((opt, oIdx) => {
                            const isSelected = value === opt;
                            return (
                              <button
                                type="button"
                                key={oIdx}
                                className={`attendance-choice-pill ${isSelected ? 'active' : ''}`}
                                onClick={() => setFieldValue(field.id, opt)}
                              >
                                <span style={{ color: isSelected ? 'var(--green)' : 'var(--muted)', fontSize: '1.1rem' }}>
                                  {isSelected ? '◉' : '○'}
                                </span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {field.type === 'checkbox' && (
                        <div className="attendance-choice-group">
                          {(field.options || []).map((opt, oIdx) => {
                            const isSelected = Array.isArray(value) && value.includes(opt);
                            return (
                              <button
                                type="button"
                                key={oIdx}
                                className={`attendance-choice-pill ${isSelected ? 'active' : ''}`}
                                onClick={() => toggleCheckbox(field.id, opt)}
                              >
                                <span style={{ color: isSelected ? 'var(--green)' : 'var(--muted)', fontSize: '1.1rem' }}>
                                  {isSelected ? '☑' : '□'}
                                </span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {field.type === 'yesno' && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          {['Yes', 'No'].map((opt) => (
                            <button
                              type="button"
                              key={opt}
                              className={`attendance-scale-btn ${value === opt ? 'selected' : ''}`}
                              onClick={() => setFieldValue(field.id, opt)}
                              style={{ flex: 1, padding: '10px', fontSize: '0.95rem' }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {field.type === 'rating' && (
                        <div className="attendance-star-rating">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              className={`attendance-star-btn ${Number(value) >= star ? 'filled' : ''}`}
                              onClick={() => setFieldValue(field.id, star)}
                              aria-label={`${star} star`}
                            >
                              ★
                            </button>
                          ))}
                          {value ? <span style={{ marginLeft: '8px', fontWeight: 700, color: '#f59e0b' }}>{value}/5</span> : null}
                        </div>
                      )}

                      {field.type === 'scale' && (
                        <div className="attendance-scale-bar">
                          {Array.from({ length: (field.max || 10) - (field.min || 1) + 1 }, (_, i) => (field.min || 1) + i).map((num) => (
                            <button
                              type="button"
                              key={num}
                              className={`attendance-scale-btn ${Number(value) === num ? 'selected' : ''}`}
                              onClick={() => setFieldValue(field.id, num)}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      )}

                      {field.type === 'file' && (
                        <div>
                          <input
                            type="file"
                            className="lead-input"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setFieldValue(field.id, `${file.name} (${Math.round(file.size / 1024)} KB)`);
                              }
                            }}
                          />
                          {value && <small style={{ color: 'var(--green)', display: 'block', marginTop: '4px' }}>✓ Selected: {value}</small>}
                        </div>
                      )}
                    </label>
                    {hasError && <p className="field-error">{errors[field.id]}</p>}
                  </div>
                );
              })}

              {state.error && <p className="login-error" role="alert">{state.error}</p>}

              <div className="public-form-actions" style={{ marginTop: '24px' }}>
                <button
                  className="pill primary-action"
                  type="submit"
                  disabled={submitting || !person.name.trim()}
                  style={{ width: '100%', justifyContent: 'center', minHeight: '44px', fontSize: '1rem' }}
                >
                  {submitting ? 'Marking Attendance...' : 'Mark My Attendance'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="public-form-state">
            <strong>Attendance form not found</strong>
            <p>{state.error || 'This link is invalid or no longer active.'}</p>
          </div>
        )}
      </div>

      <p className="public-form-footer">Powered by Mom&apos;s Pathshala</p>
    </main>
  );
}

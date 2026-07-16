import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui.jsx';
import { useBranch } from '../context/BranchContext.jsx';
import { loadAllLocalResponses, loadForms } from '../data/formStore.js';

function loadValue(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch { return fallback; }
}

function clientName(row) {
  return Array.isArray(row) ? (row.length >= 7 ? row[1] : row[0]) : row?.name ?? row?.Client ?? row?.client ?? '';
}

function clientMobile(row) {
  if (Array.isArray(row)) return row.length >= 7 ? row[2] ?? '' : row[1] ?? '';
  return row?.mobile ?? row?.Mobile ?? row?.phone ?? row?.Phone ?? '';
}

function clientId(row) {
  if (Array.isArray(row)) return row.length >= 7 ? row[0] ?? '' : '';
  return row?.clientId ?? row?.['Client ID'] ?? row?.ClientId ?? row?.ID ?? row?.id ?? '';
}

function normalizePhoneNumber(value) {
  return String(value ?? '').replace(/\D/g, '').slice(-10);
}

function answerValue(response, matcher) {
  const answers = response?.answers ?? {};
  return Object.entries(answers).find(([key]) => matcher(key))?.[1] ?? '';
}

function responseFieldValue(response, form, matcher) {
  const field = form?.fields?.find((item) => matcher(item));
  if (!field) return '';
  return response?.answers?.[field.id] ?? '';
}

function responsePhone(response, form) {
  const value = responseFieldValue(response, form, (field) => field.type === 'phone' || /phone|mobile|whatsapp/i.test(field.label))
    || answerValue(response, (key) => /phone|mobile|whatsapp/i.test(key));
  return normalizePhoneNumber(value);
}

function responseName(response, form) {
  const value = responseFieldValue(response, form, (field) => /name|client|patient/i.test(field.label))
    || answerValue(response, (key) => /name|client|patient/i.test(key));
  return String(value ?? '').trim().toLowerCase();
}

const STAGES = [
  ['registration', 'Registration'],
  ['appointment', 'Appointment'],
  ['forms', 'Required Forms'],
  ['consultation', 'Doctor Consultation'],
  ['treatment', 'Treatment Plan'],
  ['billing', 'Invoice & Payment'],
  ['followup', 'Follow-up'],
];

const SYMPTOM_OPTIONS = ['Fever', 'Cough', 'Cold', 'Headache', 'Fatigue', 'Body pain', 'Joint pain', 'Acidity', 'Constipation', 'Bloating', 'Poor appetite', 'Weight gain', 'Weight loss', 'High blood sugar', 'High blood pressure', 'Skin rash', 'Hair fall', 'Sleep disturbance', 'Stress', 'Menstrual concern'];
const DIAGNOSIS_OPTIONS = ['General consultation', 'Obesity', 'Prediabetes', 'Type 2 diabetes', 'Hypertension', 'Dyslipidemia', 'Hypothyroidism', 'PCOS', 'Digestive disorder', 'Joint disorder', 'Skin disorder', 'Hair disorder', 'Stress-related condition'];
const NOTE_OPTIONS = ['Diet and lifestyle counselling given', 'Continue current medicines', 'Lab tests advised', 'Hydration and sleep guidance given', 'Review after 7 days', 'Review after 15 days', 'Review after 30 days'];
const VITAL_OPTIONS = ['BP 120/80, Pulse 72', 'BP 130/80, Pulse 76', 'BP 140/90, Pulse 80', 'Vitals stable'];
const SERVICE_OPTIONS = ['Consultation', 'Follow-up', 'Weight Loss', 'Skin Care', 'Hair Treatment', 'Panchakarma', 'Garbhasanskar', 'Diet Counseling', 'Therapy Session'];
const DURATION_OPTIONS = ['7 days', '15 days', '30 days', '45 days', '60 days', '90 days', '120 days'];
const PAYMENT_AMOUNTS = ['500', '1000', '1500', '3000', '5000', '10000'];
const QUICK_TREATMENTS = [
  { label: 'Weight loss', service: 'Weight Loss', goal: 'Weight loss and inch loss', duration: '90 days' },
  { label: 'Follow-up', service: 'Follow-up', goal: 'Review progress and continue plan', duration: '30 days' },
  { label: 'Skin care', service: 'Skin Care', goal: 'Improve skin health', duration: '45 days' },
  { label: 'Hair care', service: 'Hair Treatment', goal: 'Reduce hair fall and support regrowth', duration: '60 days' },
];
const QUICK_CONSULTATIONS = [
  { label: 'Weight loss', complaint: 'Weight gain, Fatigue', diagnosis: 'Obesity', notes: 'Diet and lifestyle counselling given', vitals: 'Vitals stable' },
  { label: 'Diabetes', complaint: 'High blood sugar, Fatigue', diagnosis: 'Type 2 diabetes', notes: 'Lab tests advised', vitals: 'BP 130/80, Pulse 76' },
  { label: 'Acidity', complaint: 'Acidity, Bloating, Poor appetite', diagnosis: 'Digestive disorder', notes: 'Hydration and sleep guidance given', vitals: 'Vitals stable' },
  { label: 'Hair fall', complaint: 'Hair fall, Stress', diagnosis: 'Hair disorder', notes: 'Review after 30 days', vitals: 'Vitals stable' },
];

function currentSlot() {
  const now = new Date();
  return {
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  };
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeAppointments(rows = []) {
  return rows.map((row) => row.length >= 7 ? [row[0], row[1], row[2], row[3], row[4], row[6] || row[5] || 'Pending'] : row.slice(0, 6));
}

function nextInvoice(rows = []) {
  const highest = rows.reduce((max, row) => {
    const value = Array.isArray(row) ? row[1] : row?.invoice;
    const match = String(value ?? '').match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `INV-${String(highest + 1).padStart(3, '0')}`;
}

export function ClientJourneyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { branchKey } = useBranch();
  const clientsKey = branchKey('ayurflow-clients:rows:v3');
  const appointmentsKey = branchKey('Appointments:rows:v3');
  const paymentsKey = branchKey('ayurflow-payments:rows:v3');
  const operationsKey = branchKey('Operations:tabs:v3');
  const treatmentTemplatesKey = branchKey('treatment-templates:v2');
  const journeysKey = branchKey('client-journeys:v1');
  const consultationTemplatesKey = branchKey('consultation-templates:v1');
  const [clients, setClients] = useState(() => loadValue(clientsKey, []));
  const [journeys, setJourneys] = useState(() => loadValue(journeysKey, {}));
  const [selectedClient, setSelectedClient] = useState(() => searchParams.get('client') ?? '');
  const [search, setSearch] = useState('');
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [consultation, setConsultation] = useState({ complaint: '', diagnosis: '', notes: '', vitals: '' });
  const [consultationTemplates, setConsultationTemplates] = useState(() => loadValue(consultationTemplatesKey, []));
  const [consultationTemplateName, setConsultationTemplateName] = useState('');
  const [selectedConsultationTemplate, setSelectedConsultationTemplate] = useState('');
  const [symptomChoice, setSymptomChoice] = useState('');
  const [stageModal, setStageModal] = useState('');
  const [appointmentForm, setAppointmentForm] = useState(() => ({ mobile: '', ...currentSlot(), type: 'Consultation', status: 'Pending' }));
  const [requiredForm, setRequiredForm] = useState('Client Intake Form');
  const [treatmentForm, setTreatmentForm] = useState({ service: 'Consultation', goal: '', duration: '30 days', medicine: '', dose: '', timing: '', status: 'Active' });
  const [paymentForm, setPaymentForm] = useState({ invoice: '', amount: '', status: 'Paid', paidOn: new Date().toISOString().slice(0, 10) });
  const appointments = loadValue(appointmentsKey, []);
  const payments = loadValue(paymentsKey, []);
  const operationRows = loadValue(operationsKey, {});
  const treatmentTemplates = loadValue(treatmentTemplatesKey, loadValue('ayurflow:treatment-templates:v1', []));
  const localForms = loadForms();
  const localResponses = loadAllLocalResponses();
  const medicineCatalog = useMemo(() => {
    return (Array.isArray(operationRows.medicines) ? operationRows.medicines : []).map((row) => Array.isArray(row)
      ? { Medicine: row[0] ?? '', 'Default Dose': row[2] ?? '', Timing: row[3] ?? '', Status: row[4] ?? '' }
      : row).filter((row) => row.Medicine && row.Status !== 'Inactive');
  }, [operationRows]);

  useEffect(() => {
    const refresh = () => setClients(loadValue(clientsKey, []));
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, [clientsKey]);

  useEffect(() => {
    window.localStorage.setItem(journeysKey, JSON.stringify(journeys));
  }, [journeys, journeysKey]);

  useEffect(() => {
    window.localStorage.setItem(consultationTemplatesKey, JSON.stringify(consultationTemplates));
  }, [consultationTemplates, consultationTemplatesKey]);

  const clientRecords = useMemo(() => {
    const seen = new Set();
    return clients.filter((row) => {
      const name = clientName(row);
      if (!name) return false;
      const key = `${clientId(row) || name}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [clients]);
  const selectedClientRecord = useMemo(() => clients.find((row) => (
    clientName(row).toLowerCase() === selectedClient.toLowerCase()
    || clientId(row).toLowerCase() === selectedClient.toLowerCase()
  )), [clients, selectedClient]);
  const visibleClients = clientRecords.filter((row) => {
    const haystack = [clientId(row), clientName(row), clientMobile(row)].join(' ').toLowerCase();
    return haystack.includes(search.toLowerCase());
  });
  const journey = journeys[selectedClient] ?? {};
  const hasAppointment = appointments.some((row) => String(row?.[0] ?? row?.Client ?? '').toLowerCase() === selectedClient.toLowerCase());
  const hasPayment = payments.some((row) => String(row?.[0] ?? row?.Client ?? '').toLowerCase() === selectedClient.toLowerCase());
  const hasTreatment = (operationRows.treatments ?? []).some((row) => String(row?.[0] ?? row?.Client ?? '').toLowerCase() === selectedClient.toLowerCase());
  const selectedClientPhone = normalizePhoneNumber(clientMobile(selectedClientRecord));
  const requiredFormRecord = localForms.find((form) => String(form.title ?? '').toLowerCase() === requiredForm.toLowerCase());
  const hasRequiredFormResponse = localResponses.some((response) => {
    const sameForm = requiredFormRecord
      ? response.formId === requiredFormRecord.id || response.formSlug === requiredFormRecord.slug
      : String(response.formTitle ?? '').toLowerCase() === requiredForm.toLowerCase();
    if (!sameForm) return false;
    const phoneMatches = selectedClientPhone && responsePhone(response, requiredFormRecord) === selectedClientPhone;
    const nameMatches = selectedClient && responseName(response, requiredFormRecord) === selectedClient.toLowerCase();
    return phoneMatches || nameMatches;
  });

  const stageDone = (id) => {
    if (id === 'registration') return Boolean(selectedClient);
    if (id === 'appointment') return hasAppointment || journey.appointment;
    if (id === 'billing') return hasPayment || journey.billing;
    if (id === 'treatment') return hasTreatment || journey.treatment;
    if (id === 'forms') return hasRequiredFormResponse || journey.forms;
    return Boolean(journey[id]);
  };

  const updateJourney = (changes) => {
    if (!selectedClient) return;
    setJourneys((current) => ({
      ...current,
      [selectedClient]: { ...(current[selectedClient] ?? {}), ...changes, updatedAt: new Date().toISOString() },
    }));
  };

  useEffect(() => {
    if (!selectedClient || journey.forms || !hasRequiredFormResponse) return;
    updateJourney({ forms: true, requiredForm, formsCompletedAt: new Date().toISOString(), formAutoMatched: true });
  }, [selectedClient, journey.forms, hasRequiredFormResponse, requiredForm]);

  const openConsultation = () => {
    setConsultation(journey.consultationData ?? { complaint: '', diagnosis: '', notes: '', vitals: '' });
    setConsultationOpen(true);
  };

  const saveConsultation = () => {
    if (!consultation.diagnosis.trim() && !consultation.notes.trim()) return;
    updateJourney({ consultation: true, consultationData: consultation, consultedAt: new Date().toISOString() });
    setConsultationOpen(false);
  };

  const addSymptom = () => {
    if (!symptomChoice) return;
    const current = consultation.complaint.split(',').map((item) => item.trim()).filter(Boolean);
    if (!current.includes(symptomChoice)) current.push(symptomChoice);
    setConsultation((value) => ({ ...value, complaint: current.join(', ') }));
    setSymptomChoice('');
  };

  const removeSymptom = (symptom) => {
    setConsultation((value) => ({ ...value, complaint: value.complaint.split(',').map((item) => item.trim()).filter((item) => item && item !== symptom).join(', ') }));
  };

  const applyConsultationTemplate = (indexValue) => {
    setSelectedConsultationTemplate(indexValue);
    if (indexValue === '') return;
    const template = consultationTemplates[Number(indexValue)];
    if (!template) return;
    setConsultationTemplateName(template.name ?? '');
    setConsultation({ complaint: template.complaint ?? '', diagnosis: template.diagnosis ?? '', notes: template.notes ?? '', vitals: template.vitals ?? '' });
  };

  const saveConsultationTemplate = () => {
    const name = consultationTemplateName.trim();
    if (!name) return;
    const template = { name, ...consultation, updatedAt: new Date().toISOString() };
    setConsultationTemplates((current) => {
      const existing = current.findIndex((item) => item.name?.toLowerCase() === name.toLowerCase());
      return existing === -1 ? [...current, template] : current.map((item, index) => index === existing ? template : item);
    });
    setSelectedConsultationTemplate('');
  };

  const applyQuickConsultation = (preset) => {
    setConsultation({
      complaint: preset.complaint,
      diagnosis: preset.diagnosis,
      notes: preset.notes,
      vitals: preset.vitals,
    });
    setConsultationTemplateName(preset.label);
  };

  const setAppointmentPreset = (preset) => {
    const slot = currentSlot();
    if (preset === 'now') setAppointmentForm((value) => ({ ...value, ...slot, status: 'Checked-in', type: 'Consultation' }));
    if (preset === 'today') setAppointmentForm((value) => ({ ...value, date: slot.date, status: 'Confirmed' }));
    if (preset === 'tomorrow') setAppointmentForm((value) => ({ ...value, date: addDays(1), status: 'Confirmed' }));
    if (preset === 'week') setAppointmentForm((value) => ({ ...value, date: addDays(7), type: 'Follow-up', status: 'Confirmed' }));
    if (preset === 'month') setAppointmentForm((value) => ({ ...value, date: addDays(30), type: 'Follow-up', status: 'Confirmed' }));
  };

  const applyQuickTreatment = (preset) => {
    setTreatmentForm((value) => ({ ...value, ...preset }));
  };

  const applyTreatmentTemplate = (indexValue) => {
    if (indexValue === '') return;
    const template = treatmentTemplates[Number(indexValue)];
    if (!template) return;
    setTreatmentForm((value) => ({
      ...value,
      service: template.service ?? value.service,
      goal: template.goal ?? value.goal,
      duration: template.duration ?? value.duration,
      medicine: template.medicine ?? value.medicine,
      dose: template.dose ?? value.dose,
      timing: template.timing ?? value.timing,
    }));
  };

  const selectTreatmentMedicine = (medicineName) => {
    const entry = medicineCatalog.find((item) => item.Medicine.toLowerCase() === medicineName.toLowerCase());
    setTreatmentForm((value) => ({
      ...value,
      medicine: entry?.Medicine ?? medicineName,
      dose: entry?.['Default Dose'] ?? value.dose,
      timing: entry?.Timing ?? value.timing,
    }));
  };

  const nextAction = () => STAGES.find(([id]) => !stageDone(id))?.[0] ?? 'completed';
  const openStageModal = (stage) => {
    if (stage === 'consultation') {
      openConsultation();
      return;
    }
    if (stage === 'appointment') {
      const existing = normalizeAppointments(appointments).find((row) => String(row[0]).toLowerCase() === selectedClient.toLowerCase());
      setAppointmentForm(existing ? { mobile: existing[1] ?? clientMobile(selectedClientRecord), date: existing[2] ?? '', time: existing[3] ?? '', type: existing[4] ?? 'Consultation', status: existing[5] ?? 'Pending' } : { mobile: clientMobile(selectedClientRecord), ...currentSlot(), type: 'Consultation', status: 'Pending' });
    }
    if (stage === 'payment' || stage === 'billing') setPaymentForm({ invoice: nextInvoice(payments), amount: '', status: 'Paid', paidOn: new Date().toISOString().slice(0, 10) });
    setStageModal(stage);
  };

  const saveAppointment = () => {
    if (!appointmentForm.date || !appointmentForm.time) return;
    const current = normalizeAppointments(loadValue(appointmentsKey, []));
    const row = [selectedClient, appointmentForm.mobile, appointmentForm.date, appointmentForm.time, appointmentForm.type, appointmentForm.status];
    window.localStorage.setItem(appointmentsKey, JSON.stringify([row, ...current]));
    updateJourney({ appointment: true, appointmentData: appointmentForm, appointmentAt: new Date().toISOString() });
    setStageModal('');
  };

  const saveRequiredForm = () => {
    if (!hasRequiredFormResponse) return;
    updateJourney({ forms: true, requiredForm, formsCompletedAt: new Date().toISOString() });
    setStageModal('');
  };

  const saveTreatment = () => {
    if (!treatmentForm.goal.trim()) return;
    const current = loadValue(operationsKey, {});
    const row = [selectedClient, treatmentForm.service, treatmentForm.medicine, treatmentForm.dose, treatmentForm.timing, treatmentForm.goal, treatmentForm.duration, treatmentForm.status];
    window.localStorage.setItem(operationsKey, JSON.stringify({ ...current, treatments: [row, ...(current.treatments ?? [])] }));
    updateJourney({ treatment: true, treatmentData: treatmentForm, treatmentAt: new Date().toISOString() });
    setStageModal('');
  };

  const savePayment = () => {
    if (!paymentForm.amount) return;
    const current = loadValue(paymentsKey, []);
    const row = { client: selectedClient, ...paymentForm };
    window.localStorage.setItem(paymentsKey, JSON.stringify([row, ...current]));
    updateJourney({ billing: true, paymentData: paymentForm, paidAt: new Date().toISOString() });
    setStageModal('');
  };

  const runStage = (stage) => {
    if (stage === 'appointment' || stage === 'forms' || stage === 'consultation' || stage === 'treatment' || stage === 'billing') openStageModal(stage);
    else if (stage === 'followup') updateJourney({ followup: true, followupAt: new Date().toISOString() });
  };

  return (
    <section className="module-page journey-page">
      <div className="module-hero compact-hero">
        <div><h1>Client Journey</h1><p>Run the complete reception-to-payment workflow from one workspace.</p><p className="subtle">Shared cloud workspace</p></div>
        <div className="module-stats"><div className="mini-stat"><span>Registered</span><strong>{clientRecords.length}</strong></div><div className="mini-stat"><span>Active Journeys</span><strong>{Object.keys(journeys).length}</strong></div><div className="mini-stat"><span>Selected Stage</span><strong>{selectedClient ? nextAction() : 'Select client'}</strong></div></div>
      </div>

      <div className="journey-layout">
        <Card title="Reception Desk" subtitle="Search an existing client or register a new walk-in." action={<button className="pill primary-action" type="button" onClick={() => navigate('/clients?action=add')}>+ Register Client</button>}>
          <input className="lead-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client by ID, name, or mobile..." />
          <div className="journey-client-list">
            {visibleClients.length ? visibleClients.map((row) => {
              const name = clientName(row);
              const id = clientId(row);
              return (
                <button className={`journey-client ${selectedClient === name ? 'active' : ''}`} type="button" key={id || name} onClick={() => setSelectedClient(name)}><strong>{id ? `${id} · ${name}` : name}</strong><span>{journeys[name] ? 'Journey in progress' : 'Ready for check-in'}</span></button>
              );
            }) : <div className="empty-state compact-empty"><strong>No clients found.</strong><p>Register the client before booking an appointment.</p></div>}
          </div>
        </Card>

        <Card title={selectedClient ? `${selectedClient} Journey` : 'Journey Stages'} subtitle={selectedClient ? 'Complete each stage in order; earlier records remain linked.' : 'Select a client to begin.'}>
          {selectedClient ? (
            <>
              <div className="journey-stages">
                {STAGES.map(([id, label], index) => {
                  const complete = stageDone(id);
                  return <div className={`journey-stage ${complete ? 'complete' : ''}`} key={id}><span className="journey-index">{complete ? '✓' : index + 1}</span><div><strong>{label}</strong><small>{complete ? 'Completed' : 'Pending'}</small></div>{id !== 'registration' && <button className="pill" type="button" onClick={() => runStage(id)}>{complete ? 'Open' : id === 'consultation' ? 'Consult' : id === 'followup' ? 'Complete' : 'Start'}</button>}</div>;
                })}
              </div>
              {nextAction() !== 'completed' ? <button className="pill primary-action journey-next" type="button" onClick={() => runStage(nextAction())}>Continue to {STAGES.find(([id]) => id === nextAction())?.[1]}</button> : <div className="action-note"><strong>Journey completed.</strong> All required stages are recorded.</div>}
            </>
          ) : <div className="empty-state"><strong>No client selected.</strong><p>Choose a client from Reception Desk to see their workflow.</p></div>}
        </Card>
      </div>

      {stageModal === 'appointment' && <JourneyModal title="Add Appointment" client={selectedClient} onClose={() => setStageModal('')} onSave={saveAppointment} saveLabel="Save Appointment"><div className="quick-preset-row"><button className="pill" type="button" onClick={() => setAppointmentPreset('now')}>Walk-in now</button><button className="pill" type="button" onClick={() => setAppointmentPreset('today')}>Today</button><button className="pill" type="button" onClick={() => setAppointmentPreset('tomorrow')}>Tomorrow</button><button className="pill" type="button" onClick={() => setAppointmentPreset('week')}>After 7 days</button><button className="pill" type="button" onClick={() => setAppointmentPreset('month')}>After 30 days</button></div><label className="field-block"><span>Mobile</span><input className="lead-input" type="tel" value={appointmentForm.mobile} onChange={(event) => setAppointmentForm((value) => ({ ...value, mobile: event.target.value }))} /></label><label className="field-block"><span>Date</span><input className="lead-input" type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm((value) => ({ ...value, date: event.target.value }))} /></label><label className="field-block"><span>Time</span><input className="lead-input" type="time" value={appointmentForm.time} onChange={(event) => setAppointmentForm((value) => ({ ...value, time: event.target.value }))} /></label><label className="field-block"><span>Type</span><select className="lead-input" value={appointmentForm.type} onChange={(event) => setAppointmentForm((value) => ({ ...value, type: event.target.value }))}>{SERVICE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-block"><span>Status</span><select className="lead-input" value={appointmentForm.status} onChange={(event) => setAppointmentForm((value) => ({ ...value, status: event.target.value }))}><option>Pending</option><option>Confirmed</option><option>Checked-in</option><option>Cancelled</option></select></label></JourneyModal>}

      {stageModal === 'forms' && <JourneyModal title="Required Form" client={selectedClient} onClose={() => setStageModal('')} onSave={saveRequiredForm} saveLabel={hasRequiredFormResponse ? 'Mark Form Received' : 'Waiting for Submission'} saveDisabled={!hasRequiredFormResponse}><label className="field-block"><span>Form</span><select className="lead-input" value={requiredForm} onChange={(event) => setRequiredForm(event.target.value)}><option>Client Intake Form</option><option>Health Assessment</option><option>Consent Form</option><option>Diet & Lifestyle Assessment</option><option>Follow-up Assessment</option></select></label><div className="action-note"><strong>{hasRequiredFormResponse ? 'Submission found' : 'Submission not found'}</strong>{hasRequiredFormResponse ? ' Mobile number matched with a submitted form response. This stage will be marked received automatically.' : ' Ask the client to submit the selected form using the same mobile number saved in the client profile.'}</div></JourneyModal>}

      {stageModal === 'treatment' && <JourneyModal title="Add Treatment Plan" client={selectedClient} onClose={() => setStageModal('')} onSave={saveTreatment} saveLabel="Save Treatment"><div className="quick-preset-row">{QUICK_TREATMENTS.map((preset) => <button className="pill" type="button" key={preset.label} onClick={() => applyQuickTreatment(preset)}>{preset.label}</button>)}</div>{treatmentTemplates.length > 0 && <label className="field-block full-field"><span>Use Template</span><select className="lead-input" defaultValue="" onChange={(event) => applyTreatmentTemplate(event.target.value)}><option value="">Select saved template...</option>{treatmentTemplates.map((template, index) => <option key={`${template.name}-${index}`} value={index}>{template.name}</option>)}</select></label>}<label className="field-block"><span>Service</span><select className="lead-input" value={treatmentForm.service} onChange={(event) => setTreatmentForm((value) => ({ ...value, service: event.target.value }))}>{SERVICE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-block"><span>Goal</span><input className="lead-input" list="goal-presets" value={treatmentForm.goal} onChange={(event) => setTreatmentForm((value) => ({ ...value, goal: event.target.value }))} placeholder="Treatment goal" /><datalist id="goal-presets">{QUICK_TREATMENTS.map((preset) => <option key={preset.goal} value={preset.goal} />)}</datalist></label><label className="field-block"><span>Duration</span><select className="lead-input" value={treatmentForm.duration} onChange={(event) => setTreatmentForm((value) => ({ ...value, duration: event.target.value }))}>{DURATION_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-block"><span>Medicine / Product</span><input className="lead-input" list="journey-medicine-options" value={treatmentForm.medicine} onChange={(event) => selectTreatmentMedicine(event.target.value)} placeholder={medicineCatalog.length ? 'Search medicine...' : 'Add medicines first'} /><datalist id="journey-medicine-options">{medicineCatalog.map((medicine) => <option key={medicine.Medicine} value={medicine.Medicine}>{medicine['Default Dose']}</option>)}</datalist></label><label className="field-block"><span>Dose</span><input className="lead-input" list="dose-presets" value={treatmentForm.dose} onChange={(event) => setTreatmentForm((value) => ({ ...value, dose: event.target.value }))} /><datalist id="dose-presets">{Array.from(new Set(medicineCatalog.map((item) => item['Default Dose']).filter(Boolean))).map((dose) => <option key={dose} value={dose} />)}</datalist></label><label className="field-block"><span>Timing</span><input className="lead-input" list="timing-presets" value={treatmentForm.timing} onChange={(event) => setTreatmentForm((value) => ({ ...value, timing: event.target.value }))} /><datalist id="timing-presets">{Array.from(new Set([...medicineCatalog.map((item) => item.Timing), 'After meals', 'Before meals', 'Morning', 'Night', 'Weekly once'].filter(Boolean))).map((timing) => <option key={timing} value={timing} />)}</datalist></label></JourneyModal>}

      {stageModal === 'billing' && <JourneyModal title="Add Payment" client={selectedClient} onClose={() => setStageModal('')} onSave={savePayment} saveLabel="Save Payment"><div className="quick-preset-row">{PAYMENT_AMOUNTS.map((amount) => <button className="pill" type="button" key={amount} onClick={() => setPaymentForm((value) => ({ ...value, amount }))}>Rs {amount}</button>)}</div><label className="field-block"><span>Invoice</span><input className="lead-input" value={paymentForm.invoice} readOnly /></label><label className="field-block"><span>Amount</span><input className="lead-input" type="number" min="0" value={paymentForm.amount} onChange={(event) => setPaymentForm((value) => ({ ...value, amount: event.target.value }))} placeholder="0" /></label><label className="field-block"><span>Status</span><select className="lead-input" value={paymentForm.status} onChange={(event) => setPaymentForm((value) => ({ ...value, status: event.target.value }))}><option>Paid</option><option>Partial</option><option>Pending</option></select></label><label className="field-block"><span>Paid On</span><input className="lead-input" type="date" value={paymentForm.paidOn} onChange={(event) => setPaymentForm((value) => ({ ...value, paidOn: event.target.value }))} /></label></JourneyModal>}

      {consultationOpen && <div className="modal-backdrop" role="presentation" onClick={() => setConsultationOpen(false)}><div className="modal-shell consultation-modal" role="dialog" aria-modal="true" aria-label="Doctor Consultation" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><h2>Doctor Consultation</h2><p>{selectedClient}</p></div><button className="icon-btn" type="button" onClick={() => setConsultationOpen(false)} aria-label="Close modal">x</button></div><div className="modal-body detail-grid"><div className="quick-preset-row">{QUICK_CONSULTATIONS.map((preset) => <button className="pill" type="button" key={preset.label} onClick={() => applyQuickConsultation(preset)}>{preset.label}</button>)}</div><div className="consultation-template-tools"><label className="field-block"><span>Use Template</span><select className="lead-input" value={selectedConsultationTemplate} onChange={(event) => applyConsultationTemplate(event.target.value)}><option value="">{consultationTemplates.length ? 'Select consultation template...' : 'No templates saved yet'}</option>{consultationTemplates.map((template, index) => <option key={`${template.name}-${index}`} value={index}>{template.name}</option>)}</select></label><label className="field-block"><span>Template Name</span><input className="lead-input" value={consultationTemplateName} onChange={(event) => setConsultationTemplateName(event.target.value)} placeholder="e.g. Diabetes Follow-up" /></label><button className="pill" type="button" disabled={!consultationTemplateName.trim()} onClick={saveConsultationTemplate}>Save Template</button></div><div className="symptom-builder"><label className="field-block"><span>Symptoms / Chief Complaint</span><select className="lead-input" value={symptomChoice} onChange={(event) => setSymptomChoice(event.target.value)}><option value="">Select symptom...</option>{SYMPTOM_OPTIONS.map((symptom) => <option key={symptom}>{symptom}</option>)}</select></label><button className="pill" type="button" onClick={addSymptom} disabled={!symptomChoice}>Add Symptom</button><div className="consultation-chips">{consultation.complaint.split(',').map((item) => item.trim()).filter(Boolean).map((symptom) => <button className="tag symptom-chip" type="button" key={symptom} onClick={() => removeSymptom(symptom)}>{symptom} x</button>)}</div></div><label className="field-block"><span>Vitals</span><input className="lead-input" list="vital-presets" value={consultation.vitals} onChange={(event) => setConsultation((current) => ({ ...current, vitals: event.target.value }))} placeholder="Select or enter measured vitals" /><datalist id="vital-presets">{VITAL_OPTIONS.map((option) => <option key={option} value={option} />)}</datalist></label><label className="field-block"><span>Diagnosis</span><select className="lead-input" value={consultation.diagnosis} onChange={(event) => setConsultation((current) => ({ ...current, diagnosis: event.target.value }))}><option value="">Select diagnosis...</option>{DIAGNOSIS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-block"><span>Doctor Notes</span><select className="lead-input" value={consultation.notes} onChange={(event) => setConsultation((current) => ({ ...current, notes: event.target.value }))}><option value="">Select reusable note...</option>{NOTE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label></div><div className="modal-actions"><button className="pill" type="button" onClick={() => setConsultationOpen(false)}>Cancel</button><button className="pill primary-action" type="button" onClick={saveConsultation}>Complete Consultation</button></div></div></div>}
    </section>
  );
}

function JourneyModal({ title, client, children, onClose, onSave, saveLabel, saveDisabled = false }) {
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><h2>{title}</h2><p>For {client}</p></div><button className="icon-btn" type="button" onClick={onClose} aria-label="Close modal">x</button></div><div className="modal-body detail-grid">{children}</div><div className="modal-actions"><button className="pill" type="button" onClick={onClose}>Cancel</button><button className="pill primary-action" type="button" onClick={onSave} disabled={saveDisabled}>{saveLabel}</button></div></div></div>;
}

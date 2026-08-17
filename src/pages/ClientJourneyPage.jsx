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

function clientVisitDate(row) {
  if (Array.isArray(row)) return row.length >= 8 ? row[3] ?? '' : '';
  return row?.visitDate ?? row?.['Visit Date'] ?? row?.createdAt ?? row?.date ?? '';
}

function dateTimeValue(date, time = '') {
  if (!date) return 0;
  const normalizedDate = String(date).slice(0, 10);
  const normalizedTime = String(time || '00:00').slice(0, 5);
  const value = new Date(`${normalizedDate}T${normalizedTime}`).getTime();
  return Number.isFinite(value) ? value : 0;
}

function formatJourneyDateTime(date, time = '') {
  const value = dateTimeValue(date, time);
  if (!value) return 'No visit yet';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  });
}

function normalizePhoneNumber(value) {
  return String(value ?? '').replace(/\D/g, '').slice(-10);
}

function normalizePersonName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(dr|doctor|mr|mrs|ms|miss|shri|smt)\.?\s+/i, '')
    .replace(/[^a-z0-9\u0900-\u097f\u0a80-\u0aff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const phoneMatcher = (value) => /phone|mobile|whats?\s*app|contact\s*(?:no|number)?|મોબાઇલ|मोबाइल/i.test(String(value ?? ''));
  const value = responseFieldValue(response, form, (field) => field.type === 'phone' || phoneMatcher(field.label))
    || answerValue(response, phoneMatcher);
  return normalizePhoneNumber(value);
}

function responseName(response, form) {
  const value = responseFieldValue(response, form, (field) => /name|client|patient/i.test(field.label))
    || answerValue(response, (key) => /name|client|patient/i.test(key));
  return normalizePersonName(value);
}

function formTitle(form) {
  return String(form?.title || form?.name || form?.slug || form?.id || '').trim();
}

function formatResponseDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function displayAnswer(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (value && typeof value === 'object') return value.name ?? value.url ?? JSON.stringify(value);
  return String(value ?? '').trim();
}

function escapePrintHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function responsePreview(response, form) {
  const answers = response?.answers && typeof response.answers === 'object' ? response.answers : {};
  const fields = Array.isArray(form?.fields) ? form.fields : [];
  const labelsById = new Map(fields.map((field) => [field.id, field.label || field.id]));
  return Object.entries(answers)
    .map(([key, value]) => [labelsById.get(key) ?? key, displayAnswer(value)])
    .filter(([, value]) => value)
    .slice(0, 4);
}

const STAGES = [
  ['registration', 'Registration'],
  ['appointment', 'Appointment'],
  ['consultation', 'Doctor Consultation'],
  ['treatment', 'Treatment Plan'],
  ['billing', 'Invoice & Payment'],
  ['followup', 'Next Follow-up'],
  ['forms', 'Required Forms'],
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

const PRINT_SECTION_OPTIONS = [
  ['patient', 'Patient Details'],
  ['symptoms', 'Symptoms / Chief Complaint'],
  ['vitals', 'Vitals'],
  ['diagnosis', 'Diagnosis'],
  ['doctorNotes', 'Doctor Notes'],
  ['treatment', 'Treatment Plan'],
  ['medicines', 'Medicines, Dose & Timing'],
  ['followup', 'Next Follow-up'],
  ['payment', 'Payment Details'],
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

function visitDateFromJourney(visit) {
  return visit?.visitDate
    || visit?.appointmentData?.date
    || String(visit?.appointmentAt ?? visit?.consultedAt ?? visit?.updatedAt ?? '').slice(0, 10)
    || currentSlot().date;
}

function normalizeJourneyRecord(record) {
  if (Array.isArray(record?.visits)) {
    const visits = record.visits.map((visit, index) => ({
      ...visit,
      id: visit.id || `visit-${visitDateFromJourney(visit)}-${index}`,
      visitDate: visitDateFromJourney(visit),
    }));
    return { visits, activeVisitId: record.activeVisitId || visits.at(-1)?.id || '' };
  }
  if (!record || !Object.keys(record).length) return { visits: [], activeVisitId: '' };
  const legacyVisit = {
    ...record,
    id: `visit-${visitDateFromJourney(record)}-legacy`,
    visitDate: visitDateFromJourney(record),
  };
  return { visits: [legacyVisit], activeVisitId: legacyVisit.id };
}

function nextInvoice(rows = []) {
  const highest = rows.reduce((max, row) => {
    const value = Array.isArray(row) ? row[1] : row?.invoice;
    const match = String(value ?? '').match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `INV-${String(highest + 1).padStart(3, '0')}`;
}

function parsePaymentAmount(value) {
  const numeric = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function calculatePaymentPending(totalAmount, paidAmount, status) {
  const total = parsePaymentAmount(totalAmount);
  const paid = parsePaymentAmount(paidAmount);
  const normalizedStatus = String(status ?? '').toLowerCase();
  if (normalizedStatus === 'paid') return 0;
  if (normalizedStatus === 'pending' && !paid) return total;
  return Math.max(total - paid, 0);
}

function normalizeJourneyPayment(entry) {
  const status = entry.status ?? 'Paid';
  const totalAmount = entry.amount ?? '';
  const paidAmount = entry.paidAmount ?? (String(status).toLowerCase() === 'paid' ? totalAmount : '');
  return {
    ...entry,
    amount: totalAmount,
    paidAmount,
    pendingAmount: totalAmount !== undefined && totalAmount !== ''
      ? calculatePaymentPending(totalAmount, paidAmount, status)
      : entry.pendingAmount,
  };
}

function SearchablePresetInput({ label, value, options, onChange, onSelect, onCommit, placeholder, action, helperText }) {
  const [focused, setFocused] = useState(false);
  const query = String(value ?? '').trim().toLowerCase();
  const keywords = query.split(/\s+/).filter(Boolean);
  const matches = query
    ? options.filter((option) => keywords.every((keyword) => option.toLowerCase().includes(keyword))).slice(0, 7)
    : [];

  const selectOption = (option) => {
    (onSelect ?? onChange)(option);
    setFocused(false);
  };

  return (
    <div className="field-block searchable-preset">
      <span>{label}</span>
      <div className="searchable-preset-row">
        <input
          className="lead-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !onCommit || !String(value ?? '').trim()) return;
            event.preventDefault();
            onCommit();
            setFocused(false);
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={focused && Boolean(query)}
          aria-autocomplete="list"
        />
        {action}
      </div>
      {helperText && <small className="field-help">{helperText}</small>}
      {focused && query && (
        <div className="searchable-preset-results" role="listbox">
          {matches.length ? matches.map((option) => (
            <button
              type="button"
              role="option"
              key={option}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              {option}
            </button>
          )) : <div className="searchable-preset-empty">No matching option. You can use the typed value.</div>}
        </div>
      )}
    </div>
  );
}

function MedicineSearchInput({ index, value, catalog, onChange, onSelect, onAdd }) {
  const [focused, setFocused] = useState(false);
  const query = String(value ?? '').trim().toLowerCase();
  const matches = catalog
    .filter((item) => !query || `${item.Medicine} ${item['Default Dose'] || ''} ${item.Timing || ''}`.toLowerCase().includes(query))
    .slice(0, 8);
  const exactMatch = catalog.some((item) => item.Medicine.toLowerCase() === query);

  return (
    <div className="field-block searchable-preset medicine-search-picker">
      <span>Medicine {index + 1}</span>
      <input
        className="lead-input"
        value={value}
        onChange={(event) => { onChange(event.target.value); setFocused(true); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setFocused(false);
          if (event.key === 'Enter' && matches[0]) {
            event.preventDefault();
            onSelect(matches[0]);
            setFocused(false);
          }
        }}
        placeholder="Search medicine..."
        autoComplete="off"
        role="combobox"
        aria-expanded={focused}
        aria-autocomplete="list"
      />
      {focused && (
        <div className="searchable-field-results medicine-search-results" role="listbox">
          {matches.map((item) => (
            <button type="button" role="option" key={item.Medicine} onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(item); setFocused(false); }}>
              <strong>{item.Medicine}</strong>
              <small>{[item['Default Dose'], item.Timing].filter(Boolean).join(' · ') || 'Dose and timing not saved'}</small>
            </button>
          ))}
          {query && !exactMatch && (
            <button className="medicine-add-result" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onAdd(); setFocused(false); }}>
              <strong>+ Add “{value.trim()}” as new medicine</strong>
              <small>Current dose and timing will be saved in Medicines master.</small>
            </button>
          )}
          {!matches.length && (!query || exactMatch) ? <div className="searchable-field-empty">No matching medicine found.</div> : null}
        </div>
      )}
    </div>
  );
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
  const customSymptomsKey = branchKey('consultation-custom-symptoms:v1');
  const customDoctorNotesKey = branchKey('consultation-custom-doctor-notes:v1');
  const clinicalPrintTemplatesKey = branchKey('clinical-print-templates:v1');
  const patientFormUpdatesKey = branchKey('patient-form-updates:v1');
  const [clients, setClients] = useState(() => loadValue(clientsKey, []));
  const [journeys, setJourneys] = useState(() => loadValue(journeysKey, {}));
  const [selectedClient, setSelectedClient] = useState(() => searchParams.get('client') ?? '');
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [search, setSearch] = useState('');
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [consultation, setConsultation] = useState({ complaint: '', diagnosis: '', notes: '', vitals: '' });
  const [consultationTemplates, setConsultationTemplates] = useState(() => loadValue(consultationTemplatesKey, []));
  const [consultationTemplateName, setConsultationTemplateName] = useState('');
  const [selectedConsultationTemplate, setSelectedConsultationTemplate] = useState('');
  const [symptomChoice, setSymptomChoice] = useState('');
  const [customSymptoms, setCustomSymptoms] = useState(() => loadValue(customSymptomsKey, []));
  const [doctorNoteChoice, setDoctorNoteChoice] = useState('');
  const [customDoctorNotes, setCustomDoctorNotes] = useState(() => loadValue(customDoctorNotesKey, []));
  const [pregnancyHistoryOpen, setPregnancyHistoryOpen] = useState(false);
  const [pregnancyHistoryForm, setPregnancyHistoryForm] = useState(() => ({
    date: currentSlot().date,
    pregnancyStage: '',
    gynecName: '',
    gynecAdvice: '',
    tests: '',
    medicines: '',
    garbhsanskarAdvice: '',
    nextFollowup: '',
  }));
  const [stageModal, setStageModal] = useState('');
  const [appointmentForm, setAppointmentForm] = useState(() => ({ mobile: '', ...currentSlot(), type: 'Consultation', status: 'Pending' }));
  const [requiredForm, setRequiredForm] = useState('Patient Intake Form');
  const [treatmentForm, setTreatmentForm] = useState({ service: 'Consultation', goal: '', duration: '30 days', medicine: '', dose: '', timing: '', status: 'Active' });
  const [treatmentMedicineRows, setTreatmentMedicineRows] = useState([{ medicine: '', dose: '', timing: '' }]);
  const [medicineCatalogRevision, setMedicineCatalogRevision] = useState(0);
  const [paymentForm, setPaymentForm] = useState({ invoice: '', amount: '', paidAmount: '', pendingAmount: '', status: 'Paid', paidOn: new Date().toISOString().slice(0, 10) });
  const [followupForm, setFollowupForm] = useState(() => ({ date: addDays(7), time: currentSlot().time, notes: '', status: 'Confirmed' }));
  const [clinicalPrintOpen, setClinicalPrintOpen] = useState(false);
  const [clinicalPrintTitle, setClinicalPrintTitle] = useState('Consultation & Treatment Summary');
  const [clinicalPrintNote, setClinicalPrintNote] = useState('');
  const [clinicalPrintSections, setClinicalPrintSections] = useState(() => Object.fromEntries(PRINT_SECTION_OPTIONS.map(([id]) => [id, true])));
  const [clinicalPrintVisitIds, setClinicalPrintVisitIds] = useState([]);
  const [clinicalPrintTemplates, setClinicalPrintTemplates] = useState(() => loadValue(clinicalPrintTemplatesKey, []));
  const [clinicalPrintTemplateName, setClinicalPrintTemplateName] = useState('');
  const [selectedClinicalPrintTemplate, setSelectedClinicalPrintTemplate] = useState('');
  const appointments = loadValue(appointmentsKey, []);
  const payments = loadValue(paymentsKey, []);
  const treatmentTemplates = loadValue(treatmentTemplatesKey, loadValue('ayurflow:treatment-templates:v1', []));
  const [localForms, setLocalForms] = useState(() => loadForms());
  const [localResponses, setLocalResponses] = useState(() => loadAllLocalResponses());
  const [patientFormUpdates, setPatientFormUpdates] = useState(() => loadValue(patientFormUpdatesKey, []));
  const formOptions = localForms.filter((form) => formTitle(form));
  const formByKey = new Map(localForms.flatMap((form) => [[form.id, form], [form.slug, form]].filter(([key]) => key)));
  const medicineCatalog = useMemo(() => {
    const operationRows = loadValue(operationsKey, {});
    return (Array.isArray(operationRows.medicines) ? operationRows.medicines : []).map((row) => Array.isArray(row)
      ? { Medicine: row[0] ?? '', 'Default Dose': row[2] ?? '', Timing: row[3] ?? '' }
      : row).filter((row) => row.Medicine);
  }, [operationsKey, medicineCatalogRevision]);

  useEffect(() => {
    const refresh = () => setClients(loadValue(clientsKey, []));
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, [clientsKey]);

  useEffect(() => {
    const refresh = () => setPatientFormUpdates(loadValue(patientFormUpdatesKey, []));
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('moms-pathshala:cloud-hydrated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('moms-pathshala:cloud-hydrated', refresh);
    };
  }, [patientFormUpdatesKey]);

  useEffect(() => {
    const refreshFormsAndResponses = () => {
      setLocalForms(loadForms());
      setLocalResponses(loadAllLocalResponses());
    };
    window.addEventListener('focus', refreshFormsAndResponses);
    window.addEventListener('storage', refreshFormsAndResponses);
    window.addEventListener('moms-pathshala:cloud-hydrated', refreshFormsAndResponses);
    return () => {
      window.removeEventListener('focus', refreshFormsAndResponses);
      window.removeEventListener('storage', refreshFormsAndResponses);
      window.removeEventListener('moms-pathshala:cloud-hydrated', refreshFormsAndResponses);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(journeysKey, JSON.stringify(journeys));
  }, [journeys, journeysKey]);

  useEffect(() => {
    window.localStorage.setItem(consultationTemplatesKey, JSON.stringify(consultationTemplates));
  }, [consultationTemplates, consultationTemplatesKey]);

  useEffect(() => {
    window.localStorage.setItem(customSymptomsKey, JSON.stringify(customSymptoms));
  }, [customSymptoms, customSymptomsKey]);

  useEffect(() => {
    window.localStorage.setItem(customDoctorNotesKey, JSON.stringify(customDoctorNotes));
  }, [customDoctorNotes, customDoctorNotesKey]);

  useEffect(() => {
    window.localStorage.setItem(clinicalPrintTemplatesKey, JSON.stringify(clinicalPrintTemplates));
  }, [clinicalPrintTemplates, clinicalPrintTemplatesKey]);

  useEffect(() => {
    if (!formOptions.length) return;
    if (formOptions.some((form) => formTitle(form).toLowerCase() === requiredForm.toLowerCase())) return;
    setRequiredForm(formTitle(formOptions[0]));
  }, [formOptions, requiredForm]);

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
  const clientVisitMeta = useMemo(() => {
    const byName = new Map();
    const remember = (name, date, time = '') => {
      const key = normalizePersonName(name);
      const value = dateTimeValue(date, time);
      if (!key || !value || value <= (byName.get(key)?.value ?? 0)) return;
      byName.set(key, { date: String(date).slice(0, 10), time: String(time ?? '').slice(0, 5), value });
    };
    appointments.forEach((row) => {
      if (Array.isArray(row)) remember(row[0], row[2], row[3]);
      else remember(row?.client ?? row?.Client ?? row?.name, row?.date ?? row?.['Visit Date'], row?.time);
    });
    clientRecords.forEach((row) => remember(clientName(row), clientVisitDate(row)));
    Object.entries(journeys).forEach(([name, record]) => {
      normalizeJourneyRecord(record).visits.forEach((visit) => remember(
        name,
        visit.appointmentData?.date ?? visit.visitDate,
        visit.appointmentData?.time ?? '',
      ));
    });
    return byName;
  }, [appointments, clientRecords, journeys]);
  const visibleClients = useMemo(() => clientRecords
    .filter((row) => {
      const haystack = [clientId(row), clientName(row), clientMobile(row)].join(' ').toLowerCase();
      return haystack.includes(search.toLowerCase());
    })
    .sort((left, right) => {
      const rightValue = clientVisitMeta.get(normalizePersonName(clientName(right)))?.value ?? 0;
      const leftValue = clientVisitMeta.get(normalizePersonName(clientName(left)))?.value ?? 0;
      return rightValue - leftValue || clientName(left).localeCompare(clientName(right));
    }), [clientRecords, clientVisitMeta, search]);
  const patientJourneyRecord = normalizeJourneyRecord(journeys[selectedClient]);
  const journeyVisits = patientJourneyRecord.visits;
  const activeVisitId = journeyVisits.some((visit) => visit.id === selectedVisitId)
    ? selectedVisitId
    : patientJourneyRecord.activeVisitId || journeyVisits.at(-1)?.id || '';
  const journey = journeyVisits.find((visit) => visit.id === activeVisitId) ?? {};
  const pregnancyHistoryEntries = useMemo(() => journeyVisits.flatMap((visit) => (
    Array.isArray(visit.pregnancyHistory) ? visit.pregnancyHistory.map((entry) => ({
      ...entry,
      visitId: visit.id,
      visitDate: visit.visitDate,
    })) : []
  )).sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || ''))), [journeyVisits]);
  const clinicalPreviewMedicines = Array.isArray(journey.treatmentData?.medicines)
    ? journey.treatmentData.medicines.filter((item) => item?.medicine)
    : String(journey.treatmentData?.medicine ?? '').split(',').map((medicine, index) => ({
      medicine: medicine.trim(),
      dose: String(journey.treatmentData?.dose ?? '').split(',')[index]?.trim() ?? '',
      timing: String(journey.treatmentData?.timing ?? '').split(',')[index]?.trim() ?? '',
    })).filter((item) => item.medicine);
  useEffect(() => {
    const record = normalizeJourneyRecord(journeys[selectedClient]);
    setSelectedVisitId(record.activeVisitId || record.visits.at(-1)?.id || '');
  }, [selectedClient]);
  const selectedClientPhone = normalizePhoneNumber(clientMobile(selectedClientRecord));
  const selectedWeightUpdates = patientFormUpdates
    .filter((update) => update?.type === 'weight' && (
      (selectedClientPhone && normalizePhoneNumber(update.mobile) === selectedClientPhone)
      || (clientId(selectedClientRecord) && String(update.patientId) === String(clientId(selectedClientRecord)))
    ))
    .sort((a, b) => String(b.recordedAt ?? '').localeCompare(String(a.recordedAt ?? '')));
  const requiredFormRecord = localForms.find((form) => formTitle(form).toLowerCase() === requiredForm.toLowerCase());
  const matchedFormResponses = localResponses
    .map((response) => {
      const form = formByKey.get(response.formId) ?? formByKey.get(response.formSlug);
      const phoneMatches = selectedClientPhone && responsePhone(response, form) === selectedClientPhone;
      const nameMatches = selectedClient && responseName(response, form) === normalizePersonName(selectedClient);
      return { response, form, phoneMatches, nameMatches };
    })
    .filter((item) => item.phoneMatches || item.nameMatches)
    .sort((a, b) => String(b.response.submittedAt ?? '').localeCompare(String(a.response.submittedAt ?? '')));
  const hasRequiredFormResponse = localResponses.some((response) => {
    const sameForm = requiredFormRecord
      ? response.formId === requiredFormRecord.id || response.formSlug === requiredFormRecord.slug
      : String(response.formTitle ?? '').toLowerCase() === requiredForm.toLowerCase();
    if (!sameForm) return false;
    const phoneMatches = selectedClientPhone && responsePhone(response, requiredFormRecord) === selectedClientPhone;
    const nameMatches = selectedClient && responseName(response, requiredFormRecord) === normalizePersonName(selectedClient);
    return phoneMatches || nameMatches;
  });
  const hasCurrentVisitFormResponse = matchedFormResponses.some(({ response }) => {
    if (!journey.visitDate) return true;
    return String(response.submittedAt ?? '').slice(0, 10) >= journey.visitDate;
  });

  const stageDone = (id) => {
    if (id === 'registration') return Boolean(selectedClient);
    if (id === 'appointment') return Boolean(journey.appointment);
    if (id === 'billing') return Boolean(journey.billing);
    if (id === 'treatment') return Boolean(journey.treatment);
    if (id === 'forms') return Boolean(journey.forms);
    return Boolean(journey[id]);
  };
  const stageDetail = (id, complete) => {
    if (id === 'followup' && journey.followupData?.date) {
      return `${formatResponseDate(journey.followupData.date)} · ${journey.followupData.time || 'Time pending'}`;
    }
    return complete ? 'Completed' : 'Pending';
  };

  const updateJourney = (changes) => {
    if (!selectedClient) return;
    const targetId = selectedVisitId || patientJourneyRecord.activeVisitId || `visit-${Date.now()}`;
    if (!selectedVisitId) setSelectedVisitId(targetId);
    setJourneys((current) => {
      const record = normalizeJourneyRecord(current[selectedClient]);
      const now = new Date().toISOString();
      let visits = record.visits;
      if (!visits.some((visit) => visit.id === targetId)) {
        visits = [...visits, { id: targetId, visitDate: currentSlot().date, createdAt: now }];
      }
      return {
        ...current,
        [selectedClient]: {
          visits: visits.map((visit) => visit.id === targetId ? { ...visit, ...changes, updatedAt: now } : visit),
          activeVisitId: targetId,
        },
      };
    });
  };

  useEffect(() => {
    if (!selectedClient || !activeVisitId || journey.forms || !hasCurrentVisitFormResponse) return;
    updateJourney({ forms: true, requiredForm, formsCompletedAt: new Date().toISOString(), formAutoMatched: true });
  }, [selectedClient, activeVisitId, journey.forms, hasCurrentVisitFormResponse, requiredForm]);

  const openConsultation = () => {
    setConsultation(journey.consultationData ?? { complaint: '', diagnosis: '', notes: '', vitals: '' });
    setConsultationOpen(true);
  };

  const openPregnancyHistory = () => {
    setPregnancyHistoryForm({
      date: journey.visitDate || currentSlot().date,
      pregnancyStage: '',
      gynecName: '',
      gynecAdvice: '',
      tests: '',
      medicines: '',
      garbhsanskarAdvice: '',
      nextFollowup: '',
    });
    setPregnancyHistoryOpen(true);
  };

  const savePregnancyHistory = () => {
    if (!pregnancyHistoryForm.gynecAdvice.trim() && !pregnancyHistoryForm.garbhsanskarAdvice.trim()) return;
    const entry = {
      ...pregnancyHistoryForm,
      id: `pregnancy-note-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    updateJourney({ pregnancyHistory: [entry, ...(journey.pregnancyHistory ?? [])] });
    setPregnancyHistoryOpen(false);
  };

  const saveConsultation = () => {
    if (!consultation.diagnosis.trim() && !consultation.notes.trim()) return;
    updateJourney({ consultation: true, consultationData: consultation, consultedAt: new Date().toISOString() });
    setConsultationOpen(false);
  };

  const addSymptom = () => {
    const symptom = symptomChoice.trim().replace(/\s+/g, ' ');
    if (!symptom) return;
    const current = consultation.complaint.split(',').map((item) => item.trim()).filter(Boolean);
    if (!current.some((item) => item.toLowerCase() === symptom.toLowerCase())) current.push(symptom);
    if (![...SYMPTOM_OPTIONS, ...customSymptoms].some((item) => item.toLowerCase() === symptom.toLowerCase())) {
      setCustomSymptoms((items) => [...items, symptom]);
    }
    setConsultation((value) => ({ ...value, complaint: current.join(', ') }));
    setSymptomChoice('');
  };

  const removeSymptom = (symptom) => {
    setConsultation((value) => ({ ...value, complaint: value.complaint.split(',').map((item) => item.trim()).filter((item) => item && item !== symptom).join(', ') }));
  };

  const addDoctorNote = (selectedNote = doctorNoteChoice) => {
    const note = String(selectedNote ?? '').trim().replace(/\s+/g, ' ');
    if (!note) return;
    const current = consultation.notes.split('\n').map((item) => item.trim()).filter(Boolean);
    if (!current.some((item) => item.toLowerCase() === note.toLowerCase())) current.push(note);
    if (![...NOTE_OPTIONS, ...customDoctorNotes].some((item) => item.toLowerCase() === note.toLowerCase())) {
      setCustomDoctorNotes((items) => [...items, note]);
    }
    setConsultation((value) => ({ ...value, notes: current.join('\n') }));
    setDoctorNoteChoice('');
  };

  const removeDoctorNote = (note) => {
    setConsultation((value) => ({
      ...value,
      notes: value.notes.split('\n').map((item) => item.trim()).filter((item) => item && item !== note).join('\n'),
    }));
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
    const medicines = Array.isArray(template.medicines)
      ? template.medicines
      : String(template.medicine ?? '').split(',').map((medicine, index) => ({
          medicine: medicine.trim(),
          dose: String(template.dose ?? '').split(',')[index]?.trim() ?? '',
          timing: String(template.timing ?? '').split(',')[index]?.trim() ?? '',
        })).filter((row) => row.medicine);
    setTreatmentMedicineRows(medicines.length ? medicines : [{ medicine: '', dose: '', timing: '' }]);
  };

  const syncTreatmentMedicineRows = (rows) => {
    const nextRows = rows.length ? rows : [{ medicine: '', dose: '', timing: '' }];
    setTreatmentMedicineRows(nextRows);
    setTreatmentForm((value) => ({
      ...value,
      medicine: nextRows.map((row) => row.medicine).filter(Boolean).join(', '),
      dose: nextRows.map((row) => row.dose).filter(Boolean).join(', '),
      timing: nextRows.map((row) => row.timing).filter(Boolean).join(', '),
    }));
  };

  const selectTreatmentMedicine = (index, medicineName) => {
    const entry = typeof medicineName === 'object' ? medicineName : medicineCatalog.find((item) => item.Medicine.toLowerCase() === medicineName.toLowerCase());
    syncTreatmentMedicineRows(treatmentMedicineRows.map((row, rowIndex) => rowIndex === index ? {
      medicine: entry?.Medicine ?? medicineName,
      dose: entry?.['Default Dose'] ?? row.dose,
      timing: entry?.Timing ?? row.timing,
    } : row));
  };

  const addTreatmentMedicineToCatalog = (index) => {
    const row = treatmentMedicineRows[index];
    const name = row?.medicine?.trim();
    if (!name || medicineCatalog.some((item) => item.Medicine.toLowerCase() === name.toLowerCase())) return;
    const operations = loadValue(operationsKey, {});
    const medicines = Array.isArray(operations.medicines) ? operations.medicines : [];
    window.localStorage.setItem(operationsKey, JSON.stringify({
      ...operations,
      medicines: [[name, 'General', row.dose || '', row.timing || ''], ...medicines],
    }));
    setMedicineCatalogRevision((current) => current + 1);
  };

  const updateTreatmentMedicine = (index, field, value) => {
    syncTreatmentMedicineRows(treatmentMedicineRows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const removeTreatmentMedicine = (index) => {
    syncTreatmentMedicineRows(treatmentMedicineRows.filter((_, rowIndex) => rowIndex !== index));
  };

  const nextAction = () => STAGES.find(([id]) => !stageDone(id))?.[0] ?? 'completed';
  const openStageModal = (stage) => {
    if (stage === 'consultation') {
      openConsultation();
      return;
    }
    if (stage === 'appointment') {
      setAppointmentForm(journey.appointmentData ?? { mobile: clientMobile(selectedClientRecord), ...currentSlot(), type: 'Consultation', status: 'Pending' });
    }
    if (stage === 'treatment') {
      const savedTreatment = journey.treatmentData;
      const nextForm = savedTreatment ?? { service: 'Consultation', goal: '', duration: '30 days', medicine: '', dose: '', timing: '', status: 'Active' };
      setTreatmentForm(nextForm);
      const medicines = Array.isArray(savedTreatment?.medicines)
        ? savedTreatment.medicines
        : String(savedTreatment?.medicine ?? '').split(',').map((medicine, index) => ({
            medicine: medicine.trim(),
            dose: String(savedTreatment?.dose ?? '').split(',')[index]?.trim() ?? '',
            timing: String(savedTreatment?.timing ?? '').split(',')[index]?.trim() ?? '',
          })).filter((row) => row.medicine);
      setTreatmentMedicineRows(medicines.length ? medicines : [{ medicine: '', dose: '', timing: '' }]);
    }
    if (stage === 'followup') {
      setFollowupForm(journey.followupData ?? { date: addDays(7), time: currentSlot().time, notes: '', status: 'Confirmed' });
    }
    if (stage === 'payment' || stage === 'billing') setPaymentForm(journey.paymentData ?? { invoice: nextInvoice(payments), amount: '', paidAmount: '', pendingAmount: '', status: 'Paid', paidOn: new Date().toISOString().slice(0, 10) });
    setStageModal(stage);
  };

  const openReturningVisit = () => {
    if (!selectedClient || !selectedClientRecord) return;
    const previousAppointments = normalizeAppointments(appointments)
      .filter((row) => String(row[0] ?? '').toLowerCase() === selectedClient.toLowerCase())
      .sort((a, b) => `${b[2] ?? ''} ${b[3] ?? ''}`.localeCompare(`${a[2] ?? ''} ${a[3] ?? ''}`));
    setAppointmentForm({
      mobile: clientMobile(selectedClientRecord),
      ...currentSlot(),
      type: previousAppointments[0]?.[4] || 'Consultation',
      status: 'Checked-in',
    });
    setStageModal('returning-visit');
  };

  const toggleClinicalPrintSection = (sectionId) => {
    setClinicalPrintSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  };

  const openClinicalPrint = () => {
    setClinicalPrintVisitIds(activeVisitId ? [activeVisitId] : journeyVisits.map((visit) => visit.id));
    setClinicalPrintOpen(true);
  };

  const pastJourneyVisits = journeyVisits
    .filter((visit) => visit.id !== activeVisitId && String(visit.visitDate || '') < String(journey.visitDate || ''))
    .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));

  const openPastJourneyPrint = () => {
    if (!pastJourneyVisits.length) return;
    setClinicalPrintVisitIds(pastJourneyVisits.map((visit) => visit.id));
    setClinicalPrintTitle(`${selectedClient} · Past Journey Summary`);
    setClinicalPrintSections(Object.fromEntries(PRINT_SECTION_OPTIONS.map(([id]) => [id, true])));
    setClinicalPrintOpen(true);
  };

  const toggleClinicalPrintVisit = (visitId) => {
    setClinicalPrintVisitIds((current) => current.includes(visitId)
      ? current.filter((id) => id !== visitId)
      : [...current, visitId]);
  };

  const applyClinicalPrintTemplate = (templateIndex) => {
    setSelectedClinicalPrintTemplate(templateIndex);
    if (templateIndex === '') return;
    const template = clinicalPrintTemplates[Number(templateIndex)];
    if (!template) return;
    setClinicalPrintTemplateName(template.name ?? '');
    setClinicalPrintTitle(template.title || 'Consultation & Treatment Summary');
    setClinicalPrintNote(template.note ?? '');
    setClinicalPrintSections(Object.fromEntries(
      PRINT_SECTION_OPTIONS.map(([id]) => [id, Boolean(template.sections?.[id])]),
    ));
  };

  const saveClinicalPrintTemplate = () => {
    const name = clinicalPrintTemplateName.trim();
    if (!name) return;
    const template = {
      name,
      title: clinicalPrintTitle.trim() || 'Consultation & Treatment Summary',
      note: clinicalPrintNote,
      sections: { ...clinicalPrintSections },
      updatedAt: new Date().toISOString(),
    };
    setClinicalPrintTemplates((current) => {
      const existingIndex = current.findIndex((item) => String(item.name ?? '').toLowerCase() === name.toLowerCase());
      if (existingIndex < 0) return [template, ...current];
      return current.map((item, index) => index === existingIndex ? template : item);
    });
    setSelectedClinicalPrintTemplate('');
  };

  const deleteClinicalPrintTemplate = () => {
    if (selectedClinicalPrintTemplate === '') return;
    const index = Number(selectedClinicalPrintTemplate);
    const template = clinicalPrintTemplates[index];
    if (!template || !window.confirm(`Delete "${template.name}" print template?`)) return;
    setClinicalPrintTemplates((current) => current.filter((_, templateIndex) => templateIndex !== index));
    setSelectedClinicalPrintTemplate('');
    setClinicalPrintTemplateName('');
  };

  const printClinicalSummary = () => {
    if (!selectedClient) return;
    const section = (title, content) => content ? `<section><h2>${escapePrintHtml(title)}</h2>${content}</section>` : '';
    const detail = (label, value) => value ? `<div class="detail"><span>${escapePrintHtml(label)}</span><strong>${escapePrintHtml(value)}</strong></div>` : '';
    const selectedVisits = [...journeyVisits]
      .filter((visit) => clinicalPrintVisitIds.includes(visit.id))
      .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
    const patientSection = [
      clinicalPrintSections.patient && section('Patient Details', `<div class="details">${detail('Patient Name', selectedClient)}${detail('Patient ID', clientId(selectedClientRecord))}${detail('Mobile', clientMobile(selectedClientRecord))}${detail('Printed On', new Date().toLocaleString('en-IN'))}</div>`),
    ].filter(Boolean).join('');
    const visitSections = selectedVisits.map((visit) => {
      const consultationData = visit.consultationData ?? {};
      const treatmentData = visit.treatmentData ?? {};
      const followupData = visit.followupData ?? {};
      const paymentData = visit.paymentData ?? {};
      const selectedMedicines = Array.isArray(treatmentData.medicines)
        ? treatmentData.medicines
        : String(treatmentData.medicine ?? '').split(',').map((medicine, index) => ({
          medicine: medicine.trim(),
          dose: String(treatmentData.dose ?? '').split(',')[index]?.trim() ?? '',
          timing: String(treatmentData.timing ?? '').split(',')[index]?.trim() ?? '',
        })).filter((item) => item.medicine);
      const visitTitle = `${formatResponseDate(visit.visitDate) || 'Undated visit'} · ${visit.appointmentData?.time || 'Time not recorded'} · ${visit.appointmentData?.type || 'Patient visit'}`;
      return `<div class="visit-summary"><h1>${escapePrintHtml(visitTitle)}</h1>${[
        clinicalPrintSections.symptoms && section('Symptoms / Chief Complaint', `<p>${escapePrintHtml(consultationData.complaint || 'Not recorded')}</p>`),
        clinicalPrintSections.vitals && section('Vitals', `<p>${escapePrintHtml(consultationData.vitals || 'Not recorded')}</p>`),
        clinicalPrintSections.diagnosis && section('Diagnosis', `<p>${escapePrintHtml(consultationData.diagnosis || 'Not recorded')}</p>`),
        clinicalPrintSections.doctorNotes && section('Doctor Notes', `<p>${escapePrintHtml(consultationData.notes || 'Not recorded').replaceAll('\n', '<br>')}</p>`),
        clinicalPrintSections.treatment && section('Treatment Plan', `<div class="details">${detail('Service', treatmentData.service)}${detail('Goal', treatmentData.goal)}${detail('Duration', treatmentData.duration)}${detail('Status', treatmentData.status)}</div>`),
        clinicalPrintSections.medicines && section('Medicines / Products', selectedMedicines.length ? `<table><thead><tr><th style="width:36px">No.</th><th>Medicine / Product</th><th>Dose</th><th>Timing</th></tr></thead><tbody>${selectedMedicines.map((item, index) => `<tr><td>${index + 1}</td><td>${escapePrintHtml(item.medicine)}</td><td>${escapePrintHtml(item.dose || '—')}</td><td>${escapePrintHtml(item.timing || '—')}</td></tr>`).join('')}</tbody></table>` : '<p>No medicines recorded.</p>'),
        clinicalPrintSections.followup && section('Next Follow-up', `<div class="details">${detail('Date', followupData.date)}${detail('Time', followupData.time)}${detail('Notes', followupData.notes)}${detail('Status', followupData.status)}</div>`),
        clinicalPrintSections.payment && section('Payment Details', `<div class="details">${detail('Invoice', paymentData.invoice)}${detail('Amount', paymentData.amount ? `₹ ${paymentData.amount}` : '')}${detail('Paid', paymentData.paidAmount ? `₹ ${paymentData.paidAmount}` : '')}${detail('Pending', paymentData.pendingAmount ? `₹ ${paymentData.pendingAmount}` : '')}${detail('Status', paymentData.status)}</div>`),
      ].filter(Boolean).join('')}</div>`;
    }).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapePrintHtml(selectedClient)} - Clinical Summary</title><style>*{box-sizing:border-box}body{margin:0;padding:28px 34px;color:#173b31;font-family:Arial,sans-serif;font-size:12px;line-height:1.5}.header{display:flex;justify-content:space-between;gap:20px;padding-bottom:14px;border-bottom:3px solid #0e5b52}.header h1{margin:0 0 4px;color:#0e5b52;font-size:22px}.header p{margin:0;color:#60776f}.clinic{text-align:right;font-weight:700}.visit-summary{margin-top:24px;padding-top:14px;border-top:2px solid #0e5b52;break-before:auto}.visit-summary>h1{margin:0;color:#0e5b52;font-size:17px}section{margin-top:17px;break-inside:avoid}h2{margin:0 0 8px;padding-bottom:5px;border-bottom:1px solid #d6e4df;color:#0e5b52;font-size:14px}p{margin:0;white-space:pre-wrap}.details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.detail{padding:8px;border:1px solid #dbe7e2;border-radius:6px}.detail span{display:block;margin-bottom:2px;color:#6a7f77;font-size:10px}.detail strong{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #d6e4df;text-align:left;vertical-align:top}th{background:#edf7f3}.custom-note{margin-top:18px;padding:10px;border:1px solid #d6e4df;border-radius:6px;white-space:pre-wrap}.footer{margin-top:28px;padding-top:10px;border-top:1px solid #d6e4df;color:#758a82;font-size:10px;display:flex;justify-content:space-between}@page{margin:14mm}@media print{body{padding:0}th{background:#edf7f3!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="header"><div><h1>${escapePrintHtml(clinicalPrintTitle || 'Clinical Summary')}</h1><p>${selectedVisits.length} selected patient journey${selectedVisits.length === 1 ? '' : 's'}</p></div><div class="clinic">Mom's Pathshala<br>Main Branch</div></div>${patientSection}${visitSections}${clinicalPrintNote.trim() ? `<div class="custom-note"><strong>Additional Instructions</strong><br>${escapePrintHtml(clinicalPrintNote).replaceAll('\n', '<br>')}</div>` : ''}<div class="footer"><span>Generated from Patient Journey</span><span>Doctor / Consultant Signature: __________________</span></div><script>window.addEventListener('load',function(){setTimeout(function(){window.print()},300)});<\/script></body></html>`);
    printWindow.document.close();
  };

  const saveAppointment = () => {
    if (!appointmentForm.date || !appointmentForm.time) return;
    const current = normalizeAppointments(loadValue(appointmentsKey, []));
    const row = [selectedClient, appointmentForm.mobile, appointmentForm.date, appointmentForm.time, appointmentForm.type, appointmentForm.status];
    window.localStorage.setItem(appointmentsKey, JSON.stringify([row, ...current]));
    if (stageModal === 'returning-visit') {
      const visitId = `visit-${appointmentForm.date}-${Date.now()}`;
      const now = new Date().toISOString();
      setJourneys((currentJourneys) => {
        const record = normalizeJourneyRecord(currentJourneys[selectedClient]);
        return {
          ...currentJourneys,
          [selectedClient]: {
            visits: [...record.visits, {
              id: visitId,
              visitDate: appointmentForm.date,
              createdAt: now,
              updatedAt: now,
              appointment: true,
              appointmentData: appointmentForm,
              appointmentAt: now,
            }],
            activeVisitId: visitId,
          },
        };
      });
      setSelectedVisitId(visitId);
    } else {
      updateJourney({ appointment: true, appointmentData: appointmentForm, visitDate: appointmentForm.date, appointmentAt: new Date().toISOString() });
    }
    setStageModal('');
  };

  const saveRequiredForm = () => {
    if (!hasRequiredFormResponse && !matchedFormResponses.length) return;
    updateJourney({ forms: true, requiredForm, formsCompletedAt: new Date().toISOString(), matchedResponses: matchedFormResponses.length });
    setStageModal('');
  };

  const saveTreatment = () => {
    if (!treatmentForm.goal.trim()) return;
    const current = loadValue(operationsKey, {});
    const medicines = treatmentMedicineRows.filter((row) => row.medicine.trim());
    const treatmentData = {
      ...treatmentForm,
      medicines,
      medicine: medicines.map((row) => row.medicine).join(', '),
      dose: medicines.map((row) => row.dose).join(', '),
      timing: medicines.map((row) => row.timing).join(', '),
    };
    const row = [selectedClient, treatmentForm.service, treatmentData.medicine, treatmentData.dose, treatmentData.timing, treatmentForm.goal, treatmentForm.duration, treatmentForm.status];
    window.localStorage.setItem(operationsKey, JSON.stringify({ ...current, treatments: [row, ...(current.treatments ?? [])] }));
    updateJourney({ treatment: true, treatmentData, treatmentAt: new Date().toISOString() });
    setStageModal('');
  };

  const savePayment = () => {
    if (!paymentForm.amount) return;
    const current = loadValue(paymentsKey, []);
    const row = normalizeJourneyPayment({ client: selectedClient, ...paymentForm });
    window.localStorage.setItem(paymentsKey, JSON.stringify([row, ...current]));
    updateJourney({ billing: true, paymentData: paymentForm, paidAt: new Date().toISOString() });
    setStageModal('');
  };

  const saveFollowup = () => {
    if (!followupForm.date || !followupForm.time) return;
    const current = normalizeAppointments(loadValue(appointmentsKey, []));
    const previous = journey.followupData;
    const withoutPreviousFollowup = current.filter((appointment) => !(
      String(appointment[0]).toLowerCase() === selectedClient.toLowerCase()
      && appointment[4] === 'Follow-up'
      && previous
      && appointment[2] === previous.date
      && appointment[3] === previous.time
    ));
    const row = [selectedClient, clientMobile(selectedClientRecord), followupForm.date, followupForm.time, 'Follow-up', followupForm.status];
    window.localStorage.setItem(appointmentsKey, JSON.stringify([row, ...withoutPreviousFollowup]));
    updateJourney({ followup: true, followupData: followupForm, followupAt: new Date().toISOString() });
    setStageModal('');
  };

  const runStage = (stage) => {
    if (stage === 'appointment' || stage === 'forms' || stage === 'consultation' || stage === 'treatment' || stage === 'billing' || stage === 'followup') openStageModal(stage);
  };

  return (
    <section className="module-page journey-page">
      <div className="module-hero compact-hero">
        <div><h1>Patient Journey</h1><p>Run the complete reception-to-payment workflow from one workspace.</p><p className="subtle">Shared cloud workspace</p></div>
        <div className="module-stats"><div className="mini-stat"><span>Registered Patients</span><strong>{clientRecords.length}</strong></div><div className="mini-stat"><span>Active Journeys</span><strong>{Object.keys(journeys).length}</strong></div><div className="mini-stat"><span>Selected Stage</span><strong>{selectedClient ? nextAction() : 'Select patient'}</strong></div></div>
      </div>

      <div className="journey-layout">
        <Card title="Reception Desk" subtitle="Search an existing patient or register a new walk-in." action={<button className="pill primary-action" type="button" onClick={() => navigate('/clients?action=add')}>+ Register Patient</button>}>
          <input className="lead-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient by ID, name, or mobile..." />
          <div className="returning-patient-action">
            <div>
              <strong>Returning patient?</strong>
              <span>Select an existing patient below, then start a new visit with saved profile data.</span>
            </div>
            <button className="pill" type="button" disabled={!selectedClient} onClick={openReturningVisit}>+ Start New Visit</button>
          </div>
          <div className="journey-client-list">
            {visibleClients.length ? visibleClients.map((row) => {
              const name = clientName(row);
              const id = clientId(row);
              const visitMeta = clientVisitMeta.get(normalizePersonName(name));
              return (
                <button className={`journey-client ${selectedClient === name ? 'active' : ''}`} type="button" key={id || name} onClick={() => setSelectedClient(name)}>
                  <strong>{id ? `${id} · ${name}` : name}</strong>
                  <span className="journey-client-meta">
                    <small>{journeys[name] ? 'Journey in progress' : 'Ready for check-in'}</small>
                    <time dateTime={visitMeta ? `${visitMeta.date}${visitMeta.time ? `T${visitMeta.time}` : ''}` : undefined}>{visitMeta ? formatJourneyDateTime(visitMeta.date, visitMeta.time) : 'No visit yet'}</time>
                  </span>
                </button>
              );
            }) : <div className="empty-state compact-empty"><strong>No patients found.</strong><p>Register the patient before booking an appointment.</p></div>}
          </div>
        </Card>

        <Card title={selectedClient ? `${selectedClient} Journey` : 'Journey Stages'} subtitle={selectedClient ? 'Complete each stage in order; earlier records remain linked.' : 'Select a patient to begin.'}>
          {selectedClient ? (
            <>
              {selectedWeightUpdates.length > 0 && (
                <div className="patient-weight-summary">
                  <div><span>Latest Weight</span><strong>{selectedWeightUpdates[0].value} {selectedWeightUpdates[0].unit || 'kg'}</strong><small>{formatResponseDate(selectedWeightUpdates[0].recordedAt)} · {selectedWeightUpdates[0].formTitle || 'Submitted form'}</small></div>
                  <div className="patient-weight-history" aria-label={`${selectedClient} weight history`}>
                    {selectedWeightUpdates.slice(0, 6).map((update) => <span key={update.id}><strong>{update.value} {update.unit || 'kg'}</strong><small>{formatResponseDate(update.recordedAt)}</small></span>)}
                  </div>
                </div>
              )}
              <div className="journey-visit-history">
                <div><strong>Date-wise Journeys</strong><span>{journeyVisits.length ? `${journeyVisits.length} visit journey${journeyVisits.length === 1 ? '' : 's'} saved` : 'No visit journey created yet'}</span></div>
                <div className="journey-visit-tabs" role="tablist" aria-label={`${selectedClient} visit journeys`}>
                  {[...journeyVisits].sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate))).map((visit, index) => (
                    <button className={`journey-visit-tab ${activeVisitId === visit.id ? 'active' : ''}`} type="button" role="tab" aria-selected={activeVisitId === visit.id} key={visit.id} onClick={() => setSelectedVisitId(visit.id)}>
                      <strong>{formatResponseDate(visit.visitDate)}</strong>
                      <span>{visit.appointmentData?.type || (index === 0 ? 'Latest visit' : 'Patient visit')}</span>
                    </button>
                  ))}
                </div>
                <div className="journey-history-pdf-action">
                  <div><strong>Past clinical history</strong><span>{pastJourneyVisits.length ? `${pastJourneyVisits.length} earlier visit${pastJourneyVisits.length === 1 ? '' : 's'} before ${formatResponseDate(journey.visitDate)}` : 'No earlier visit is available before this date.'}</span></div>
                  <button className="pill" type="button" disabled={!pastJourneyVisits.length} onClick={openPastJourneyPrint}>View Past Journey PDF</button>
                </div>
              </div>
              <div className="pregnancy-history-panel">
                <div className="pregnancy-history-head">
                  <div>
                    <strong>Pregnancy / Garbhsanskar History</strong>
                    <span>{pregnancyHistoryEntries.length ? `${pregnancyHistoryEntries.length} history ${pregnancyHistoryEntries.length === 1 ? 'entry' : 'entries'} saved` : 'Record what the gynec advised during each visit.'}</span>
                  </div>
                  <button className="pill" type="button" onClick={openPregnancyHistory}>+ Add History</button>
                </div>
                {pregnancyHistoryEntries.length ? (
                  <div className="pregnancy-history-timeline">
                    {pregnancyHistoryEntries.map((entry) => (
                      <article className="pregnancy-history-entry" key={entry.id}>
                        <div className="pregnancy-history-date">
                          <strong>{formatResponseDate(entry.date || entry.visitDate)}</strong>
                          <span>{entry.pregnancyStage || 'Pregnancy stage not added'}</span>
                        </div>
                        <div className="pregnancy-history-content">
                          {entry.gynecName && <p><b>Gynec:</b> {entry.gynecName}</p>}
                          {entry.gynecAdvice && <p><b>Gynec Advice:</b> {entry.gynecAdvice}</p>}
                          {entry.tests && <p><b>Reports / Tests:</b> {entry.tests}</p>}
                          {entry.medicines && <p><b>Medicines / Supplements:</b> {entry.medicines}</p>}
                          {entry.garbhsanskarAdvice && <p><b>Garbhsanskar Plan:</b> {entry.garbhsanskarAdvice}</p>}
                          {entry.nextFollowup && <p><b>Next Follow-up:</b> {formatResponseDate(entry.nextFollowup)}</p>}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <div className="pregnancy-history-empty">No pregnancy history added yet.</div>}
              </div>
              <div className="journey-stages">
                {STAGES.map(([id, label], index) => {
                  const complete = stageDone(id);
                  return <div className={`journey-stage ${complete ? 'complete' : ''}`} key={id}><span className="journey-index">{complete ? '✓' : index + 1}</span><div><strong>{label}</strong><small>{stageDetail(id, complete)}</small></div>{id !== 'registration' && <button className="pill" type="button" onClick={() => runStage(id)}>{complete ? 'Open' : id === 'consultation' ? 'Consult' : id === 'followup' ? 'Schedule' : 'Start'}</button>}</div>;
                })}
              </div>
              <div className="journey-print-actions">
                <div><strong>Patient handout</strong><span>Select consultation and treatment details for a customized print.</span></div>
                <button className="pill" type="button" onClick={openClinicalPrint}>Customize Patient Print</button>
              </div>
              {nextAction() !== 'completed' ? <button className="pill primary-action journey-next" type="button" onClick={() => runStage(nextAction())}>Continue to {STAGES.find(([id]) => id === nextAction())?.[1]}</button> : <div className="action-note"><strong>Journey completed.</strong> All required stages are recorded.</div>}
            </>
          ) : <div className="empty-state"><strong>No patient selected.</strong><p>Choose a patient from Reception Desk to see their workflow.</p></div>}
        </Card>
      </div>

      {clinicalPrintOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setClinicalPrintOpen(false)}>
          <div className="modal-shell clinical-print-modal" role="dialog" aria-modal="true" aria-label="Customize patient print" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><h2>Customize Patient Print</h2><p>{selectedClient} · Select only the sections you want to print.</p></div>
              <button className="icon-btn" type="button" onClick={() => setClinicalPrintOpen(false)} aria-label="Close print customization">x</button>
            </div>
            <div className="clinical-print-layout">
              <div className="clinical-print-controls">
                <div className="clinical-print-template-tools">
                  <label className="field-block"><span>Use Template</span><select className="lead-input" value={selectedClinicalPrintTemplate} onChange={(event) => applyClinicalPrintTemplate(event.target.value)}><option value="">{clinicalPrintTemplates.length ? 'Select saved print template...' : 'No print templates saved yet'}</option>{clinicalPrintTemplates.map((template, index) => <option key={`${template.name}-${index}`} value={index}>{template.name}</option>)}</select></label>
                  <label className="field-block"><span>Template Name</span><input className="lead-input" value={clinicalPrintTemplateName} onChange={(event) => setClinicalPrintTemplateName(event.target.value)} placeholder="e.g. Standard Consultation" /></label>
                  <div className="clinical-print-template-actions">
                    <button className="pill" type="button" disabled={!clinicalPrintTemplateName.trim()} onClick={saveClinicalPrintTemplate}>Save Template</button>
                    <button className="pill danger" type="button" disabled={selectedClinicalPrintTemplate === ''} onClick={deleteClinicalPrintTemplate}>Delete</button>
                  </div>
                </div>
                <label className="field-block"><span>Print Title</span><input className="lead-input" value={clinicalPrintTitle} onChange={(event) => setClinicalPrintTitle(event.target.value)} /></label>
                <div className="clinical-print-select-all">
                  <strong>Journey dates</strong>
                  <div><button className="pill" type="button" onClick={() => setClinicalPrintVisitIds(journeyVisits.map((visit) => visit.id))}>All journeys</button><button className="pill" type="button" onClick={() => setClinicalPrintVisitIds([])}>Clear</button></div>
                </div>
                <div className="clinical-print-visits">
                  {[...journeyVisits].sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate))).map((visit) => (
                    <label className={`clinical-print-option ${clinicalPrintVisitIds.includes(visit.id) ? 'selected' : ''}`} key={visit.id}>
                      <input type="checkbox" checked={clinicalPrintVisitIds.includes(visit.id)} onChange={() => toggleClinicalPrintVisit(visit.id)} />
                      <span><strong>{formatResponseDate(visit.visitDate)}</strong><small>{visit.appointmentData?.time || 'Time not recorded'} · {visit.appointmentData?.type || 'Patient visit'}</small></span>
                    </label>
                  ))}
                </div>
                <div className="clinical-print-select-all">
                  <strong>Include in print</strong>
                  <div><button className="pill" type="button" onClick={() => setClinicalPrintSections(Object.fromEntries(PRINT_SECTION_OPTIONS.map(([id]) => [id, true])))}>Select all</button><button className="pill" type="button" onClick={() => setClinicalPrintSections(Object.fromEntries(PRINT_SECTION_OPTIONS.map(([id]) => [id, false])))}>Clear all</button></div>
                </div>
                <div className="clinical-print-options">
                  {PRINT_SECTION_OPTIONS.map(([id, label]) => (
                    <label className={`clinical-print-option ${clinicalPrintSections[id] ? 'selected' : ''}`} key={id}>
                      <input type="checkbox" checked={clinicalPrintSections[id]} onChange={() => toggleClinicalPrintSection(id)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <label className="field-block"><span>Additional Instructions</span><textarea className="lead-input" rows="4" value={clinicalPrintNote} onChange={(event) => setClinicalPrintNote(event.target.value)} placeholder="Optional custom instruction for this patient..." /></label>
              </div>
              <div className="clinical-print-preview" aria-live="polite">
                <div className="clinical-preview-header"><div><strong>{clinicalPrintTitle || 'Clinical Summary'}</strong><span>Mom&apos;s Pathshala</span></div><small>Print preview</small></div>
                <div className="clinical-preview-section"><strong>Selected Journey Dates</strong><p>{journeyVisits.filter((visit) => clinicalPrintVisitIds.includes(visit.id)).sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate))).map((visit) => `${formatResponseDate(visit.visitDate)} · ${visit.appointmentData?.time || 'Time not recorded'} · ${visit.appointmentData?.type || 'Patient visit'}`).join('\n') || 'Select at least one journey date.'}</p></div>
                {clinicalPrintSections.patient && <div className="clinical-preview-section"><strong>Patient Details</strong><p>{clientId(selectedClientRecord) || 'No ID'} · {selectedClient}<br />{clientMobile(selectedClientRecord) || 'Mobile not saved'}</p></div>}
                {clinicalPrintSections.symptoms && <div className="clinical-preview-section"><strong>Symptoms / Chief Complaint</strong><p>{journey.consultationData?.complaint || 'Not recorded'}</p></div>}
                {clinicalPrintSections.vitals && <div className="clinical-preview-section"><strong>Vitals</strong><p>{journey.consultationData?.vitals || 'Not recorded'}</p></div>}
                {clinicalPrintSections.diagnosis && <div className="clinical-preview-section"><strong>Diagnosis</strong><p>{journey.consultationData?.diagnosis || 'Not recorded'}</p></div>}
                {clinicalPrintSections.doctorNotes && <div className="clinical-preview-section"><strong>Doctor Notes</strong><p>{journey.consultationData?.notes || 'Not recorded'}</p></div>}
                {clinicalPrintSections.treatment && <div className="clinical-preview-section"><strong>Treatment Plan</strong><p>{[journey.treatmentData?.service, journey.treatmentData?.goal, journey.treatmentData?.duration].filter(Boolean).join(' · ') || 'Not recorded'}</p></div>}
                {clinicalPrintSections.medicines && <div className="clinical-preview-section"><strong>Medicines, Dose & Timing</strong>{clinicalPreviewMedicines.length ? <div className="clinical-preview-medicine-list" role="table" aria-label="Selected medicines">{clinicalPreviewMedicines.map((item, index) => <div className="clinical-preview-medicine-row" role="row" key={`${item.medicine}-${index}`}><b aria-label={`Medicine ${index + 1}`}>{index + 1}</b><span role="cell"><strong>{item.medicine}</strong><small>{item.dose || 'Dose not recorded'} · {item.timing || 'Timing not recorded'}</small></span></div>)}</div> : <p>No medicines recorded</p>}</div>}
                {clinicalPrintSections.followup && <div className="clinical-preview-section"><strong>Next Follow-up</strong><p>{journey.followupData?.date ? `${journey.followupData.date} · ${journey.followupData.time || 'Time pending'}` : 'Not scheduled'}</p></div>}
                {clinicalPrintSections.payment && <div className="clinical-preview-section"><strong>Payment Details</strong><p>{journey.paymentData?.amount ? `₹ ${journey.paymentData.amount} · ${journey.paymentData.status || ''}` : 'Not recorded'}</p></div>}
                {clinicalPrintNote.trim() && <div className="clinical-preview-section"><strong>Additional Instructions</strong><p>{clinicalPrintNote}</p></div>}
                {!Object.values(clinicalPrintSections).some(Boolean) && !clinicalPrintNote.trim() && <div className="empty-state compact-empty"><strong>No sections selected.</strong><p>Select at least one item to create a useful patient print.</p></div>}
              </div>
            </div>
            <div className="modal-actions">
              <button className="pill" type="button" onClick={() => setClinicalPrintOpen(false)}>Cancel</button>
              <button className="pill primary-action" type="button" disabled={!clinicalPrintVisitIds.length || (!Object.values(clinicalPrintSections).some(Boolean) && !clinicalPrintNote.trim())} onClick={printClinicalSummary}>Print / Save PDF</button>
            </div>
          </div>
        </div>
      )}

      {stageModal === 'appointment' && <JourneyModal title="Add Appointment" client={selectedClient} onClose={() => setStageModal('')} onSave={saveAppointment} saveLabel="Save Appointment"><div className="quick-preset-row"><button className="pill" type="button" onClick={() => setAppointmentPreset('now')}>Walk-in now</button><button className="pill" type="button" onClick={() => setAppointmentPreset('today')}>Today</button><button className="pill" type="button" onClick={() => setAppointmentPreset('tomorrow')}>Tomorrow</button><button className="pill" type="button" onClick={() => setAppointmentPreset('week')}>After 7 days</button><button className="pill" type="button" onClick={() => setAppointmentPreset('month')}>After 30 days</button></div><label className="field-block"><span>Mobile</span><input className="lead-input" type="tel" value={appointmentForm.mobile} onChange={(event) => setAppointmentForm((value) => ({ ...value, mobile: event.target.value }))} /></label><label className="field-block"><span>Date</span><input className="lead-input" type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm((value) => ({ ...value, date: event.target.value }))} /></label><label className="field-block"><span>Time</span><input className="lead-input" type="time" value={appointmentForm.time} onChange={(event) => setAppointmentForm((value) => ({ ...value, time: event.target.value }))} /></label><label className="field-block"><span>Type</span><select className="lead-input" value={appointmentForm.type} onChange={(event) => setAppointmentForm((value) => ({ ...value, type: event.target.value }))}>{SERVICE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-block"><span>Status</span><select className="lead-input" value={appointmentForm.status} onChange={(event) => setAppointmentForm((value) => ({ ...value, status: event.target.value }))}><option>Pending</option><option>Confirmed</option><option>Checked-in</option><option>Cancelled</option></select></label></JourneyModal>}

      {stageModal === 'returning-visit' && <JourneyModal title="New Visit for Existing Patient" client={selectedClient} onClose={() => setStageModal('')} onSave={saveAppointment} saveLabel="Add Visit & Check In"><div className="returning-patient-summary full-field"><span><strong>{clientId(selectedClientRecord) || 'Saved patient'}</strong> Patient ID</span><span><strong>{clientMobile(selectedClientRecord) || 'Not saved'}</strong> Mobile</span><span><strong>Auto-filled</strong> Saved profile linked</span></div><div className="action-note full-field"><strong>Existing patient selected.</strong> This creates a new visit while keeping all previous journey, treatment, form, and payment records linked.</div><label className="field-block"><span>Mobile</span><input className="lead-input" type="tel" value={appointmentForm.mobile} onChange={(event) => setAppointmentForm((value) => ({ ...value, mobile: event.target.value }))} /></label><label className="field-block"><span>Visit Date</span><input className="lead-input" type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm((value) => ({ ...value, date: event.target.value }))} /></label><label className="field-block"><span>Visit Time</span><input className="lead-input" type="time" value={appointmentForm.time} onChange={(event) => setAppointmentForm((value) => ({ ...value, time: event.target.value }))} /></label><label className="field-block"><span>Service</span><select className="lead-input" value={appointmentForm.type} onChange={(event) => setAppointmentForm((value) => ({ ...value, type: event.target.value }))}>{SERVICE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-block"><span>Status</span><select className="lead-input" value={appointmentForm.status} onChange={(event) => setAppointmentForm((value) => ({ ...value, status: event.target.value }))}><option>Checked-in</option><option>Confirmed</option><option>Pending</option></select></label></JourneyModal>}

      {stageModal === 'forms' && <JourneyModal title="Required Form" client={selectedClient} onClose={() => setStageModal('')} onSave={saveRequiredForm} saveLabel={matchedFormResponses.length ? 'Mark Form Received' : 'Waiting for Submission'} saveDisabled={!matchedFormResponses.length}><label className="field-block"><span>Form</span><select className="lead-input" value={requiredForm} onChange={(event) => setRequiredForm(event.target.value)}>{formOptions.length ? formOptions.map((form) => <option key={form.id || form.slug || formTitle(form)} value={formTitle(form)}>{formTitle(form)}</option>) : <option value="">No forms created yet</option>}</select></label><div className="action-note"><strong>{matchedFormResponses.length ? `${matchedFormResponses.length} response(s) found` : 'Submission not found'}</strong>{matchedFormResponses.length ? ' Mobile number matched with submitted form responses below.' : ' Ask the patient to submit any created form using the same mobile number saved in the patient profile.'}</div><div className="matched-response-list full-field">{matchedFormResponses.length ? matchedFormResponses.map(({ response, form }) => <div className="matched-response-card" key={response.id}><div><strong>{response.formTitle || formTitle(form) || 'Submitted Form'}</strong><span>{formatResponseDate(response.submittedAt)}</span></div>{responsePreview(response, form).map(([label, value]) => <p key={`${response.id}-${label}`}><b>{label}:</b> {value}</p>)}</div>) : <div className="empty-state compact-empty"><strong>No matched response yet.</strong><p>Patient mobile: {selectedClientPhone || 'not saved'}</p></div>}</div></JourneyModal>}

      {stageModal === 'treatment' && <JourneyModal title="Add Treatment Plan" client={selectedClient} onClose={() => setStageModal('')} onSave={saveTreatment} saveLabel="Save Treatment"><div className="quick-preset-row">{QUICK_TREATMENTS.map((preset) => <button className="pill" type="button" key={preset.label} onClick={() => applyQuickTreatment(preset)}>{preset.label}</button>)}</div>{treatmentTemplates.length > 0 && <label className="field-block full-field"><span>Use Template</span><select className="lead-input" defaultValue="" onChange={(event) => applyTreatmentTemplate(event.target.value)}><option value="">Select saved template...</option>{treatmentTemplates.map((template, index) => <option key={`${template.name}-${index}`} value={index}>{template.name}</option>)}</select></label>}<label className="field-block"><span>Service</span><select className="lead-input" value={treatmentForm.service} onChange={(event) => setTreatmentForm((value) => ({ ...value, service: event.target.value }))}>{SERVICE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-block"><span>Goal</span><input className="lead-input" list="goal-presets" value={treatmentForm.goal} onChange={(event) => setTreatmentForm((value) => ({ ...value, goal: event.target.value }))} placeholder="Treatment goal" /><datalist id="goal-presets">{QUICK_TREATMENTS.map((preset) => <option key={preset.goal} value={preset.goal} />)}</datalist></label><label className="field-block"><span>Duration</span><select className="lead-input" value={treatmentForm.duration} onChange={(event) => setTreatmentForm((value) => ({ ...value, duration: event.target.value }))}>{DURATION_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><div className="treatment-medicine-builder"><div className="medicine-builder-head"><div><strong>Medicines / Products</strong><span>Search the medicine master or add a missing medicine without leaving this treatment.</span></div><button className="pill" type="button" onClick={() => syncTreatmentMedicineRows([...treatmentMedicineRows, { medicine: '', dose: '', timing: '' }])}>+ Add Medicine</button></div>{treatmentMedicineRows.map((row, index) => <div className="treatment-medicine-row" key={index}><MedicineSearchInput index={index} value={row.medicine} catalog={medicineCatalog} onChange={(value) => updateTreatmentMedicine(index, 'medicine', value)} onSelect={(medicine) => selectTreatmentMedicine(index, medicine)} onAdd={() => addTreatmentMedicineToCatalog(index)} /><label className="field-block"><span>Dose</span><input className="lead-input" value={row.dose} onChange={(event) => updateTreatmentMedicine(index, 'dose', event.target.value)} placeholder="Dose" /></label><label className="field-block"><span>Timing</span><input className="lead-input" value={row.timing} onChange={(event) => updateTreatmentMedicine(index, 'timing', event.target.value)} placeholder="After meals" /></label><button className="icon-btn" type="button" onClick={() => removeTreatmentMedicine(index)} aria-label={`Remove medicine ${index + 1}`}>x</button></div>)}</div></JourneyModal>}

      {stageModal === 'billing' && <JourneyModal title="Add Payment" client={selectedClient} onClose={() => setStageModal('')} onSave={savePayment} saveLabel="Save Payment"><div className="quick-preset-row">{PAYMENT_AMOUNTS.map((amount) => <button className="pill" type="button" key={amount} onClick={() => setPaymentForm((value) => ({ ...value, amount, paidAmount: value.status === 'Paid' ? amount : value.paidAmount, pendingAmount: calculatePaymentPending(amount, value.status === 'Paid' ? amount : value.paidAmount, value.status) }))}>Rs {amount}</button>)}</div><label className="field-block"><span>Invoice</span><input className="lead-input" value={paymentForm.invoice} readOnly /></label><label className="field-block"><span>Total Amount</span><input className="lead-input" type="number" min="0" value={paymentForm.amount} onChange={(event) => setPaymentForm((value) => ({ ...value, amount: event.target.value, paidAmount: value.status === 'Paid' ? event.target.value : value.paidAmount, pendingAmount: calculatePaymentPending(event.target.value, value.status === 'Paid' ? event.target.value : value.paidAmount, value.status) }))} placeholder="0" /></label><label className="field-block"><span>Paid Amount</span><input className="lead-input" type="number" min="0" value={paymentForm.paidAmount} onChange={(event) => setPaymentForm((value) => ({ ...value, paidAmount: event.target.value, pendingAmount: calculatePaymentPending(value.amount, event.target.value, value.status) }))} placeholder="0" /></label><label className="field-block"><span>Pending Amount</span><input className="lead-input" type="number" min="0" value={paymentForm.pendingAmount} readOnly placeholder="Auto calculated" /></label><label className="field-block"><span>Status</span><select className="lead-input" value={paymentForm.status} onChange={(event) => setPaymentForm((value) => { const paidAmount = event.target.value === 'Paid' ? value.amount : event.target.value === 'Pending' ? '' : value.paidAmount; return { ...value, status: event.target.value, paidAmount, pendingAmount: calculatePaymentPending(value.amount, paidAmount, event.target.value) }; })}><option>Paid</option><option>Partial</option><option>Pending</option></select></label><label className="field-block"><span>Paid On</span><input className="lead-input" type="date" value={paymentForm.paidOn} onChange={(event) => setPaymentForm((value) => ({ ...value, paidOn: event.target.value }))} /></label></JourneyModal>}

      {stageModal === 'followup' && <JourneyModal title="Schedule Next Follow-up" client={selectedClient} onClose={() => setStageModal('')} onSave={saveFollowup} saveLabel="Save Follow-up"><div className="quick-preset-row"><button className="pill" type="button" onClick={() => setFollowupForm((value) => ({ ...value, date: addDays(7) }))}>After 7 days</button><button className="pill" type="button" onClick={() => setFollowupForm((value) => ({ ...value, date: addDays(15) }))}>After 15 days</button><button className="pill" type="button" onClick={() => setFollowupForm((value) => ({ ...value, date: addDays(30) }))}>After 30 days</button></div><label className="field-block"><span>Follow-up Date</span><input className="lead-input" type="date" value={followupForm.date} onChange={(event) => setFollowupForm((value) => ({ ...value, date: event.target.value }))} /></label><label className="field-block"><span>Follow-up Time</span><input className="lead-input" type="time" value={followupForm.time} onChange={(event) => setFollowupForm((value) => ({ ...value, time: event.target.value }))} /></label><label className="field-block full-field"><span>Follow-up Notes</span><textarea className="lead-input" rows="3" value={followupForm.notes} onChange={(event) => setFollowupForm((value) => ({ ...value, notes: event.target.value }))} placeholder="Reason, instructions, or reminder note..." /></label><label className="field-block"><span>Status</span><select className="lead-input" value={followupForm.status} onChange={(event) => setFollowupForm((value) => ({ ...value, status: event.target.value }))}><option>Confirmed</option><option>Pending</option></select></label></JourneyModal>}

      {pregnancyHistoryOpen && <JourneyModal title="Add Pregnancy / Garbhsanskar History" client={selectedClient} onClose={() => setPregnancyHistoryOpen(false)} onSave={savePregnancyHistory} saveLabel="Save History" saveDisabled={!pregnancyHistoryForm.gynecAdvice.trim() && !pregnancyHistoryForm.garbhsanskarAdvice.trim()}><div className="action-note full-field"><strong>Visit-wise clinical note.</strong> This entry will remain linked to the selected journey date and will also appear in the patient's complete pregnancy history.</div><label className="field-block"><span>Note Date</span><input className="lead-input" type="date" value={pregnancyHistoryForm.date} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, date: event.target.value }))} /></label><label className="field-block"><span>Pregnancy Week / Month</span><input className="lead-input" value={pregnancyHistoryForm.pregnancyStage} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, pregnancyStage: event.target.value }))} placeholder="e.g. Week 18 or 5th month" /></label><label className="field-block full-field"><span>Gynec Doctor Name</span><input className="lead-input" value={pregnancyHistoryForm.gynecName} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, gynecName: event.target.value }))} placeholder="e.g. Dr. Shah" /></label><label className="field-block full-field"><span>What did the gynec advise? *</span><textarea className="lead-input" rows="4" value={pregnancyHistoryForm.gynecAdvice} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, gynecAdvice: event.target.value }))} placeholder="Growth, precautions, diet, activity, or other advice shared by the gynec..." /></label><label className="field-block"><span>Reports / Tests Advised</span><textarea className="lead-input" rows="3" value={pregnancyHistoryForm.tests} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, tests: event.target.value }))} placeholder="e.g. Anomaly scan in week 20" /></label><label className="field-block"><span>Medicines / Supplements</span><textarea className="lead-input" rows="3" value={pregnancyHistoryForm.medicines} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, medicines: event.target.value }))} placeholder="e.g. Continue iron and calcium" /></label><label className="field-block full-field"><span>Garbhsanskar Plan / Instructions *</span><textarea className="lead-input" rows="4" value={pregnancyHistoryForm.garbhsanskarAdvice} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, garbhsanskarAdvice: event.target.value }))} placeholder="Meditation, breathing exercise, prenatal yoga, diet, music, or daily routine..." /></label><label className="field-block"><span>Next Follow-up</span><input className="lead-input" type="date" value={pregnancyHistoryForm.nextFollowup} onChange={(event) => setPregnancyHistoryForm((value) => ({ ...value, nextFollowup: event.target.value }))} /></label></JourneyModal>}

      {consultationOpen && <div className="modal-backdrop" role="presentation" onClick={() => setConsultationOpen(false)}><div className="modal-shell consultation-modal" role="dialog" aria-modal="true" aria-label="Doctor Consultation" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><h2>Doctor Consultation</h2><p>{selectedClient}</p></div><button className="icon-btn" type="button" onClick={() => setConsultationOpen(false)} aria-label="Close modal">x</button></div><div className="modal-body detail-grid"><div className="quick-preset-row">{QUICK_CONSULTATIONS.map((preset) => <button className="pill" type="button" key={preset.label} onClick={() => applyQuickConsultation(preset)}>{preset.label}</button>)}</div><div className="consultation-template-tools"><label className="field-block"><span>Use Template</span><select className="lead-input" value={selectedConsultationTemplate} onChange={(event) => applyConsultationTemplate(event.target.value)}><option value="">{consultationTemplates.length ? 'Select consultation template...' : 'No templates saved yet'}</option>{consultationTemplates.map((template, index) => <option key={`${template.name}-${index}`} value={index}>{template.name}</option>)}</select></label><label className="field-block"><span>Template Name</span><input className="lead-input" value={consultationTemplateName} onChange={(event) => setConsultationTemplateName(event.target.value)} placeholder="e.g. Diabetes Follow-up" /></label><button className="pill" type="button" disabled={!consultationTemplateName.trim()} onClick={saveConsultationTemplate}>Save Template</button></div><div className="symptom-builder"><SearchablePresetInput label="Symptoms / Chief Complaint" value={symptomChoice} options={[...SYMPTOM_OPTIONS, ...customSymptoms]} onChange={setSymptomChoice} onSelect={(symptom) => { setSymptomChoice(symptom); const current = consultation.complaint.split(',').map((item) => item.trim()).filter(Boolean); if (!current.some((item) => item.toLowerCase() === symptom.toLowerCase())) current.push(symptom); setConsultation((value) => ({ ...value, complaint: current.join(', ') })); setSymptomChoice(''); }} onCommit={addSymptom} placeholder="Search or type a new symptom..." helperText="Ready listમાં ન હોય તો નવું symptom લખીને Add New અથવા Enter દબાવો." action={<button className="pill symptom-add-button" type="button" onClick={addSymptom} disabled={!symptomChoice.trim()}>+ Add New</button>} /><div className="consultation-chips">{consultation.complaint.split(',').map((item) => item.trim()).filter(Boolean).map((symptom) => <button className="tag symptom-chip" type="button" key={symptom} onClick={() => removeSymptom(symptom)}>{symptom} x</button>)}</div></div><SearchablePresetInput label="Vitals" value={consultation.vitals} options={VITAL_OPTIONS} onChange={(value) => setConsultation((current) => ({ ...current, vitals: value }))} placeholder="Search or enter measured vitals" /><SearchablePresetInput label="Diagnosis" value={consultation.diagnosis} options={DIAGNOSIS_OPTIONS} onChange={(value) => setConsultation((current) => ({ ...current, diagnosis: value }))} placeholder="Type 1–2 keywords, e.g. diabetes" /><div className="doctor-note-builder"><SearchablePresetInput label="Doctor Notes" value={doctorNoteChoice} options={[...NOTE_OPTIONS, ...customDoctorNotes]} onChange={setDoctorNoteChoice} onSelect={addDoctorNote} onCommit={addDoctorNote} placeholder="Search or type a new doctor note..." helperText="Multiple notes select કરો અથવા નવી note લખીને Add New/Enter દબાવો." action={<button className="pill symptom-add-button" type="button" onClick={() => addDoctorNote()} disabled={!doctorNoteChoice.trim()}>+ Add New</button>} /><div className="consultation-chips">{consultation.notes.split('\n').map((item) => item.trim()).filter(Boolean).map((note) => <button className="tag symptom-chip" type="button" key={note} onClick={() => removeDoctorNote(note)}>{note} x</button>)}</div></div></div><div className="modal-actions"><button className="pill" type="button" onClick={() => setConsultationOpen(false)}>Cancel</button><button className="pill primary-action" type="button" onClick={saveConsultation}>Complete Consultation</button></div></div></div>}
    </section>
  );
}

function JourneyModal({ title, client, children, onClose, onSave, saveLabel, saveDisabled = false }) {
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><div className="modal-shell modal-small" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><h2>{title}</h2><p>For patient: {client}</p></div><button className="icon-btn" type="button" onClick={onClose} aria-label="Close modal">x</button></div><div className="modal-body detail-grid">{children}</div><div className="modal-actions"><button className="pill" type="button" onClick={onClose}>Cancel</button><button className="pill primary-action" type="button" onClick={onSave} disabled={saveDisabled}>{saveLabel}</button></div></div></div>;
}

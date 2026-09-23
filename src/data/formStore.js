import { mergeFormsById } from './formSync.js';

const FORMS_KEY = 'moms-pathshala:forms:v2';
const LEGACY_FORMS_KEY = 'ayurflow:forms:v1';
const RESPONSES_KEY = 'moms-pathshala:form-responses:v2';
const PATIENTS_KEY = 'moms-pathshala:Main Branch:ayurflow-clients:rows:v3';
const LEGACY_PATIENTS_KEY = 'ayurflow:ayurflow-clients:rows:v3';
const PATIENT_UPDATES_KEY = 'moms-pathshala:Main Branch:patient-form-updates:v1';

const apiBase = String(import.meta.env.VITE_FORMS_API_URL ?? '/api').trim().replace(/\/$/, '');

function readJson(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '').slice(-10);
}

function normalizeName(value) {
  return String(value ?? '').trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function fieldMatches(field, pattern) {
  return pattern.test(String(field?.label ?? '').trim());
}

function patientName(row) {
  if (Array.isArray(row)) return row.length >= 7 ? row[1] ?? '' : row[0] ?? '';
  return row?.name ?? row?.Client ?? row?.client ?? '';
}

function patientMobile(row) {
  if (Array.isArray(row)) return row.length >= 7 ? row[2] ?? '' : row[1] ?? '';
  return row?.mobile ?? row?.Mobile ?? row?.phone ?? row?.Phone ?? '';
}

function patientId(row) {
  if (Array.isArray(row)) return row.length >= 7 ? row[0] ?? '' : '';
  return row?.clientId ?? row?.['Client ID'] ?? row?.ClientId ?? row?.ID ?? row?.id ?? '';
}

function applyPatientDataMappings(form, response) {
  const fields = Array.isArray(form?.fields) ? form.fields : [];
  const mobileField = fields.find((field) => field.dataTarget === 'patient_mobile')
    ?? fields.find((field) => field.type === 'phone' || fieldMatches(field, /mobile|phone|contact|મોબાઇલ|ફોન|मोबाइल|फोन/i));
  const nameField = fields.find((field) => field.dataTarget === 'patient_name')
    ?? fields.find((field) => fieldMatches(field, /patient\s*name|client\s*name|full\s*name|^name\b|નામ|नाम/i));
  const mobile = normalizePhone(response.answers?.[mobileField?.id]);
  const submittedName = String(response.answers?.[nameField?.id] ?? '').trim();
  if (!mobile && !submittedName) return { status: 'skipped', reason: 'Patient mobile or name is missing.' };

  const patients = readJson(PATIENTS_KEY, readJson(LEGACY_PATIENTS_KEY, []));
  const patientRows = Array.isArray(patients) ? patients : [];
  const mobileMatches = mobile ? patientRows.filter((row) => normalizePhone(patientMobile(row)) === mobile) : [];
  const normalizedSubmittedName = normalizeName(submittedName);
  const nameMatches = normalizedSubmittedName
    ? patientRows.filter((row) => normalizeName(patientName(row)) === normalizedSubmittedName)
    : [];
  const patient = mobileMatches.length === 1
    ? mobileMatches[0]
    : mobileMatches.length > 1
      ? mobileMatches.find((row) => normalizeName(patientName(row)) === normalizedSubmittedName)
      : !mobile && nameMatches.length === 1 ? nameMatches[0] : null;
  if (!patient && mobileMatches.length > 1) return { status: 'unmatched', mobile, patientName: submittedName, reason: 'Multiple patients share this mobile number. Enter the patient name.' };
  if (!patient) return { status: 'unmatched', mobile, patientName: submittedName };

  const mappedFields = fields.flatMap((field) => {
    if (field.dataTarget === 'patient_weight' || (field.type === 'number' && fieldMatches(field, /weight|વજન|वजन/i))) return [{ field, type: 'weight', unit: 'kg' }];
    if (field.dataTarget === 'patient_waist' || (field.type === 'number' && fieldMatches(field, /waist|tummy|abdomen|inch|કમર|પેટ|कमर|पेट/i))) return [{ field, type: 'waist', unit: 'inch' }];
    return [];
  });
  const current = readJson(PATIENT_UPDATES_KEY, []);
  const updates = mappedFields.flatMap(({ field, type, unit }) => {
    const numericValue = Number(String(response.answers?.[field.id] ?? '').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(numericValue) || numericValue <= 0) return [];
    return [{
      id: `${response.id}:${field.id}`,
      patientId: patientId(patient),
      patientName: patientName(patient),
      mobile: mobile || normalizePhone(patientMobile(patient)),
      type,
      value: numericValue,
      unit,
      recordedAt: response.submittedAt,
      formId: form.id,
      formTitle: form.title,
      responseId: response.id,
      fieldId: field.id,
      fieldLabel: field.label,
    }];
  });
  const existing = Array.isArray(current) ? current : [];
  const existingIds = new Set(existing.map((item) => item.id));
  const newUpdates = updates.filter((item) => !existingIds.has(item.id));
  if (newUpdates.length) writeJson(PATIENT_UPDATES_KEY, [...newUpdates, ...existing]);
  return { status: newUpdates.length ? 'updated' : 'no-change', count: newUpdates.length, patientName: patientName(patient) };
}

function normalizeForm(form) {
  return {
    confirmationMessage: 'Thank you. Your response has been recorded.',
    submitLabel: 'Submit form',
    accentColor: '#1f6b4a',
    showProgress: true,
    allowMultiple: true,
    collectEmail: false,
    responseLimit: '',
    closeAt: '',
    redirectUrl: '',
    slug: form.id,
    ...form,
    fields: Array.isArray(form.fields) ? form.fields : [],
  };
}

function mergeById(localItems, remoteItems) {
  const items = new Map();
  [...localItems, ...remoteItems].forEach((item) => {
    if (item?.id) items.set(item.id, item);
  });
  return Array.from(items.values()).sort((a, b) => String(b.submittedAt ?? b.updatedAt ?? '').localeCompare(String(a.submittedAt ?? a.updatedAt ?? '')));
}

async function apiRequest(path, options = {}) {
  if (!apiBase) return null;
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Forms API request failed (${response.status}).`);
  if (response.status === 204) return null;
  return response.json();
}

export function hasFormsApi() {
  return Boolean(apiBase);
}

export function loadForms() {
  const current = readJson(FORMS_KEY, null);
  if (Array.isArray(current)) return current.map(normalizeForm);
  const legacy = readJson(LEGACY_FORMS_KEY, []);
  return Array.isArray(legacy) ? legacy.map(normalizeForm) : [];
}

export function saveForms(forms) {
  return writeJson(FORMS_KEY, forms.map(normalizeForm));
}

export async function loadSharedForms() {
  const localForms = loadForms();
  if (!apiBase) return { forms: localForms, source: 'local' };
  try {
    const payload = await apiRequest('/forms');
    const remoteForms = (Array.isArray(payload) ? payload : payload?.forms ?? []).map(normalizeForm);
    const deletedIds = new Set(remoteForms.filter((form) => form.status === 'Deleted').map((form) => form.id));
    const forms = mergeFormsById(
      localForms.filter((form) => !deletedIds.has(form.id)),
      remoteForms.filter((form) => form.status !== 'Deleted'),
    );
    saveForms(forms);
    return { forms, source: 'api' };
  } catch (error) {
    return { forms: localForms, source: 'local', warning: error.message };
  }
}

export function loadLocalResponses(formId) {
  const responses = readJson(RESPONSES_KEY, []);
  if (!Array.isArray(responses)) return [];
  return responses.filter((response) => response.formId === formId);
}

export function loadAllLocalResponses() {
  const responses = readJson(RESPONSES_KEY, []);
  return Array.isArray(responses) ? responses : [];
}

export async function loadResponses(formId) {
  const localResponses = loadLocalResponses(formId);
  if (!apiBase) return { responses: localResponses, source: 'local' };
  try {
    const payload = await apiRequest(`/forms/${encodeURIComponent(formId)}/responses`);
    const remoteResponses = Array.isArray(payload) ? payload : payload?.responses ?? [];
    return { responses: mergeById(localResponses, remoteResponses), source: 'api' };
  } catch (error) {
    return { responses: localResponses, source: 'local', warning: error.message };
  }
}

export async function publishForm(form) {
  const normalized = normalizeForm(form);
  if (!apiBase) return { form: normalized, delivery: 'local' };
  try {
    const payload = await apiRequest(`/forms/${encodeURIComponent(normalized.slug)}`, {
      method: 'PUT',
      body: JSON.stringify(normalized),
    });
    return { form: normalizeForm(payload?.form ?? payload ?? normalized), delivery: 'api' };
  } catch (error) {
    return { form: normalized, delivery: 'local', warning: error.message };
  }
}

export async function deleteSharedForm(form) {
  if (!apiBase || !form?.slug) return { delivery: 'local' };
  try {
    await apiRequest(`/forms/${encodeURIComponent(form.slug)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...normalizeForm(form), status: 'Deleted', updatedAt: new Date().toISOString() }),
    });
    return { delivery: 'api' };
  } catch (error) {
    return { delivery: 'local', warning: error.message };
  }
}

export async function loadPublicForm(slug) {
  const localForm = loadForms().find((form) => form.slug === slug || form.id === slug);
  if (localForm) return { form: localForm, source: 'local' };
  if (!apiBase) return { form: null, source: 'local' };
  let lastError = null;
  for (const delayMs of [0, 400, 900]) {
    if (delayMs) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    try {
      const payload = await apiRequest(`/forms/${encodeURIComponent(slug)}`);
      return { form: normalizeForm(payload?.form ?? payload), source: 'api' };
    } catch (error) {
      lastError = error;
    }
  }
  return { form: null, source: 'api', warning: lastError?.message ?? 'Form could not be loaded.' };
}

export async function submitFormResponse(form, answers, respondentEmail = '') {
  const response = {
    id: `response_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    formId: form.id,
    formSlug: form.slug,
    formTitle: form.title,
    submittedAt: new Date().toISOString(),
    respondentEmail,
    answers,
  };

  const current = readJson(RESPONSES_KEY, []);
  const next = [response, ...(Array.isArray(current) ? current : [])];
  let localSaved = writeJson(RESPONSES_KEY, next);
  if (!localSaved) {
    const pruned = [response, ...(Array.isArray(current) ? current.slice(0, 15) : [])];
    localSaved = writeJson(RESPONSES_KEY, pruned);
  }
  if (!localSaved) {
    const strippedResponse = {
      ...response,
      answers: Object.fromEntries(
        Object.entries(answers).map(([k, v]) => {
          if (Array.isArray(v)) {
            return [k, v.map((item) => (item?.dataUrl ? { name: item.name, size: item.size, type: item.type } : item))];
          }
          if (v?.dataUrl) {
            return [k, { name: v.name, size: v.size, type: v.type }];
          }
          return [k, v];
        })
      ),
    };
    localSaved = writeJson(RESPONSES_KEY, [strippedResponse, ...(Array.isArray(current) ? current.slice(0, 10) : [])]);
  }
  const patientData = applyPatientDataMappings(form, response);

  if (!apiBase) {
    if (!localSaved) {
      throw new Error('Browser storage is full. Please clear old responses or connect the Forms API.');
    }
    return { response, delivery: 'local', patientData };
  }
  try {
    await apiRequest(`/forms/${encodeURIComponent(form.slug)}/responses`, {
      method: 'POST',
      body: JSON.stringify(response),
    });
    return { response, delivery: 'api', patientData };
  } catch (error) {
    if (!localSaved) {
      throw new Error('Could not submit response: ' + error.message);
    }
    return { response, delivery: 'local', patientData, warning: error.message };
  }
}

export function deleteLocalResponse(responseId) {
  const current = readJson(RESPONSES_KEY, []);
  if (!Array.isArray(current)) return false;
  return writeJson(RESPONSES_KEY, current.filter((response) => response.id !== responseId));
}

export async function deleteResponseRecord(formIdentifier, responseId) {
  deleteLocalResponse(responseId);
  if (!apiBase || !responseId) return { delivery: 'local' };
  try {
    await apiRequest(`/forms/${encodeURIComponent(formIdentifier || 'default')}/responses/${encodeURIComponent(responseId)}`, {
      method: 'DELETE',
    });
    return { delivery: 'api' };
  } catch (error) {
    return { delivery: 'local', warning: error.message };
  }
}


export function getPublicFormUrl(form) {
  const configuredBase = String(import.meta.env.VITE_APP_URL ?? '').trim().replace(/\/$/, '');
  const base = configuredBase || window.location.origin;
  return `${base}/public/forms/${encodeURIComponent(form.slug || form.id)}`;
}

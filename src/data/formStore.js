const FORMS_KEY = 'moms-pathshala:forms:v2';
const LEGACY_FORMS_KEY = 'ayurflow:forms:v1';
const RESPONSES_KEY = 'moms-pathshala:form-responses:v2';

const apiBase = String(import.meta.env.VITE_FORMS_API_URL ?? '').trim().replace(/\/$/, '');

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

export function loadLocalResponses(formId) {
  const responses = readJson(RESPONSES_KEY, []);
  if (!Array.isArray(responses)) return [];
  return responses.filter((response) => response.formId === formId);
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

export async function loadPublicForm(slug) {
  const localForm = loadForms().find((form) => form.slug === slug || form.id === slug);
  if (localForm) return { form: localForm, source: 'local' };
  if (!apiBase) return { form: null, source: 'local' };
  try {
    const payload = await apiRequest(`/forms/${encodeURIComponent(slug)}`);
    return { form: normalizeForm(payload?.form ?? payload), source: 'api' };
  } catch (error) {
    return { form: null, source: 'api', warning: error.message };
  }
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
  if (!writeJson(RESPONSES_KEY, next)) {
    throw new Error('Browser storage is full. Remove large file responses or connect the Forms API.');
  }

  if (!apiBase) return { response, delivery: 'local' };
  try {
    await apiRequest(`/forms/${encodeURIComponent(form.slug)}/responses`, {
      method: 'POST',
      body: JSON.stringify(response),
    });
    return { response, delivery: 'api' };
  } catch (error) {
    return { response, delivery: 'local', warning: error.message };
  }
}

export function deleteLocalResponse(responseId) {
  const current = readJson(RESPONSES_KEY, []);
  if (!Array.isArray(current)) return false;
  return writeJson(RESPONSES_KEY, current.filter((response) => response.id !== responseId));
}

export function getPublicFormUrl(form) {
  const configuredBase = String(import.meta.env.VITE_APP_URL ?? '').trim().replace(/\/$/, '');
  const base = configuredBase || window.location.origin;
  return `${base}/public/forms/${encodeURIComponent(form.slug || form.id)}`;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionMenu, Card, Tag } from '../components/ui.jsx';
import {
  deleteLocalResponse,
  getPublicFormUrl,
  hasFormsApi,
  loadForms,
  loadLocalResponses,
  loadPublicForm,
  loadResponses,
  publishForm,
  saveForms,
  submitFormResponse,
} from '../data/formStore.js';

const FIELD_TYPES = [
  { value: 'text', label: 'Short text', group: 'Input' },
  { value: 'textarea', label: 'Long text', group: 'Input' },
  { value: 'email', label: 'Email', group: 'Input' },
  { value: 'phone', label: 'Phone', group: 'Input' },
  { value: 'number', label: 'Number', group: 'Input' },
  { value: 'url', label: 'Website URL', group: 'Input' },
  { value: 'date', label: 'Date', group: 'Date & time' },
  { value: 'time', label: 'Time', group: 'Date & time' },
  { value: 'datetime', label: 'Date and time', group: 'Date & time' },
  { value: 'select', label: 'Dropdown', group: 'Choice' },
  { value: 'radio', label: 'Single choice', group: 'Choice' },
  { value: 'multiselect', label: 'Multiple choice', group: 'Choice' },
  { value: 'checkbox', label: 'Consent checkbox', group: 'Choice' },
  { value: 'rating', label: 'Star rating', group: 'Choice' },
  { value: 'scale', label: 'Number scale', group: 'Choice' },
  { value: 'file', label: 'File upload', group: 'Advanced' },
  { value: 'heading', label: 'Heading', group: 'Layout' },
  { value: 'paragraph', label: 'Paragraph', group: 'Layout' },
  { value: 'divider', label: 'Divider', group: 'Layout' },
  { value: 'section', label: 'Section / page break', group: 'Layout' },
];

const INPUT_TYPES = new Set(FIELD_TYPES.filter((item) => !['heading', 'paragraph', 'divider', 'section'].includes(item.value)).map((item) => item.value));
const OPTION_TYPES = new Set(['select', 'radio', 'multiselect']);
const TEXT_VALIDATION_TYPES = new Set(['text', 'textarea', 'email', 'phone', 'url']);
const DEFAULT_OPTIONS = ['Option 1', 'Option 2'];

function makeUid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

function fieldTypeLabel(type) {
  return FIELD_TYPES.find((item) => item.value === type)?.label ?? type;
}

function makeField(type = 'text') {
  const layoutType = ['heading', 'paragraph', 'divider', 'section'].includes(type);
  return {
    id: makeUid('field'),
    type,
    label: type === 'section' ? 'New section' : type === 'heading' ? 'Heading' : type === 'paragraph' ? 'Add supporting text here.' : '',
    help: '',
    placeholder: '',
    required: false,
    options: OPTION_TYPES.has(type) ? [...DEFAULT_OPTIONS] : [],
    min: type === 'scale' ? 1 : '',
    max: type === 'scale' ? 10 : '',
    minLength: '',
    maxLength: '',
    acceptedFiles: '',
    maxFileMb: 2,
    width: layoutType ? 'full' : 'full',
    condition: { enabled: false, fieldId: '', operator: 'equals', value: '' },
  };
}

function makeForm() {
  const id = makeUid('form');
  return {
    id,
    slug: id,
    title: '',
    description: '',
    status: 'Draft',
    fields: [makeField('text')],
    confirmationMessage: 'Thank you. Your response has been recorded.',
    submitLabel: 'Submit form',
    accentColor: '#1f6b4a',
    showProgress: true,
    allowMultiple: true,
    collectEmail: false,
    responseLimit: '',
    closeAt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function cloneForm(form) {
  return {
    ...form,
    fields: form.fields.map((field) => ({
      ...field,
      options: [...(field.options ?? [])],
      condition: { enabled: false, fieldId: '', operator: 'equals', value: '', ...(field.condition ?? {}) },
    })),
  };
}

function downloadText(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  if (value && typeof value === 'object') {
    if (value.name) return `"${String(value.name).replaceAll('"', '""')}"`;
    return `"${JSON.stringify(value).replaceAll('"', '""')}"`;
  }
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function shouldShowField(field, answers) {
  if (!field.condition?.enabled || !field.condition.fieldId) return true;
  const actual = answers[field.condition.fieldId];
  const expected = field.condition.value;
  if (field.condition.operator === 'not_equals') return String(actual ?? '') !== String(expected ?? '');
  if (field.condition.operator === 'contains') {
    if (Array.isArray(actual)) return actual.includes(expected);
    return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
  }
  if (field.condition.operator === 'is_answered') return Array.isArray(actual) ? actual.length > 0 : Boolean(actual);
  return String(actual ?? '') === String(expected ?? '');
}

function splitIntoPages(fields) {
  const pages = [{ id: 'page-1', title: '', description: '', fields: [] }];
  fields.forEach((field) => {
    if (field.type === 'section') {
      const current = pages[pages.length - 1];
      if (!current.fields.length && !current.title) {
        current.id = field.id;
        current.title = field.label;
        current.description = field.help;
      } else {
        pages.push({ id: field.id, title: field.label, description: field.help, fields: [] });
      }
      return;
    }
    pages[pages.length - 1].fields.push(field);
  });
  return pages.filter((page, index) => page.fields.length || page.title || index === 0);
}

function validateField(field, value) {
  if (!INPUT_TYPES.has(field.type)) return '';
  const empty = Array.isArray(value) ? value.length === 0 : value === undefined || value === null || value === '' || value === false;
  if (field.required && empty) return 'This field is required.';
  if (empty) return '';
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return 'Enter a valid email address.';
  if (field.type === 'url') {
    try { new URL(String(value)); } catch { return 'Enter a complete URL, including https://.'; }
  }
  if (field.type === 'phone' && String(value).replace(/\D/g, '').length < 7) return 'Enter a valid phone number.';
  if (field.type === 'number' || field.type === 'scale') {
    const numberValue = Number(value);
    if (field.min !== '' && numberValue < Number(field.min)) return `Minimum value is ${field.min}.`;
    if (field.max !== '' && numberValue > Number(field.max)) return `Maximum value is ${field.max}.`;
  }
  if (TEXT_VALIDATION_TYPES.has(field.type)) {
    if (field.minLength !== '' && String(value).length < Number(field.minLength)) return `Enter at least ${field.minLength} characters.`;
    if (field.maxLength !== '' && String(value).length > Number(field.maxLength)) return `Use no more than ${field.maxLength} characters.`;
  }
  return '';
}

function displayAnswer(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return value.name ?? JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value ?? '');
}

function FormField({ field, value, error, onChange, accentColor }) {
  const inputId = `public-${field.id}`;
  const common = {
    id: inputId,
    className: `lead-input ${error ? 'input-error' : ''}`,
    value: value ?? '',
    onChange: (event) => onChange(event.target.value),
    placeholder: field.placeholder || undefined,
    required: field.required,
  };

  if (field.type === 'heading') return <h2 className="public-form-heading">{field.label || 'Heading'}</h2>;
  if (field.type === 'paragraph') return <p className="public-form-paragraph">{field.label}</p>;
  if (field.type === 'divider') return <hr className="public-form-divider" />;

  let control = null;
  if (field.type === 'textarea') {
    control = <textarea {...common} rows={4} minLength={field.minLength || undefined} maxLength={field.maxLength || undefined} />;
  } else if (field.type === 'select') {
    control = (
      <select {...common}>
        <option value="">Select an option</option>
        {(field.options ?? []).filter(Boolean).map((option) => <option value={option} key={option}>{option}</option>)}
      </select>
    );
  } else if (field.type === 'radio') {
    control = (
      <div className="choice-list" role="radiogroup" aria-labelledby={`${inputId}-label`}>
        {(field.options ?? []).filter(Boolean).map((option) => (
          <label className="choice-option" key={option}>
            <input type="radio" name={field.id} value={option} checked={value === option} onChange={() => onChange(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  } else if (field.type === 'multiselect') {
    const selected = Array.isArray(value) ? value : [];
    control = (
      <div className="choice-list">
        {(field.options ?? []).filter(Boolean).map((option) => (
          <label className="choice-option" key={option}>
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  } else if (field.type === 'checkbox') {
    control = (
      <label className="choice-option consent-option">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{field.placeholder || 'I agree'}</span>
      </label>
    );
  } else if (field.type === 'rating') {
    control = (
      <div className="rating-control" aria-label={field.label}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            className={Number(value) >= rating ? 'selected' : ''}
            type="button"
            key={rating}
            onClick={() => onChange(rating)}
            aria-label={`${rating} out of 5`}
            style={{ '--form-accent': accentColor }}
          >
            {rating}
          </button>
        ))}
      </div>
    );
  } else if (field.type === 'scale') {
    const min = Number(field.min || 1);
    const max = Number(field.max || 10);
    const options = Array.from({ length: Math.min(max - min + 1, 20) }, (_, index) => min + index);
    control = (
      <div className="scale-control">
        {options.map((number) => (
          <button className={Number(value) === number ? 'selected' : ''} type="button" key={number} onClick={() => onChange(number)} style={{ '--form-accent': accentColor }}>{number}</button>
        ))}
      </div>
    );
  } else if (field.type === 'file') {
    control = (
      <div>
        <input
          id={inputId}
          className={`lead-input file-input ${error ? 'input-error' : ''}`}
          type="file"
          accept={field.acceptedFiles || undefined}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const maxBytes = Number(field.maxFileMb || 2) * 1024 * 1024;
            if (file.size > maxBytes) {
              onChange({ error: `File must be smaller than ${field.maxFileMb || 2} MB.` });
              return;
            }
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            onChange({ name: file.name, size: file.size, type: file.type, dataUrl });
          }}
        />
        {value?.name && <p className="field-help">Selected: {value.name}</p>}
        {value?.error && <p className="field-error">{value.error}</p>}
      </div>
    );
  } else {
    const typeMap = { phone: 'tel', datetime: 'datetime-local' };
    control = (
      <input
        {...common}
        type={typeMap[field.type] ?? field.type}
        min={field.min || undefined}
        max={field.max || undefined}
        minLength={field.minLength || undefined}
        maxLength={field.maxLength || undefined}
      />
    );
  }

  return (
    <div className={`public-form-field width-${field.width || 'full'}`}>
      <label className="public-field-label" id={`${inputId}-label`} htmlFor={['radio', 'multiselect', 'checkbox', 'rating', 'scale'].includes(field.type) ? undefined : inputId}>
        {field.label || 'Untitled field'}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      {field.help && <p className="field-help">{field.help}</p>}
      {control}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function FormRenderer({ form, mode = 'public', onSubmitted }) {
  const pages = useMemo(() => splitIntoPages(form.fields ?? []), [form.fields]);
  const [answers, setAnswers] = useState({});
  const [respondentEmail, setRespondentEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const accentColor = form.accentColor || '#1f6b4a';
  const responseCount = loadLocalResponses(form.id).length;
  const closed = form.closeAt && new Date(form.closeAt).getTime() < Date.now();
  const limitReached = form.responseLimit !== '' && responseCount >= Number(form.responseLimit);
  const alreadySubmitted = !form.allowMultiple && window.localStorage.getItem(`moms-pathshala:submitted:${form.id}`) === 'true';
  const unavailable = mode === 'public' && (form.status !== 'Published' || closed || limitReached || alreadySubmitted);
  const visibleFields = pages[currentPage]?.fields.filter((field) => shouldShowField(field, answers)) ?? [];

  const validateCurrentPage = () => {
    const nextErrors = {};
    visibleFields.forEach((field) => {
      const error = validateField(field, answers[field.id]);
      if (error) nextErrors[field.id] = error;
      if (field.type === 'file' && answers[field.id]?.error) nextErrors[field.id] = answers[field.id].error;
    });
    if (form.collectEmail && currentPage === 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respondentEmail)) {
      nextErrors.respondentEmail = 'Enter a valid email address.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateCurrentPage()) return;
    setCurrentPage((page) => Math.min(page + 1, pages.length - 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validateCurrentPage() || submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'preview') {
        setResult({ delivery: 'preview' });
      } else {
        const submission = await submitFormResponse(form, answers, respondentEmail);
        setResult(submission);
        if (!form.allowMultiple) window.localStorage.setItem(`moms-pathshala:submitted:${form.id}`, 'true');
      }
      onSubmitted?.();
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (unavailable) {
    const message = form.status !== 'Published'
      ? 'This form is not published.'
      : closed
        ? 'This form is closed.'
        : limitReached
          ? 'This form is no longer accepting responses.'
          : 'You have already submitted this form.';
    return <div className="public-form-state"><strong>Form unavailable</strong><p>{message}</p></div>;
  }

  if (result) {
    return (
      <div className="public-form-state success-state">
        <strong>Response submitted</strong>
        <p>{form.confirmationMessage}</p>
        {result.warning && <p className="field-error">Saved in this browser. Remote delivery needs attention.</p>}
        {form.allowMultiple && (
          <button className="pill" type="button" onClick={() => { setAnswers({}); setRespondentEmail(''); setErrors({}); setResult(null); setCurrentPage(0); }}>Submit another response</button>
        )}
      </div>
    );
  }

  return (
    <form className="public-form" onSubmit={submit} style={{ '--form-accent': accentColor }} noValidate>
      {form.showProgress && pages.length > 1 && (
        <div className="form-progress" aria-label={`Step ${currentPage + 1} of ${pages.length}`}>
          <div><span>Step {currentPage + 1} of {pages.length}</span><span>{Math.round(((currentPage + 1) / pages.length) * 100)}%</span></div>
          <div className="form-progress-track"><span style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }} /></div>
        </div>
      )}

      {(pages[currentPage]?.title || pages[currentPage]?.description) && (
        <div className="public-form-section-head">
          {pages[currentPage].title && <h2>{pages[currentPage].title}</h2>}
          {pages[currentPage].description && <p>{pages[currentPage].description}</p>}
        </div>
      )}

      {form.collectEmail && currentPage === 0 && (
        <div className="public-form-field width-full">
          <label className="public-field-label" htmlFor="respondent-email">Your email <span aria-hidden="true">*</span></label>
          <input id="respondent-email" className={`lead-input ${errors.respondentEmail ? 'input-error' : ''}`} type="email" value={respondentEmail} onChange={(event) => setRespondentEmail(event.target.value)} placeholder="name@example.com" />
          {errors.respondentEmail && <p className="field-error" role="alert">{errors.respondentEmail}</p>}
        </div>
      )}

      <div className="public-form-fields">
        {visibleFields.map((field) => (
          <FormField
            key={field.id}
            field={field}
            value={answers[field.id]}
            error={errors[field.id]}
            accentColor={accentColor}
            onChange={(value) => {
              setAnswers((current) => ({ ...current, [field.id]: value }));
              setErrors((current) => ({ ...current, [field.id]: '' }));
            }}
          />
        ))}
      </div>

      {errors.form && <p className="field-error form-submit-error" role="alert">{errors.form}</p>}
      <div className="public-form-actions">
        {currentPage > 0 && <button className="pill" type="button" onClick={() => { setCurrentPage((page) => page - 1); setErrors({}); }}>Back</button>}
        {currentPage < pages.length - 1 ? (
          <button className="pill primary-form-button" type="button" onClick={goNext}>Continue</button>
        ) : (
          <button className="pill primary-form-button" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : form.submitLabel}</button>
        )}
      </div>
    </form>
  );
}

function FieldInspector({ field, allFields, onChange, onAddOption, onUpdateOption, onRemoveOption }) {
  if (!field) {
    return <div className="empty-state compact-empty"><strong>Select a field</strong><p>Choose a field from the list to edit its settings.</p></div>;
  }
  const conditionSources = allFields.filter((item) => item.id !== field.id && INPUT_TYPES.has(item.type));
  const layoutOnly = ['heading', 'paragraph', 'divider', 'section'].includes(field.type);

  return (
    <div className="field-inspector-form">
      {field.type !== 'divider' && (
        <label className="field-block">
          <span>{layoutOnly ? 'Content' : 'Question label'}</span>
          {field.type === 'paragraph' ? (
            <textarea className="lead-input" rows={3} value={field.label} onChange={(event) => onChange('label', event.target.value)} />
          ) : (
            <input className="lead-input" value={field.label} onChange={(event) => onChange('label', event.target.value)} placeholder="Enter label" />
          )}
        </label>
      )}
      {!['divider', 'paragraph'].includes(field.type) && (
        <label className="field-block">
          <span>Description / help text</span>
          <textarea className="lead-input" rows={2} value={field.help ?? ''} onChange={(event) => onChange('help', event.target.value)} placeholder="Optional instructions" />
        </label>
      )}
      {!layoutOnly && !['radio', 'multiselect', 'rating', 'scale', 'file'].includes(field.type) && (
        <label className="field-block">
          <span>Placeholder</span>
          <input className="lead-input" value={field.placeholder ?? ''} onChange={(event) => onChange('placeholder', event.target.value)} placeholder="Hint shown inside the field" />
        </label>
      )}
      {field.type === 'checkbox' && (
        <label className="field-block">
          <span>Consent text</span>
          <input className="lead-input" value={field.placeholder ?? ''} onChange={(event) => onChange('placeholder', event.target.value)} placeholder="I agree to the terms" />
        </label>
      )}
      {OPTION_TYPES.has(field.type) && (
        <div className="field-options-editor">
          <div className="inspector-section-title">Options</div>
          {(field.options ?? []).map((option, index) => (
            <div className="field-option-row" key={`${field.id}-${index}`}>
              <input className="lead-input" value={option} onChange={(event) => onUpdateOption(index, event.target.value)} placeholder={`Option ${index + 1}`} />
              <button className="icon-btn inline-icon" type="button" onClick={() => onRemoveOption(index)} aria-label={`Remove option ${index + 1}`}>x</button>
            </div>
          ))}
          <button className="pill" type="button" onClick={onAddOption}>Add option</button>
        </div>
      )}
      {!layoutOnly && (
        <div className="inspector-inline-grid">
          <label className="field-block">
            <span>Width</span>
            <select className="lead-input" value={field.width ?? 'full'} onChange={(event) => onChange('width', event.target.value)}>
              <option value="full">Full width</option>
              <option value="half">Half width</option>
            </select>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={Boolean(field.required)} onChange={(event) => onChange('required', event.target.checked)} />
            <span>Required</span>
          </label>
        </div>
      )}
      {(field.type === 'number' || field.type === 'scale') && (
        <div className="inspector-inline-grid">
          <label className="field-block"><span>Minimum</span><input className="lead-input" type="number" value={field.min ?? ''} onChange={(event) => onChange('min', event.target.value)} /></label>
          <label className="field-block"><span>Maximum</span><input className="lead-input" type="number" value={field.max ?? ''} onChange={(event) => onChange('max', event.target.value)} /></label>
        </div>
      )}
      {TEXT_VALIDATION_TYPES.has(field.type) && (
        <div className="inspector-inline-grid">
          <label className="field-block"><span>Min characters</span><input className="lead-input" type="number" min="0" value={field.minLength ?? ''} onChange={(event) => onChange('minLength', event.target.value)} /></label>
          <label className="field-block"><span>Max characters</span><input className="lead-input" type="number" min="1" value={field.maxLength ?? ''} onChange={(event) => onChange('maxLength', event.target.value)} /></label>
        </div>
      )}
      {field.type === 'file' && (
        <div className="inspector-inline-grid">
          <label className="field-block"><span>Accepted file types</span><input className="lead-input" value={field.acceptedFiles ?? ''} onChange={(event) => onChange('acceptedFiles', event.target.value)} placeholder=".pdf,image/*" /></label>
          <label className="field-block"><span>Max size (MB)</span><input className="lead-input" type="number" min="1" max="5" value={field.maxFileMb ?? 2} onChange={(event) => onChange('maxFileMb', event.target.value)} /></label>
        </div>
      )}
      {!layoutOnly && conditionSources.length > 0 && (
        <div className="condition-editor">
          <label className="toggle-row">
            <input type="checkbox" checked={Boolean(field.condition?.enabled)} onChange={(event) => onChange('condition', { ...field.condition, enabled: event.target.checked })} />
            <span>Conditional visibility</span>
          </label>
          {field.condition?.enabled && (
            <>
              <label className="field-block">
                <span>Show when</span>
                <select className="lead-input" value={field.condition.fieldId ?? ''} onChange={(event) => onChange('condition', { ...field.condition, fieldId: event.target.value })}>
                  <option value="">Select a field</option>
                  {conditionSources.map((item) => <option value={item.id} key={item.id}>{item.label || fieldTypeLabel(item.type)}</option>)}
                </select>
              </label>
              <div className="inspector-inline-grid">
                <select className="lead-input" value={field.condition.operator ?? 'equals'} onChange={(event) => onChange('condition', { ...field.condition, operator: event.target.value })}>
                  <option value="equals">Equals</option>
                  <option value="not_equals">Does not equal</option>
                  <option value="contains">Contains</option>
                  <option value="is_answered">Is answered</option>
                </select>
                {field.condition.operator !== 'is_answered' && <input className="lead-input" value={field.condition.value ?? ''} onChange={(event) => onChange('condition', { ...field.condition, value: event.target.value })} placeholder="Value" />}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function FormsPage() {
  const [forms, setForms] = useState(loadForms);
  const [view, setView] = useState('list');
  const [builderTab, setBuilderTab] = useState('build');
  const [draftForm, setDraftForm] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [responseForm, setResponseForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [message, setMessage] = useState(hasFormsApi() ? 'Forms API connected.' : 'Local mode. Configure Forms API for cross-device submissions.');
  const dragFieldId = useRef(null);

  useEffect(() => {
    if (!saveForms(forms)) setMessage('Browser storage is full. Export responses or connect the Forms API.');
  }, [forms]);

  const selectedField = draftForm?.fields.find((field) => field.id === selectedFieldId) ?? null;
  const responseCounts = useMemo(() => Object.fromEntries(forms.map((form) => [form.id, loadLocalResponses(form.id).length])), [forms, view]);

  const startCreate = () => {
    const form = makeForm();
    setDraftForm(form);
    setSelectedFieldId(form.fields[0].id);
    setBuilderTab('build');
    setView('builder');
  };

  const startEdit = (form) => {
    const next = cloneForm(form);
    setDraftForm(next);
    setSelectedFieldId(next.fields[0]?.id ?? null);
    setBuilderTab('build');
    setView('builder');
  };

  const addField = (type) => {
    const field = makeField(type);
    setDraftForm((current) => ({ ...current, fields: [...current.fields, field] }));
    setSelectedFieldId(field.id);
  };

  const updateField = (fieldId, key, value) => {
    setDraftForm((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.id === fieldId ? { ...field, [key]: value } : field)),
    }));
  };

  const moveField = (fieldId, direction) => {
    setDraftForm((current) => {
      const index = current.fields.findIndex((field) => field.id === fieldId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.fields.length) return current;
      const fields = [...current.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...current, fields };
    });
  };

  const reorderField = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return;
    setDraftForm((current) => {
      const fields = [...current.fields];
      const sourceIndex = fields.findIndex((field) => field.id === sourceId);
      const targetIndex = fields.findIndex((field) => field.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [moved] = fields.splice(sourceIndex, 1);
      fields.splice(targetIndex, 0, moved);
      return { ...current, fields };
    });
  };

  const duplicateField = (fieldId) => {
    setDraftForm((current) => {
      const index = current.fields.findIndex((field) => field.id === fieldId);
      if (index < 0) return current;
      const duplicate = { ...cloneForm({ fields: [current.fields[index]] }).fields[0], id: makeUid('field'), label: `${current.fields[index].label || fieldTypeLabel(current.fields[index].type)} copy` };
      const fields = [...current.fields];
      fields.splice(index + 1, 0, duplicate);
      setSelectedFieldId(duplicate.id);
      return { ...current, fields };
    });
  };

  const removeField = (fieldId) => {
    setDraftForm((current) => {
      const fields = current.fields.filter((field) => field.id !== fieldId);
      if (selectedFieldId === fieldId) setSelectedFieldId(fields[0]?.id ?? null);
      return { ...current, fields };
    });
  };

  const saveBuilder = async (status) => {
    if (!draftForm.title.trim()) {
      setMessage('Enter a form title before saving.');
      return;
    }
    const slugBase = slugify(draftForm.slug || draftForm.title) || draftForm.id;
    const duplicateSlug = forms.some((form) => form.id !== draftForm.id && form.slug === slugBase);
    const savedForm = {
      ...draftForm,
      slug: duplicateSlug ? `${slugBase}-${draftForm.id.slice(-4)}` : slugBase,
      status,
      updatedAt: new Date().toISOString(),
    };
    setForms((current) => current.some((form) => form.id === savedForm.id)
      ? current.map((form) => (form.id === savedForm.id ? savedForm : form))
      : [savedForm, ...current]);
    setDraftForm(savedForm);
    if (status === 'Published') {
      const result = await publishForm(savedForm);
      setMessage(result.warning ? 'Published locally. Remote API sync failed.' : `Published. Public link: ${getPublicFormUrl(savedForm)}`);
    } else {
      setMessage('Draft saved.');
    }
    setView('list');
  };

  const toggleStatus = async (form) => {
    const status = form.status === 'Published' ? 'Draft' : 'Published';
    const updated = { ...form, status, updatedAt: new Date().toISOString() };
    setForms((current) => current.map((item) => (item.id === form.id ? updated : item)));
    if (status === 'Published') await publishForm(updated);
    setMessage(`${form.title} ${status === 'Published' ? 'published' : 'unpublished'}.`);
  };

  const duplicateForm = (form) => {
    const duplicate = cloneForm({
      ...form,
      id: makeUid('form'),
      slug: `${form.slug || slugify(form.title)}-copy-${Math.random().toString(36).slice(2, 5)}`,
      title: `${form.title} copy`,
      status: 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    duplicate.fields = duplicate.fields.map((field) => ({ ...field, id: makeUid('field'), condition: { ...field.condition, enabled: false, fieldId: '' } }));
    setForms((current) => [duplicate, ...current]);
    setMessage('Form duplicated as a draft.');
  };

  const deleteForm = (form) => {
    if (!window.confirm(`Delete "${form.title}"? Existing responses will remain available in storage.`)) return;
    setForms((current) => current.filter((item) => item.id !== form.id));
    setMessage('Form deleted.');
  };

  const copyPublicLink = async (form) => {
    if (form.status !== 'Published') {
      setMessage('Publish the form before sharing its public link.');
      return;
    }
    const link = getPublicFormUrl(form);
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Public form link copied.');
    } catch {
      setMessage(`Copy this link: ${link}`);
    }
  };

  const openResponses = async (form) => {
    setResponseForm(form);
    setResponsesLoading(true);
    setSelectedResponse(null);
    setView('responses');
    const result = await loadResponses(form.id);
    setResponses(result.responses);
    setMessage(result.warning ? 'Showing local responses. Remote API could not be reached.' : `${result.responses.length} response(s) loaded.`);
    setResponsesLoading(false);
  };

  const exportResponses = () => {
    if (!responseForm) return;
    const responseFields = responseForm.fields.filter((field) => INPUT_TYPES.has(field.type));
    const headers = ['Submitted At', 'Respondent Email', ...responseFields.map((field) => field.label || fieldTypeLabel(field.type))];
    const rows = responses.map((response) => [
      response.submittedAt,
      response.respondentEmail,
      ...responseFields.map((field) => displayAnswer(response.answers?.[field.id])),
    ]);
    downloadText(`${responseForm.slug}-responses.csv`, [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
    setMessage('Responses CSV export started.');
  };

  const removeResponse = (response) => {
    if (!window.confirm('Delete this local response?')) return;
    deleteLocalResponse(response.id);
    setResponses((current) => current.filter((item) => item.id !== response.id));
    setSelectedResponse(null);
    setMessage('Local response deleted.');
  };

  if (view === 'preview' && draftForm) {
    return (
      <section className="module-page">
        <div className="module-command-bar">
          <button className="pill" type="button" onClick={() => setView('builder')}>Back to builder</button>
          <span className="command-message">Preview mode does not create a response.</span>
        </div>
        <div className="public-form-preview-frame">
          <div className="public-form-card" style={{ '--form-accent': draftForm.accentColor }}>
            <div className="public-form-title"><span>Form preview</span><h1>{draftForm.title || 'Untitled form'}</h1><p>{draftForm.description}</p></div>
            <FormRenderer form={{ ...draftForm, status: 'Published' }} mode="preview" />
          </div>
        </div>
      </section>
    );
  }

  if (view === 'builder' && draftForm) {
    const addFieldItems = FIELD_TYPES.map((type) => ({ label: type.label, description: type.group, onClick: () => addField(type.value) }));
    return (
      <section className="module-page form-builder-page">
        <div className="module-hero compact-hero">
          <div><h1>{forms.some((form) => form.id === draftForm.id) ? 'Edit Form' : 'Create Form'}</h1><p>Build questions, rules, validation, pages, and public submission settings.</p></div>
          <div className="module-stats">
            <div className="mini-stat"><span>Fields</span><strong>{draftForm.fields.length}</strong></div>
            <div className="mini-stat"><span>Pages</span><strong>{splitIntoPages(draftForm.fields).length}</strong></div>
            <div className="mini-stat"><span>Status</span><strong>{draftForm.status}</strong></div>
          </div>
        </div>

        <div className="module-command-bar builder-command-bar">
          <div className="sheet-tabs compact-tabs">
            <button className={`sheet-tab ${builderTab === 'build' ? 'active' : ''}`} type="button" onClick={() => setBuilderTab('build')}>Build</button>
            <button className={`sheet-tab ${builderTab === 'settings' ? 'active' : ''}`} type="button" onClick={() => setBuilderTab('settings')}>Settings</button>
          </div>
          <div className="card-action-group">
            <button className="pill" type="button" onClick={() => setView('preview')}>Preview</button>
            <ActionMenu label="Save" items={[
              { label: 'Save as draft', description: 'Keep the public link closed', onClick: () => saveBuilder('Draft') },
              { label: 'Publish form', description: 'Enable the public form link', onClick: () => saveBuilder('Published') },
            ]} />
            <button className="pill" type="button" onClick={() => setView('list')}>Close</button>
          </div>
        </div>

        {builderTab === 'build' ? (
          <>
            <Card title="Form Basics" subtitle="Shown at the top of the public form.">
              <div className="form-basics-grid">
                <label className="field-block"><span>Form title *</span><input className="lead-input" value={draftForm.title} onChange={(event) => setDraftForm((current) => ({ ...current, title: event.target.value, slug: current.slug === current.id ? slugify(event.target.value) || current.id : current.slug }))} placeholder="Patient intake form" /></label>
                <label className="field-block"><span>Description</span><textarea className="lead-input" rows={2} value={draftForm.description} onChange={(event) => setDraftForm((current) => ({ ...current, description: event.target.value }))} placeholder="Tell respondents what this form is for" /></label>
              </div>
            </Card>

            <div className="form-builder-grid">
              <Card title="Form Fields" subtitle="Drag to reorder or use each row menu." action={<ActionMenu label="Add Field" items={addFieldItems} />}>
                <div className="builder-field-list">
                  {draftForm.fields.map((field, index) => (
                    <div
                      className={`builder-field-row ${selectedFieldId === field.id ? 'selected' : ''}`}
                      key={field.id}
                      draggable
                      onDragStart={() => { dragFieldId.current = field.id; }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => { reorderField(dragFieldId.current, field.id); dragFieldId.current = null; }}
                    >
                      <button className="builder-field-main" type="button" onClick={() => setSelectedFieldId(field.id)}>
                        <span className="drag-handle" aria-hidden="true">::</span>
                        <span><strong>{field.label || 'Untitled field'}</strong><small>{fieldTypeLabel(field.type)}{field.required ? ' - Required' : ''}</small></span>
                      </button>
                      <ActionMenu compact label={`Actions for ${field.label || fieldTypeLabel(field.type)}`} items={[
                        { label: 'Move up', disabled: index === 0, onClick: () => moveField(field.id, -1) },
                        { label: 'Move down', disabled: index === draftForm.fields.length - 1, onClick: () => moveField(field.id, 1) },
                        { label: 'Duplicate field', onClick: () => duplicateField(field.id) },
                        { label: 'Delete field', danger: true, onClick: () => removeField(field.id) },
                      ]} />
                    </div>
                  ))}
                  {!draftForm.fields.length && <div className="empty-state compact-empty"><strong>No fields yet.</strong><p>Use Add Field to begin.</p></div>}
                </div>
              </Card>

              <Card title={selectedField ? fieldTypeLabel(selectedField.type) : 'Field Settings'} subtitle={selectedField ? 'Changes appear in preview immediately.' : 'Select a field to edit.'}>
                <FieldInspector
                  field={selectedField}
                  allFields={draftForm.fields}
                  onChange={(key, value) => updateField(selectedField.id, key, value)}
                  onAddOption={() => updateField(selectedField.id, 'options', [...(selectedField.options ?? []), `Option ${(selectedField.options?.length ?? 0) + 1}`])}
                  onUpdateOption={(index, value) => updateField(selectedField.id, 'options', selectedField.options.map((option, optionIndex) => (optionIndex === index ? value : option)))}
                  onRemoveOption={(index) => updateField(selectedField.id, 'options', selectedField.options.filter((_, optionIndex) => optionIndex !== index))}
                />
              </Card>
            </div>
          </>
        ) : (
          <div className="settings-grid">
            <Card title="Publishing" subtitle="Control availability and response limits.">
              <div className="field-inspector-form">
                <label className="field-block"><span>Public link slug</span><div className="input-prefix-row"><span>/public/forms/</span><input className="lead-input" value={draftForm.slug} onChange={(event) => setDraftForm((current) => ({ ...current, slug: slugify(event.target.value) }))} /></div></label>
                <label className="field-block"><span>Close form at</span><input className="lead-input" type="datetime-local" value={draftForm.closeAt ?? ''} onChange={(event) => setDraftForm((current) => ({ ...current, closeAt: event.target.value }))} /></label>
                <label className="field-block"><span>Response limit</span><input className="lead-input" type="number" min="1" value={draftForm.responseLimit ?? ''} onChange={(event) => setDraftForm((current) => ({ ...current, responseLimit: event.target.value }))} placeholder="No limit" /></label>
                <label className="toggle-row"><input type="checkbox" checked={draftForm.allowMultiple} onChange={(event) => setDraftForm((current) => ({ ...current, allowMultiple: event.target.checked }))} /><span>Allow multiple responses</span></label>
                <label className="toggle-row"><input type="checkbox" checked={draftForm.collectEmail} onChange={(event) => setDraftForm((current) => ({ ...current, collectEmail: event.target.checked }))} /><span>Collect respondent email</span></label>
              </div>
            </Card>
            <Card title="Appearance & Completion" subtitle="Customize the respondent experience.">
              <div className="field-inspector-form">
                <label className="field-block"><span>Accent color</span><div className="color-input-row"><input type="color" value={draftForm.accentColor} onChange={(event) => setDraftForm((current) => ({ ...current, accentColor: event.target.value }))} /><input className="lead-input" value={draftForm.accentColor} onChange={(event) => setDraftForm((current) => ({ ...current, accentColor: event.target.value }))} /></div></label>
                <label className="field-block"><span>Submit button label</span><input className="lead-input" value={draftForm.submitLabel} onChange={(event) => setDraftForm((current) => ({ ...current, submitLabel: event.target.value }))} /></label>
                <label className="field-block"><span>Confirmation message</span><textarea className="lead-input" rows={3} value={draftForm.confirmationMessage} onChange={(event) => setDraftForm((current) => ({ ...current, confirmationMessage: event.target.value }))} /></label>
                <label className="toggle-row"><input type="checkbox" checked={draftForm.showProgress} onChange={(event) => setDraftForm((current) => ({ ...current, showProgress: event.target.checked }))} /><span>Show progress for multi-page forms</span></label>
              </div>
            </Card>
          </div>
        )}
      </section>
    );
  }

  if (view === 'responses' && responseForm) {
    const responseFields = responseForm.fields.filter((field) => INPUT_TYPES.has(field.type));
    return (
      <section className="module-page">
        <div className="module-hero compact-hero">
          <div><h1>{responseForm.title} Responses</h1><p>Review, export, and manage submitted form data.</p></div>
          <div className="module-stats"><div className="mini-stat"><span>Responses</span><strong>{responses.length}</strong></div><div className="mini-stat"><span>Source</span><strong>{hasFormsApi() ? 'API + local' : 'Local'}</strong></div></div>
        </div>
        <div className="module-command-bar"><button className="pill" type="button" onClick={() => setView('list')}>Back to forms</button><ActionMenu label="Actions" items={[{ label: 'Export responses CSV', onClick: exportResponses }, { label: 'Copy public link', disabled: responseForm.status !== 'Published', onClick: () => copyPublicLink(responseForm) }]} /></div>
        <Card title="Response Inbox" subtitle={responsesLoading ? 'Loading responses...' : message}>
          {responses.length ? (
            <div className="data-table adaptive-table" style={{ '--table-columns': 3 }}>
              <div className="table-head"><div>Submitted</div><div>Email</div><div>Response</div><div /></div>
              {responses.map((response) => (
                <div className="data-row" key={response.id}>
                  <div>{new Date(response.submittedAt).toLocaleString('en-IN')}</div>
                  <div>{response.respondentEmail || 'Not collected'}</div>
                  <div>{responseFields.slice(0, 2).map((field) => displayAnswer(response.answers?.[field.id])).filter(Boolean).join(' - ') || 'Open response'}</div>
                  <div><ActionMenu compact label={`Actions for response ${response.id}`} items={[{ label: 'View response', onClick: () => setSelectedResponse(response) }, { label: 'Delete local response', danger: true, onClick: () => removeResponse(response) }]} /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty"><strong>No responses yet.</strong><p>Publish and share the public link to collect responses.</p></div>
          )}
        </Card>
        {selectedResponse && (
          <Card title="Response Details" subtitle={new Date(selectedResponse.submittedAt).toLocaleString('en-IN')} action={<button className="pill" type="button" onClick={() => setSelectedResponse(null)}>Close</button>}>
            <div className="response-detail-grid">
              {responseFields.map((field) => (
                <div className="response-answer" key={field.id}><span>{field.label || fieldTypeLabel(field.type)}</span><strong>{displayAnswer(selectedResponse.answers?.[field.id]) || 'No answer'}</strong></div>
              ))}
            </div>
          </Card>
        )}
      </section>
    );
  }

  return (
    <section className="module-page">
      <div className="module-hero">
        <div><h1>Forms</h1><p>Build public forms, collect validated responses, and manage submissions.</p><p className="subtle">{message}</p></div>
        <div className="module-stats">
          <div className="mini-stat"><span>Total Forms</span><strong>{forms.length}</strong></div>
          <div className="mini-stat"><span>Published</span><strong>{forms.filter((form) => form.status === 'Published').length}</strong></div>
          <div className="mini-stat"><span>Responses</span><strong>{Object.values(responseCounts).reduce((sum, count) => sum + count, 0)}</strong></div>
        </div>
      </div>

      <Card title="All Forms" subtitle="Create, publish, share, and review responses." action={<div className="card-action-group"><button className="pill primary-action" type="button" onClick={startCreate}>+ Create Form</button><ActionMenu label="Actions" items={[{ label: 'Create new form', description: 'Open the full form builder', onClick: startCreate }]} /></div>}>
        {forms.length ? (
          <div className="data-table adaptive-table" style={{ '--table-columns': 5 }}>
            <div className="table-head"><div>Form</div><div>Fields</div><div>Responses</div><div>Status</div><div>Updated</div><div /></div>
            {forms.map((form) => (
              <div className="data-row" key={form.id}>
                <div><strong>{form.title}</strong><div className="subtle form-row-slug">/public/forms/{form.slug}</div></div>
                <div>{form.fields.length}</div>
                <div>{responseCounts[form.id] ?? 0}</div>
                <div><Tag tone={form.status === 'Published' ? 'tag-contacted' : 'tag-follow'}>{form.status}</Tag></div>
                <div>{new Date(form.updatedAt ?? form.createdAt).toLocaleDateString('en-IN')}</div>
                <div>
                  <ActionMenu compact label={`Actions for ${form.title}`} items={[
                    { label: 'Edit form', onClick: () => startEdit(form) },
                    { label: 'Preview form', onClick: () => { setDraftForm(cloneForm(form)); setView('preview'); } },
                    { label: 'View responses', description: `${responseCounts[form.id] ?? 0} collected`, onClick: () => openResponses(form) },
                    { label: 'Copy public link', disabled: form.status !== 'Published', onClick: () => copyPublicLink(form) },
                    { label: 'Open public form', disabled: form.status !== 'Published', onClick: () => window.open(getPublicFormUrl(form), '_blank', 'noopener,noreferrer') },
                    { label: form.status === 'Published' ? 'Unpublish form' : 'Publish form', onClick: () => toggleStatus(form) },
                    { label: 'Duplicate form', onClick: () => duplicateForm(form) },
                    { label: 'Delete form', danger: true, onClick: () => deleteForm(form) },
                  ]} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty table-empty"><strong>No forms created yet.</strong><p>Create your first intake form, assessment, or registration form.</p><button className="pill primary-action" type="button" onClick={startCreate}>+ Create Form</button></div>
        )}
      </Card>
    </section>
  );
}

export function PublicFormPage() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, form: null, warning: '' });

  useEffect(() => {
    let active = true;
    loadPublicForm(slug).then((result) => {
      if (active) setState({ loading: false, form: result.form, warning: result.warning ?? '' });
    });
    return () => { active = false; };
  }, [slug]);

  return (
    <main className="public-form-page">
      <div className="public-form-brand"><span className="public-brand-mark" aria-hidden="true">M</span><span>Mom's Pathshala</span></div>
      <div className="public-form-card" style={{ '--form-accent': state.form?.accentColor ?? '#1f6b4a' }}>
        {state.loading ? (
          <div className="public-form-state"><strong>Loading form...</strong><p>Please wait a moment.</p></div>
        ) : state.form ? (
          <>
            <div className="public-form-title"><span>Public form</span><h1>{state.form.title}</h1><p>{state.form.description}</p></div>
            {state.warning && <div className="form-notice">The remote form service could not be reached. Local form data is shown.</div>}
            <FormRenderer form={state.form} />
          </>
        ) : (
          <div className="public-form-state"><strong>Form not found</strong><p>This link is invalid or the form is no longer available.</p></div>
        )}
      </div>
      <p className="public-form-footer">Powered by Mom's Pathshala</p>
    </main>
  );
}

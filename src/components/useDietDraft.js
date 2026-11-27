import { useRef, useState } from 'react';
import { getAuthSession } from '../data/auth.js';

export function dietDraftKey(branch, ...scope) {
  // Keep unfinished plans out of the cloud-synced storage namespaces.
  return `diet-draft:v1:${JSON.stringify([getAuthSession()?.email, branch, ...scope])}`;
}

export function clearDietDraft(key, form) {
  try {
    if (window.localStorage.getItem(key) === JSON.stringify(form)) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

export function useDietDraft() {
  const currentEditor = useRef(null);
  const [editor, setEditor] = useState(null);

  function open(key, initialForm) {
    let draft;
    try {
      const stored = JSON.parse(window.localStorage.getItem(key));
      if (Array.isArray(stored?.meals)) draft = stored;
    } catch {}
    const next = { key, form: draft ?? initialForm, status: draft ? 'Draft restored on this browser' : '' };
    currentEditor.current = next;
    setEditor(next);
  }

  function update(change) {
    const current = currentEditor.current;
    const form = change(current.form);
    if (form === current.form) return;
    let status = 'Draft saved on this browser';
    try {
      window.localStorage.setItem(current.key, JSON.stringify(form));
    } catch {
      status = 'Draft could not be saved. Keep this editor open until you save the plan.';
    }
    const next = { ...current, form, status };
    currentEditor.current = next;
    setEditor(next);
  }

  return { editor, open, update };
}

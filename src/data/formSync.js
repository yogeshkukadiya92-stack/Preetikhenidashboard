function updatedTime(form) {
  const value = new Date(form?.updatedAt ?? form?.createdAt ?? 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function mergeFormsById(localForms = [], remoteForms = []) {
  const forms = new Map();
  localForms.forEach((form) => {
    if (form?.id) forms.set(form.id, form);
  });
  remoteForms.forEach((form) => {
    if (!form?.id) return;
    const current = forms.get(form.id);
    if (!current || updatedTime(form) >= updatedTime(current)) forms.set(form.id, form);
  });
  return [...forms.values()].sort((left, right) => updatedTime(right) - updatedTime(left));
}

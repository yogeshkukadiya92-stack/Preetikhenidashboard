function parseRows(value) {
  try {
    const rows = JSON.parse(value);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function normalizeServiceRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const values = Array.isArray(row)
      ? row
      : row && typeof row === 'object'
        ? [row.Service ?? row.service ?? row.Name ?? row.name, row.Category ?? row.category, row.Duration ?? row.duration, row.Status ?? row.status]
        : [];
    const name = String(values[0] ?? '').trim();
    if (!name) return [];
    return [[name, values[1] ?? 'Clinic', values[2] ?? '30 min', values[3] ?? 'Active']];
  });
}

function mergeServiceRows(...groups) {
  const rowsByName = new Map();
  groups.flatMap(normalizeServiceRows).forEach((row) => {
    rowsByName.set(row[0].toLocaleLowerCase(), row);
  });
  return Array.from(rowsByName.values());
}

export function loadServiceCatalog({ key, isMainBranch, defaults = [], fallbackRows = [], storage = window.localStorage }) {
  const currentValue = storage.getItem(key);
  if (currentValue !== null) return normalizeServiceRows(parseRows(currentValue));

  const legacyRows = isMainBranch
    ? parseRows(storage.getItem('ayurflow:Services:rows:v2') ?? '[]')
    : [];
  const defaultRows = defaults.map((service) => [service, 'Clinic', '30 min', 'Active']);
  return mergeServiceRows(defaultRows, legacyRows, fallbackRows);
}

export function serviceNames(rows = []) {
  return normalizeServiceRows(rows)
    .filter((row) => !['inactive', 'disabled', 'deleted'].includes(String(row[3] ?? '').trim().toLowerCase()))
    .map((row) => row[0]);
}

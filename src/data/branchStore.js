// Older versions stored plain text; cloud hydration stores JSON strings.
export function readCurrentBranch(storage, branches) {
  let name = storage.getItem('moms-pathshala:current-branch:v1');
  for (let depth = 0; depth < 3 && typeof name === 'string'; depth += 1) {
    try {
      const decoded = JSON.parse(name);
      if (typeof decoded !== 'string') break;
      name = decoded;
    } catch { break; }
  }
  return branches.includes(name) ? name : branches[0] ?? 'Main Branch';
}

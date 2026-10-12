export function mayAccessKey(identity, key, write = false) {
  if (identity.isAdmin) return true;
  if (key === 'moms-pathshala:branches:v1') return !write;
  return key.startsWith(`moms-pathshala:${identity.branch}:`);
}

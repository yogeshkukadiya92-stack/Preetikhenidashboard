import { createContext, useContext, useMemo, useState } from 'react';

const BranchContext = createContext(null);
const SINGLE_BRANCH = 'Main Branch';
const BRANCHES_KEY = 'moms-pathshala:branches:v1';
const CURRENT_BRANCH_KEY = 'moms-pathshala:current-branch:v1';

function readBranches() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(BRANCHES_KEY) ?? 'null');
    return Array.isArray(saved) && saved.length ? saved : [SINGLE_BRANCH];
  } catch {
    return [SINGLE_BRANCH];
  }
}

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState(readBranches);
  const [currentBranch, setCurrentBranchState] = useState(() => window.localStorage.getItem(CURRENT_BRANCH_KEY) || SINGLE_BRANCH);
  const persistBranches = (next) => {
    window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(next));
    setBranches(next);
  };
  const setCurrentBranch = (branch) => {
    if (!branches.includes(branch)) return;
    window.localStorage.setItem(CURRENT_BRANCH_KEY, branch);
    setCurrentBranchState(branch);
  };
  const addBranch = (name) => {
    const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
    if (!clean || branches.some((branch) => branch.toLowerCase() === clean.toLowerCase())) return false;
    persistBranches([...branches, clean]);
    setCurrentBranch(clean);
    return true;
  };
  const renameBranch = (oldName, newName) => {
    const clean = String(newName ?? '').trim().replace(/\s+/g, ' ');
    if (!clean || !branches.includes(oldName) || branches.some((branch) => branch !== oldName && branch.toLowerCase() === clean.toLowerCase())) return false;
    persistBranches(branches.map((branch) => branch === oldName ? clean : branch));
    if (currentBranch === oldName) setCurrentBranch(clean);
    return true;
  };
  const deleteBranch = (name) => {
    if (branches.length === 1 || !branches.includes(name)) return false;
    const next = branches.filter((branch) => branch !== name);
    persistBranches(next);
    if (currentBranch === name) setCurrentBranch(next[0]);
    return true;
  };
  const value = useMemo(() => ({ branches, currentBranch, setCurrentBranch, addBranch, renameBranch, deleteBranch, branchKey: (key) => `moms-pathshala:${currentBranch}:${key}` }), [branches, currentBranch]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch must be used within BranchProvider');
  return context;
}

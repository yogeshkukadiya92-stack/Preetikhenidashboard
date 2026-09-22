import { createContext, Fragment, useContext, useEffect, useMemo, useState } from 'react';
import { readCurrentBranch } from '../data/branchStore.js';
import { getAuthSession } from '../data/auth.js';

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
  const session = getAuthSession();
  const isBranchLocked = Boolean(session && !session.isAdmin && session.branch);
  const lockedBranch = isBranchLocked ? session.branch : null;

  const [branches, setBranches] = useState(readBranches);
  const [currentBranch, setCurrentBranchState] = useState(() => {
    if (lockedBranch) return lockedBranch;
    return readCurrentBranch(window.localStorage, readBranches());
  });

  useEffect(() => {
    const currentSession = getAuthSession();
    if (currentSession && !currentSession.isAdmin && currentSession.branch) {
      setCurrentBranchState(currentSession.branch);
      window.localStorage.setItem(CURRENT_BRANCH_KEY, JSON.stringify(currentSession.branch));
    }
  }, [session?.email, session?.branch]);

  const persistBranches = (next) => {
    window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(next));
    setBranches(next);
  };

  const selectBranch = (branch) => {
    window.localStorage.setItem(CURRENT_BRANCH_KEY, JSON.stringify(branch));
    setCurrentBranchState(branch);
  };

  const setCurrentBranch = (branch) => {
    const currentSession = getAuthSession();
    if (currentSession && !currentSession.isAdmin && currentSession.branch) {
      // Branch user cannot switch branches
      return;
    }
    if (branches.includes(branch)) selectBranch(branch);
  };

  const addBranch = (name) => {
    const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
    if (!clean || branches.some((branch) => branch.toLowerCase() === clean.toLowerCase())) return false;
    persistBranches([...branches, clean]);
    selectBranch(clean);
    return true;
  };

  const renameBranch = (oldName, newName) => {
    const clean = String(newName ?? '').trim().replace(/\s+/g, ' ');
    if (!clean || !branches.includes(oldName) || branches.some((branch) => branch !== oldName && branch.toLowerCase() === clean.toLowerCase())) return false;
    persistBranches(branches.map((branch) => branch === oldName ? clean : branch));
    if (currentBranch === oldName) selectBranch(clean);
    return true;
  };

  const deleteBranch = (name) => {
    if (branches.length === 1 || !branches.includes(name)) return false;
    const next = branches.filter((branch) => branch !== name);
    persistBranches(next);
    if (currentBranch === name) setCurrentBranch(next[0]);
    return true;
  };

  const effectiveBranch = lockedBranch || currentBranch;

  const value = useMemo(() => ({
    branches,
    currentBranch: effectiveBranch,
    isBranchLocked,
    setCurrentBranch,
    addBranch,
    renameBranch,
    deleteBranch,
    branchKey: (key) => `moms-pathshala:${effectiveBranch}:${key}`,
  }), [branches, effectiveBranch, isBranchLocked]);

  return <BranchContext.Provider value={value}><Fragment key={effectiveBranch}>{children}</Fragment></BranchContext.Provider>;
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch must be used within BranchProvider');
  return context;
}

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const BranchContext = createContext(null);
const BRANCHES_KEY = 'moms-pathshala:branches:v1';
const CURRENT_BRANCH_KEY = 'moms-pathshala:current-branch:v1';

function loadSavedArray(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : fallback;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadSavedValue(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

export function BranchProvider({ children }) {
  const hasMountedBranches = useRef(false);
  const hasMountedCurrentBranch = useRef(false);
  const [branches, setBranches] = useState(() => {
    const saved = loadSavedArray(BRANCHES_KEY, []);
    return saved.length ? saved : ['Main Branch'];
  });
  const [currentBranch, setCurrentBranch] = useState(() => loadSavedValue(CURRENT_BRANCH_KEY, 'Main Branch'));

  useEffect(() => {
    if (!branches.includes(currentBranch)) {
      setCurrentBranch(branches[0] ?? 'Main Branch');
    }
  }, [branches, currentBranch]);

  useEffect(() => {
    if (!hasMountedBranches.current) {
      hasMountedBranches.current = true;
      return;
    }
    try {
      window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
    } catch {}
  }, [branches]);

  useEffect(() => {
    if (!hasMountedCurrentBranch.current) {
      hasMountedCurrentBranch.current = true;
      return;
    }
    try {
      window.localStorage.setItem(CURRENT_BRANCH_KEY, JSON.stringify(currentBranch));
    } catch {}
  }, [currentBranch]);

  const value = useMemo(() => ({
    branches,
    currentBranch,
    setCurrentBranch,
    addBranch: (name) => {
      const branchName = name.trim();
      if (!branchName) return false;
      setBranches((current) => (current.includes(branchName) ? current : [...current, branchName]));
      setCurrentBranch(branchName);
      return true;
    },
    renameBranch: (oldName, nextName) => {
      const branchName = nextName.trim();
      if (!branchName || oldName === branchName) return false;
      setBranches((current) => current.map((branch) => (branch === oldName ? branchName : branch)));
      setCurrentBranch((current) => (current === oldName ? branchName : current));
      return true;
    },
    deleteBranch: (name) => {
      setBranches((current) => {
        const nextBranches = current.filter((branch) => branch !== name);
        if (!nextBranches.length) return ['Main Branch'];
        return nextBranches;
      });
      setCurrentBranch((current) => (current === name ? 'Main Branch' : current));
    },
    branchKey: (key) => `moms-pathshala:${currentBranch}:${key}`,
  }), [branches, currentBranch]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch must be used within BranchProvider');
  return context;
}

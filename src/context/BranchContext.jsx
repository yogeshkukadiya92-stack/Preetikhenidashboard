import { createContext, useContext, useMemo } from 'react';

const BranchContext = createContext(null);
const SINGLE_BRANCH = 'Main Branch';

function sharedKey(key) {
  return `moms-pathshala:${SINGLE_BRANCH}:${key}`;
}

export function BranchProvider({ children }) {
  const value = useMemo(() => ({
    branches: [SINGLE_BRANCH],
    currentBranch: SINGLE_BRANCH,
    setCurrentBranch: () => {},
    addBranch: () => false,
    renameBranch: () => false,
    deleteBranch: () => {},
    branchKey: sharedKey,
  }), []);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch must be used within BranchProvider');
  return context;
}

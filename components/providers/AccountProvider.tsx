'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AccountContextType {
  activeAccountId: string | null;
  setActiveAccountId: (accountId: string | null) => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);

  // Load active account from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('activeAccountId');
    if (stored) {
      setActiveAccountIdState(stored);
    }
  }, []);

  // Persist active account to localStorage
  useEffect(() => {
    if (activeAccountId) {
      localStorage.setItem('activeAccountId', activeAccountId);
    } else {
      localStorage.removeItem('activeAccountId');
    }
  }, [activeAccountId]);

  const setActiveAccountId = (accountId: string | null) => {
    setActiveAccountIdState(accountId);
  };

  return (
    <AccountContext.Provider
      value={{
        activeAccountId,
        setActiveAccountId,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccounts() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccounts must be used within an AccountProvider');
  }
  return context;
}

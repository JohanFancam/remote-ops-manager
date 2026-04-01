import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin';
  const isAccounts = user?.role === 'accounts';
  // Level 1 = full access, Level 2 = restricted
  const adminLevel = isAdmin ? (user?.admin_level ?? 1) : null;
  const isLevel1Admin = isAdmin && adminLevel === 1;
  const isLevel2Admin = isAdmin && adminLevel === 2;

  return (
    <AppContext.Provider value={{ user, isAdmin, isAccounts, isLevel1Admin, isLevel2Admin, adminLevel, isLoading }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
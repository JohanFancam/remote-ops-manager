import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { THEME_COLORS } from './ThemeProvider';

const HouseholdContext = createContext(null);

export function HouseholdProvider({ children }) {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  
  const { data: households = [], isLoading: loadingHouseholds } = useQuery({
    queryKey: ['households'],
    queryFn: () => base44.entities.Household.list(),
    enabled: !!user,
  });
  
  // Find household user owns or is shared with
  const household = households.find(h => 
    h.owner_email === user?.email || h.shared_with?.includes(user?.email)
  );
  
  const isLoading = loadingUser || loadingHouseholds;
  
  // Auto-create household for new users
  useEffect(() => {
    if (!isLoading && user && !household && households.length === 0) {
      createHousehold();
    }
  }, [isLoading, user, household, households]);
  
  const createHousehold = async () => {
        await base44.entities.Household.create({
          name: `${user.full_name || 'My'} Budget`,
          owner_email: user.email,
          shared_with: [],
          theme: 'slate',
          default_income_day: 25,
          default_expense_day: 1,
          show_tutorial: true,
          logo_icon: 'home'
        });
        queryClient.invalidateQueries({ queryKey: ['households'] });
      };
  
  const updateHousehold = async (data) => {
    if (household) {
      await base44.entities.Household.update(household.id, data);
      queryClient.invalidateQueries({ queryKey: ['households'] });
    }
  };
  
  const toggleTutorial = async () => {
    if (household) {
      await updateHousehold({ show_tutorial: !household.show_tutorial });
    }
  };
  
  // Get current month (auto-advances with real calendar)
  const getCurrentMonth = () => format(new Date(), 'yyyy-MM');
  
  // Get default date for income (25th by default)
  const getDefaultIncomeDate = (month) => {
    const day = household?.default_income_day || 25;
    const [year, monthNum] = month.split('-');
    return `${year}-${monthNum}-${String(day).padStart(2, '0')}`;
  };
  
  // Get default date for expenses (1st by default)
  const getDefaultExpenseDate = (month) => {
    const day = household?.default_expense_day || 1;
    const [year, monthNum] = month.split('-');
    return `${year}-${monthNum}-${String(day).padStart(2, '0')}`;
  };
  
  const themeName = household?.theme || 'slate';
      const themeColors = THEME_COLORS[themeName] || THEME_COLORS.slate;

      const value = {
        user,
        household,
        householdId: household?.id,
        isOwner: household?.owner_email === user?.email,
        isLoading,
        showTutorial: household?.show_tutorial ?? true,
        toggleTutorial,
        updateHousehold,
        getCurrentMonth,
        getDefaultIncomeDate,
        getDefaultExpenseDate,
        theme: themeName,
        themeColors,
        logoUrl: household?.logo_url,
        logoIcon: household?.logo_icon || 'home',
      };
  
  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used within HouseholdProvider');
  }
  return context;
}
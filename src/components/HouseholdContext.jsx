import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, subMonths } from 'date-fns';
import { THEMES } from './ThemeProvider';

const HouseholdContext = createContext(null);

const DEFAULT_FEATURES = {
  investments: false,
  household_goals: false,
  projections: false,
  debt: false,
  unforeseen_expenses: false,
  user_activity: false,
};

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
  const isOwner = household?.owner_email === user?.email;
  
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
      dark_mode: false,
      default_income_day: 25,
      default_expense_day: 1,
      show_tutorial: true,
      logo_icon: 'home',
      features_enabled: DEFAULT_FEATURES
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
  
  const toggleDarkMode = async () => {
    if (household) {
      await updateHousehold({ dark_mode: !household.dark_mode });
    }
  };
  
  const updateFeatures = async (features) => {
    if (household) {
      await updateHousehold({ features_enabled: { ...household.features_enabled, ...features } });
    }
  };
  
  // Get effective features (considering personal overrides for shared users)
  const getEffectiveFeatures = () => {
    const householdFeatures = household?.features_enabled || DEFAULT_FEATURES;
    const personalFeatures = user?.personal_features;
    
    if (!personalFeatures || isOwner) {
      return householdFeatures;
    }
    
    // For shared users, personal settings can only turn OFF features that are ON
    return {
      investments: personalFeatures.investments !== false && householdFeatures.investments,
      household_goals: personalFeatures.household_goals !== false && householdFeatures.household_goals,
      projections: personalFeatures.projections !== false && householdFeatures.projections,
      debt: personalFeatures.debt !== false && householdFeatures.debt,
      unforeseen_expenses: personalFeatures.unforeseen_expenses !== false && householdFeatures.unforeseen_expenses,
      user_activity: personalFeatures.user_activity !== false && householdFeatures.user_activity,
    };
  };
  
  // Get current month (auto-advances with real calendar)
  const getCurrentMonth = () => format(new Date(), 'yyyy-MM');
  
  // Get default date for income (25th of PREVIOUS month)
  const getDefaultIncomeDate = (month) => {
    const day = household?.default_income_day || 25;
    const [year, monthNum] = month.split('-');
    const currentDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const prevMonth = subMonths(currentDate, 1);
    return format(prevMonth, `yyyy-MM-${String(day).padStart(2, '0')}`);
  };
  
  // Get default date for expenses (1st of current month)
  const getDefaultExpenseDate = (month) => {
    const day = household?.default_expense_day || 1;
    const [year, monthNum] = month.split('-');
    return `${year}-${monthNum}-${String(day).padStart(2, '0')}`;
  };
  
  const darkMode = household?.dark_mode || false;
  const themeColors = darkMode ? THEMES.dark : THEMES.light;
  const features = getEffectiveFeatures();

  const value = {
    user,
    household,
    householdId: household?.id,
    isOwner,
    isLoading,
    showTutorial: household?.show_tutorial ?? true,
    toggleTutorial,
    updateHousehold,
    getCurrentMonth,
    getDefaultIncomeDate,
    getDefaultExpenseDate,
    darkMode,
    toggleDarkMode,
    themeColors,
    features,
    updateFeatures,
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
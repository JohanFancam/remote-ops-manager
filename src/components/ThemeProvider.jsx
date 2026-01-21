import React, { createContext, useContext } from 'react';

export const THEME_COLORS = {
  slate: {
    primary: 'bg-slate-800',
    primaryHover: 'hover:bg-slate-700',
    accent: 'bg-slate-600',
    accentHover: 'hover:bg-slate-500',
    text: 'text-slate-800',
    textLight: 'text-slate-600',
    border: 'border-slate-200',
    activeBg: 'bg-slate-100',
    cardHeader: 'bg-slate-800',
    cardFooter: 'bg-slate-800',
    button: 'bg-slate-800 hover:bg-slate-700',
    gradient: 'from-slate-500 to-slate-600',
  },
  blue: {
    primary: 'bg-blue-700',
    primaryHover: 'hover:bg-blue-600',
    accent: 'bg-blue-500',
    accentHover: 'hover:bg-blue-400',
    text: 'text-blue-700',
    textLight: 'text-blue-600',
    border: 'border-blue-200',
    activeBg: 'bg-blue-50',
    cardHeader: 'bg-blue-700',
    cardFooter: 'bg-blue-700',
    button: 'bg-blue-700 hover:bg-blue-600',
    gradient: 'from-blue-500 to-blue-600',
  },
  green: {
    primary: 'bg-emerald-700',
    primaryHover: 'hover:bg-emerald-600',
    accent: 'bg-emerald-500',
    accentHover: 'hover:bg-emerald-400',
    text: 'text-emerald-700',
    textLight: 'text-emerald-600',
    border: 'border-emerald-200',
    activeBg: 'bg-emerald-50',
    cardHeader: 'bg-emerald-700',
    cardFooter: 'bg-emerald-700',
    button: 'bg-emerald-700 hover:bg-emerald-600',
    gradient: 'from-emerald-500 to-emerald-600',
  },
  purple: {
    primary: 'bg-purple-700',
    primaryHover: 'hover:bg-purple-600',
    accent: 'bg-purple-500',
    accentHover: 'hover:bg-purple-400',
    text: 'text-purple-700',
    textLight: 'text-purple-600',
    border: 'border-purple-200',
    activeBg: 'bg-purple-50',
    cardHeader: 'bg-purple-700',
    cardFooter: 'bg-purple-700',
    button: 'bg-purple-700 hover:bg-purple-600',
    gradient: 'from-purple-500 to-purple-600',
  },
  rose: {
    primary: 'bg-rose-700',
    primaryHover: 'hover:bg-rose-600',
    accent: 'bg-rose-500',
    accentHover: 'hover:bg-rose-400',
    text: 'text-rose-700',
    textLight: 'text-rose-600',
    border: 'border-rose-200',
    activeBg: 'bg-rose-50',
    cardHeader: 'bg-rose-700',
    cardFooter: 'bg-rose-700',
    button: 'bg-rose-700 hover:bg-rose-600',
    gradient: 'from-rose-500 to-rose-600',
  },
};

const ThemeContext = createContext(THEME_COLORS.slate);

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ themeName = 'slate', children }) {
  const theme = THEME_COLORS[themeName] || THEME_COLORS.slate;
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}
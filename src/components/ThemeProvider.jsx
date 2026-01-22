import React, { createContext, useContext } from 'react';

// Dark and Light theme definitions
export const THEMES = {
  light: {
    name: 'light',
    bg: 'bg-slate-50',
    cardBg: 'bg-white',
    cardHeader: 'bg-slate-800',
    cardFooter: 'bg-slate-800',
    accent: 'bg-slate-600',
    text: 'text-slate-800',
    textMuted: 'text-slate-500',
    border: 'border-slate-200',
    primaryHover: 'hover:bg-slate-700',
    accentHover: 'hover:bg-slate-500',
    gradient: 'from-emerald-500 to-teal-600',
    inputBg: 'bg-white',
    hoverBg: 'hover:bg-slate-50',
    divider: 'divide-slate-100',
    headerBg: 'bg-slate-100',
  },
  dark: {
    name: 'dark',
    bg: 'bg-slate-900',
    cardBg: 'bg-slate-800',
    cardHeader: 'bg-slate-950',
    cardFooter: 'bg-slate-950',
    accent: 'bg-slate-700',
    text: 'text-slate-100',
    textMuted: 'text-slate-400',
    border: 'border-slate-700',
    primaryHover: 'hover:bg-slate-800',
    accentHover: 'hover:bg-slate-600',
    gradient: 'from-emerald-600 to-teal-700',
    inputBg: 'bg-slate-700',
    hoverBg: 'hover:bg-slate-700',
    divider: 'divide-slate-700',
    headerBg: 'bg-slate-700',
  }
};

// Keep old THEME_COLORS for backwards compatibility during migration
export const THEME_COLORS = {
  slate: THEMES.light,
  blue: THEMES.light,
  green: THEMES.light,
  purple: THEMES.light,
  rose: THEMES.light,
};

const ThemeContext = createContext(THEMES.light);

export function ThemeProvider({ children, darkMode = false }) {
  const theme = darkMode ? THEMES.dark : THEMES.light;
  
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
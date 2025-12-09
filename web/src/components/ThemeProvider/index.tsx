//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

/**
 * Theme Provider Component
 *
 * Provides dark/light theme context to the application
 * with persistence to localStorage.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export enum ThemeEnum {
  Dark = 'dark',
  Light = 'light',
}

const THEME_STORAGE_KEY = 'ragflow_admin_theme';

interface ThemeProviderState {
  theme: ThemeEnum;
  setTheme: (theme: ThemeEnum) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeEnum;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = ThemeEnum.Light,
}) => {
  const [theme, setThemeState] = useState<ThemeEnum>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return (stored as ThemeEnum) || defaultTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(ThemeEnum.Light, ThemeEnum.Dark);
    root.classList.add(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeEnum) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === ThemeEnum.Dark ? ThemeEnum.Light : ThemeEnum.Dark));
  }, []);

  const value: ThemeProviderState = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === ThemeEnum.Dark,
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
};

export const useTheme = (): ThemeProviderState => {
  const context = useContext(ThemeProviderContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const useIsDarkTheme = (): boolean => {
  const { isDark } = useTheme();
  return isDark;
};

export default ThemeProvider;

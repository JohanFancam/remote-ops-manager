import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api, getToken } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const checkAppState = useCallback(async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      try {
        const publicSettings = await fetch('/api/public-settings').then(async (res) => {
          if (!res.ok) throw new Error('Failed to load public settings');
          return res.json();
        });
        setAppPublicSettings(publicSettings);

        const token = getToken();
        if (token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        setAuthError({
          type: 'unknown',
          message: appError.message || 'Failed to load app',
        });
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred',
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  }, []);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setUser(null);
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      }
    }
  };

  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  const login = async (email, password) => {
    const currentUser = await api.auth.login(email, password);
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return currentUser;
  };

  const changePassword = async ({ current_password, new_password }) => {
    const updated = await api.auth.changePassword({ current_password, new_password });
    setUser(updated);
    return updated;
  };

  const register = async ({ email, password, full_name }) => {
    const currentUser = await api.auth.register({ email, password, full_name });
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthError(null);
    return currentUser;
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setIsLoadingAuth(false);
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
    api.auth.logout(false);
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin();
  };

  const refreshPublicSettings = useCallback(async () => {
    try {
      const publicSettings = await fetch('/api/public-settings').then(async (res) => {
        if (!res.ok) throw new Error('Failed to load public settings');
        return res.json();
      });
      setAppPublicSettings(publicSettings);
    } catch (error) {
      console.error('Public settings refresh failed:', error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        login,
        register,
        changePassword,
        logout,
        navigateToLogin,
        checkAppState,
        refreshPublicSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

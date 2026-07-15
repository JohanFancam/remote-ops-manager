import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);

/** Frontend permission mirrors — server still enforces. */
const ROLE_PERMS = {
  admin: new Set([
    'dashboard:ops',
    'calendar:ops',
    'user:manage',
    'settings:manage',
    'dashboard:accounts',
    'pay:view_all',
  ]),
  operator: new Set(['dashboard:ops', 'calendar:ops', 'pay:view_own', 'avail:own']),
  accounts: new Set(['dashboard:accounts', 'pay:view_all', 'pay:settle']),
};

export function can(user, permission) {
  if (!user) return false;
  return ROLE_PERMS[user.role]?.has(permission) === true;
}

export function homePath(user) {
  if (!user) return '/login';
  if (user.role === 'accounts') return '/accounts';
  return '/dashboard';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const beat = () => api('/presence/heartbeat', { method: 'POST' }).catch(() => {});
    beat();
    const id = setInterval(beat, 60000);
    return () => clearInterval(id);
  }, [user]);

  async function login(email, password) {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
      token: null,
    });
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can: (p) => can(user, p) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

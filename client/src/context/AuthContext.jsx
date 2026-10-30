import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api from '../lib/api.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'buildstock.token';
const USER_KEY = 'buildstock.user';

function readUser() {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);
  const [loading, setLoading] = useState(Boolean(window.localStorage.getItem(TOKEN_KEY)));

  const persist = useCallback((token, nextUser) => {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.data);
        window.localStorage.setItem(USER_KEY, JSON.stringify(res.data.data));
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback(
    async (email, password) => {
      const res = await api.post('/auth/login', { email, password });
      persist(res.data.data.token, res.data.data.user);
      return res.data.data.user;
    },
    [persist]
  );

  const setup = useCallback(
    async (payload) => {
      const res = await api.post('/auth/setup', payload);
      persist(res.data.data.token, res.data.data.user);
      return res.data.data.user;
    },
    [persist]
  );

  const hasPermission = useCallback(
    (permission) => Boolean(user?.permissions?.includes(permission)),
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, setup, hasPermission, isAuthenticated: Boolean(user) }),
    [user, loading, login, logout, setup, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default AuthProvider;


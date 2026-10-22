import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadReferenceData = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [
        api.get('/branches').then((r) => setBranches(r.data.data || [])).catch(() => setBranches([])),
        api.get('/products/categories').then((r) => setCategories(r.data.data || [])).catch(() => setCategories([])),
        api.get('/products/units').then((r) => setUnits(r.data.data || [])).catch(() => setUnits([])),
        api.get('/customers?limit=200').then((r) => setCustomers(r.data.data || [])).catch(() => setCustomers([])),
        api.get('/suppliers?limit=200').then((r) => setSuppliers(r.data.data || [])).catch(() => setSuppliers([])),
      ];
      await Promise.all(requests);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings/branding');
      setSettings(res.data.data);
    } catch {
      /* branding is optional */
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (isAuthenticated) {
      loadReferenceData();
    } else {
      setBranches([]);
      setCategories([]);
      setUnits([]);
      setCustomers([]);
      setSuppliers([]);
    }
  }, [isAuthenticated, user?.role, loadReferenceData]);

  const defaultBranch = useMemo(() => {
    if (!branches.length) return null;
    return branches.find((b) => b.isDefault) || branches[0];
  }, [branches]);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      branches,
      categories,
      units,
      customers,
      suppliers,
      defaultBranch,
      loading,
      refreshReferenceData: loadReferenceData,
      refreshSettings: loadSettings,
      currency: settings?.currency || 'ETB',
      ethiopicCalendar: settings?.ethiopicCalendar ?? true,
    }),
    [settings, branches, categories, units, customers, suppliers, defaultBranch, loading, loadReferenceData, loadSettings]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export default AppProvider;

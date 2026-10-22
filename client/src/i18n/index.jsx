import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import en from './en.js';
import am from './am.js';

const MESSAGES = { en, am };

const I18nContext = createContext(null);
const STORAGE_KEY = 'buildstock.locale';

function detectLocale() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && MESSAGES[stored]) return stored;
  } catch {
    /* ignore */
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en';
  return browser.toLowerCase().startsWith('am') ? 'am' : 'en';
}

function resolve(messages, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), messages);
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (!MESSAGES[next]) return;
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (path, vars) => {
      const message = resolve(MESSAGES[locale], path) ?? resolve(MESSAGES.en, path) ?? path;
      if (typeof message !== 'string') return path;
      if (!vars) return message;
      return message.replace(/\{(\w+)\}/g, (match, key) =>
        vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : match
      );
    },
    [locale]
  );

  /** Pick the Amharic field when the interface is in Amharic and a value exists. */
  const pick = useCallback(
    (english, amharic) => {
      if (locale === 'am' && amharic) return amharic;
      return english || amharic || '';
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, pick, isAmharic: locale === 'am' }),
    [locale, setLocale, t, pick]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export default I18nProvider;

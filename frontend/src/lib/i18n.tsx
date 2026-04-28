'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import thMessages from '@/messages/th.json';
import enMessages from '@/messages/en.json';

export type Locale = 'th' | 'en';

const messages: Record<Locale, Record<string, Record<string, string>>> = {
  th: thMessages,
  en: enMessages,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const COOKIE_NAME = 'app-locale';

function readCookieLocale(): Locale {
  if (typeof document === 'undefined') return 'th';
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const value = match?.[1];
  return value === 'en' || value === 'th' ? value : 'th';
}

function writeCookieLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  // 1 year
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('th');

  // Hydrate from cookie on mount
  useEffect(() => {
    setLocaleState(readCookieLocale());
  }, []);

  const setLocale = useCallback((next: Locale) => {
    writeCookieLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      // key format: "nav.dashboard"
      const parts = key.split('.');
      if (parts.length !== 2) return fallback ?? key;
      const [section, name] = parts;
      const sectionMap = messages[locale]?.[section];
      const value = sectionMap?.[name];
      if (value) return value;
      // Fallback to other locale
      const otherLocale: Locale = locale === 'th' ? 'en' : 'th';
      const otherValue = messages[otherLocale]?.[section]?.[name];
      return otherValue ?? fallback ?? key;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Shorthand for translation only */
export function useT() {
  return useI18n().t;
}

'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import thMessages from '@/messages/th.json';
import enMessages from '@/messages/en.json';

export type Locale = 'th' | 'en';

// Allow nested message objects (any depth)
type MessageValue = string | { [key: string]: MessageValue };
type MessageTree = Record<string, MessageValue>;

const messages: Record<Locale, MessageTree> = {
  th: thMessages as MessageTree,
  en: enMessages as MessageTree,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const COOKIE_NAME = 'preferred-lang';

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : undefined;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; samesite=lax`;
}

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale = 'th' }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const saved = getCookie(COOKIE_NAME) as Locale | undefined;
    if (saved && (saved === 'th' || saved === 'en')) setLocaleState(saved);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setCookie(COOKIE_NAME, next);
  }, []);

  const t = useCallback(
    (key: string): string => {
      // Walk nested keys: "permissions.groups.quotation"
      const segs = key.split('.');
      let cur: MessageValue | undefined = messages[locale];
      for (const seg of segs) {
        if (cur && typeof cur === 'object') {
          cur = cur[seg];
        } else {
          cur = undefined;
          break;
        }
      }
      return typeof cur === 'string' ? cur : key;
    },
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useT(): (key: string) => string {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx.t;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
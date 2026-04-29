'use client';

import { Languages } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export function LangSwitcher() {
  const { locale, setLocale } = useI18n();

  const toggle = () => {
    setLocale(locale === 'th' ? 'en' : 'th');
  };

  return (
    <button
      onClick={toggle}
      className="relative h-9 w-9 rounded-md hover:bg-accent flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
      title={`Switch to ${locale === 'th' ? 'English' : 'ไทย'}`}
      aria-label="Toggle language"
    >
      <Languages className="h-4 w-4" />
      <span className="absolute -bottom-0.5 -right-0.5 text-[9px] font-bold bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded px-1 py-0 leading-tight shadow-md">
        {locale.toUpperCase()}
      </span>
    </button>
  );
}
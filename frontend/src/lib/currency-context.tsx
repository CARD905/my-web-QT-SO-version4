'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { formatMoney } from '@/lib/utils';

export interface CxValue {
  currency: 'THB' | 'USD';
  rate: number;
  setCurrency: (c: 'THB' | 'USD') => void;
  setRate: (r: number) => void;
  conv: (thb: number) => number;
  fmt: (thb: number) => string;
  short: (thb: number) => string;
  sym: string;
}

const CurrencyCtx = createContext<CxValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<'THB' | 'USD'>('THB');
  const [rate, setRate] = useState(35);

  const conv = useCallback(
    (thb: number) => (currency === 'USD' ? thb / rate : thb),
    [currency, rate],
  );

  const fmt = useCallback(
    (thb: number) => formatMoney(conv(thb), currency),
    [conv, currency],
  );

  const short = useCallback(
    (thb: number) => {
      const v = conv(thb);
      const abs = Math.abs(v);
      if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
      return v.toFixed(0);
    },
    [conv],
  );

  const sym = currency === 'USD' ? '$' : '฿';

  const value = useMemo(
    () => ({ currency, rate, setCurrency, setRate, conv, fmt, short, sym }),
    [currency, rate, conv, fmt, short, sym],
  );

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export function useCx(): CxValue {
  const ctx = useContext(CurrencyCtx);
  if (!ctx) {
    // Safe fallback when used outside provider
    const conv = (v: number) => v;
    return {
      currency: 'THB', rate: 35,
      setCurrency: () => {}, setRate: () => {},
      conv,
      fmt: (v) => formatMoney(v, 'THB'),
      short: (v) => {
        const abs = Math.abs(v);
        if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
        return v.toFixed(0);
      },
      sym: '฿',
    };
  }
  return ctx;
}

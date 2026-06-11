'use client';

import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCx } from '@/lib/currency-context';

export function CurrencyToggleBar({ className }: { className?: string }) {
  const { currency, rate, setCurrency, setRate } = useCx();
  const [fetching, setFetching] = useState(false);

  const fetchLiveRate = async () => {
    setFetching(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      if (data.rates?.THB) setRate(Math.round(data.rates.THB * 100) / 100);
    } catch {
      // keep current rate silently
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {/* THB / USD pill toggle */}
      <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border border-border/50 shrink-0">
        <button
          onClick={() => setCurrency('THB')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap',
            currency === 'THB'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          🇹🇭 THB
        </button>
        <button
          onClick={() => setCurrency('USD')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap',
            currency === 'USD'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          🇺🇸 USD
        </button>
      </div>

      {/* Exchange rate input — visible only in USD mode */}
      {currency === 'USD' && (
        <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="flex items-center h-7 rounded-lg border border-input bg-background overflow-hidden shrink-0">
            <span className="px-2 text-[10px] text-muted-foreground font-medium border-r border-border whitespace-nowrap">
              1 USD =
            </span>
            <input
              type="number"
              min="1"
              step="0.5"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value) || 35)}
              className="w-16 px-2 text-xs font-mono text-right bg-transparent focus:outline-none"
            />
            <span className="px-2 text-[10px] text-muted-foreground font-medium border-l border-border">
              THB
            </span>
          </div>
          <button
            onClick={fetchLiveRate}
            disabled={fetching}
            title="ดึงอัตราแลกเปลี่ยนปัจจุบัน"
            className="h-7 w-7 flex items-center justify-center rounded-lg border border-input bg-background hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
          >
            {fetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </button>
          <div className="hidden sm:flex items-center px-2 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-[10px] font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
            ÷ {rate}
          </div>
        </div>
      )}
    </div>
  );
}

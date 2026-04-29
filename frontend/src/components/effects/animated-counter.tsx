'use client';

import { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  /** Optional formatter: e.g. (n) => n.toLocaleString() */
  format?: (n: number) => string;
  /** Decimal places to show */
  decimals?: number;
}

export function AnimatedCounter({
  value,
  duration = 1200,
  format,
  decimals = 0,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const initial = display;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = initial + (value - initial) * eased;
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const text = format
    ? format(display)
    : decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString();

  return <span>{text}</span>;
}
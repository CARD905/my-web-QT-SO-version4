'use client';

import { useRef, MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  /** Add subtle 3D tilt on mouse move */
  tilt?: boolean;
  /** Show gradient border on hover */
  glow?: boolean;
}

export function GlassCard({ children, className, tilt = true, glow = true }: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!tilt || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rx = ((y - cy) / cy) * -3;
    const ry = ((x - cx) / cx) * 3;
    ref.current.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    ref.current.style.setProperty('--mx', `${(x / rect.width) * 100}%`);
    ref.current.style.setProperty('--my', `${(y / rect.height) * 100}%`);
  };

  const handleLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn(
        'relative rounded-2xl border border-white/10 bg-white/40 dark:bg-black/30 backdrop-blur-xl shadow-xl transition-transform duration-200 ease-out',
        glow &&
          'before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-[radial-gradient(circle_at_var(--mx,_50%)_var(--my,_50%),hsl(var(--primary))_0%,transparent_60%)] before:opacity-0 hover:before:opacity-100 before:-z-10 before:transition-opacity before:duration-300',
        className,
      )}
    >
      {children}
    </div>
  );
}
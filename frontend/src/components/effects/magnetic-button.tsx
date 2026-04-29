'use client';

import { useRef, MouseEvent, ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** How strong the magnet effect is (default 0.3) */
  strength?: number;
}

export function MagneticButton({
  children,
  className,
  strength = 0.3,
  ...rest
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    ref.current.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  };

  const handleLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = 'translate(0, 0)';
  };

  return (
    <button
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn('transition-transform duration-200 ease-out', className)}
      {...rest}
    >
      {children}
    </button>
  );
}
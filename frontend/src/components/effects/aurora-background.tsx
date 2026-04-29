'use client';

import { useEffect, useRef } from 'react';

interface AuroraProps {
  /** Color theme — defaults to blue/purple */
  variant?: 'default' | 'manager' | 'approver' | 'admin';
}

export function AuroraBackground({ variant = 'default' }: AuroraProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    let t = 0;
    const animate = () => {
      t += 0.003;
      if (ref.current) {
        const x1 = 50 + Math.sin(t) * 20;
        const y1 = 30 + Math.cos(t * 0.7) * 15;
        const x2 = 70 + Math.cos(t * 0.9) * 25;
        const y2 = 70 + Math.sin(t * 1.1) * 20;
        ref.current.style.setProperty('--x1', `${x1}%`);
        ref.current.style.setProperty('--y1', `${y1}%`);
        ref.current.style.setProperty('--x2', `${x2}%`);
        ref.current.style.setProperty('--y2', `${y2}%`);
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  const colors = {
    default: { c1: '99, 102, 241', c2: '168, 85, 247' }, // indigo + purple
    manager: { c1: '245, 158, 11', c2: '249, 115, 22' }, // amber + orange
    approver: { c1: '168, 85, 247', c2: '236, 72, 153' }, // purple + pink
    admin: { c1: '244, 63, 94', c2: '239, 68, 68' }, // rose + red
  }[variant];

  return (
    <div
      ref={ref}
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={
        {
          background: `
            radial-gradient(ellipse 800px 600px at var(--x1, 50%) var(--y1, 30%), rgba(${colors.c1}, 0.15), transparent 60%),
            radial-gradient(ellipse 600px 800px at var(--x2, 70%) var(--y2, 70%), rgba(${colors.c2}, 0.12), transparent 60%)
          `,
          transition: 'background 0.5s ease',
        } as React.CSSProperties
      }
    />
  );
}
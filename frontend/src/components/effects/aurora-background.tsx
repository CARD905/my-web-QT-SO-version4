'use client';

import { useEffect, useRef } from 'react';

interface AuroraProps {
  variant?: 'default' | 'manager' | 'approver' | 'admin';
}

// ─── สีตาม role — vibrant ทั้ง light/dark ─────────────────────────────────
const VARIANT_COLORS = {
  default: {
    c1: '99, 102, 241',    // indigo
    c2: '168, 85, 247',    // purple
    c3: '14, 165, 233',    // sky
  },
  manager: {
    c1: '245, 158, 11',    // amber
    c2: '249, 115, 22',    // orange
    c3: '239, 68, 68',     // red
  },
  approver: {
    c1: '168, 85, 247',    // purple
    c2: '236, 72, 153',    // pink
    c3: '99, 102, 241',    // indigo
  },
  admin: {
    c1: '244, 63, 94',     // rose
    c2: '239, 68, 68',     // red
    c3: '249, 115, 22',    // orange
  },
};

export function AuroraBackground({ variant = 'default' }: AuroraProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    let t = 0;

    const animate = () => {
      t += 0.0025;
      if (ref.current) {
        // 3 blobs ขยับเป็นวงกลมต่างเฟสกัน
        const x1 = 30 + Math.sin(t) * 25;
        const y1 = 25 + Math.cos(t * 0.7) * 20;
        const x2 = 70 + Math.cos(t * 0.9) * 25;
        const y2 = 65 + Math.sin(t * 1.1) * 20;
        const x3 = 50 + Math.sin(t * 1.3) * 30;
        const y3 = 50 + Math.cos(t * 0.5) * 25;

        ref.current.style.setProperty('--x1', `${x1}%`);
        ref.current.style.setProperty('--y1', `${y1}%`);
        ref.current.style.setProperty('--x2', `${x2}%`);
        ref.current.style.setProperty('--y2', `${y2}%`);
        ref.current.style.setProperty('--x3', `${x3}%`);
        ref.current.style.setProperty('--y3', `${y3}%`);
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  const colors = VARIANT_COLORS[variant];

  return (
    <>
      {/* ── Layer 1: Aurora blobs ── */}
      <div
        ref={ref}
        aria-hidden
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
        style={
          {
            background: `
              radial-gradient(ellipse 800px 600px at var(--x1, 30%) var(--y1, 25%), rgba(${colors.c1}, 0.18), transparent 60%),
              radial-gradient(ellipse 600px 800px at var(--x2, 70%) var(--y2, 65%), rgba(${colors.c2}, 0.15), transparent 60%),
              radial-gradient(ellipse 700px 500px at var(--x3, 50%) var(--y3, 50%), rgba(${colors.c3}, 0.12), transparent 60%)
            `,
          } as React.CSSProperties
        }
      />

      {/* ── Layer 2: Static mesh gradient (เสริมความ vibrant) ── */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-60 dark:opacity-100"
        style={{
          backgroundImage: `
            radial-gradient(at 0% 0%, rgba(${colors.c1}, 0.08) 0%, transparent 50%),
            radial-gradient(at 100% 100%, rgba(${colors.c2}, 0.08) 0%, transparent 50%),
            radial-gradient(at 100% 0%, rgba(${colors.c3}, 0.06) 0%, transparent 50%)
          `,
        }}
      />

      {/* ── Layer 3: Grid pattern (subtle texture) ── */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 pointer-events-none opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </>
  );
}
'use client';

import { useEffect, useState } from 'react';

export function MouseSpotlight() {
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setPos({ x: e.clientX, y: e.clientY });
        setVisible(true);
      });
    };
    const onLeave = () => setVisible(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none -z-[5] transition-opacity duration-300"
      style={{
        opacity: visible ? 1 : 0,
        background: `radial-gradient(420px circle at ${pos.x}px ${pos.y}px, rgba(255, 255, 255, 0.08), transparent 50%)`,
      }}
    />
  );
}
'use client';

import { useEffect, useRef } from 'react';

interface ParticleFieldProps {
  /** Number of particles (default 30) */
  count?: number;
  /** Color in rgba format e.g. '99, 102, 241' */
  color?: string;
  /** Opacity 0-1 (default 0.5 light, 0.7 dark via CSS) */
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  alphaPhase: number;
}

export function ParticleField({
  count = 30,
  color = '99, 102, 241',
  className = '',
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let particles: Particle[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ─── Resize handling ─────────────────────────────────────────────
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);

      // Init particles
      particles = Array.from({ length: count }).map(() => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 2.5 + 0.8,
        alpha: Math.random() * 0.5 + 0.3,
        alphaPhase: Math.random() * Math.PI * 2,
      }));
    };

    resize();
    window.addEventListener('resize', resize);

    // ─── Animation loop ──────────────────────────────────────────────
    let frame = 0;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const w = window.innerWidth;
      const h = window.innerHeight;

      for (const p of particles) {
        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Twinkle alpha
        const twinkle = Math.sin(frame * 0.02 + p.alphaPhase) * 0.3 + 0.7;
        const finalAlpha = p.alpha * twinkle;

        // Draw glow
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        grad.addColorStop(0, `rgba(${color}, ${finalAlpha})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw core
        ctx.fillStyle = `rgba(${color}, ${finalAlpha * 1.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [count, color]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`fixed inset-0 -z-[8] pointer-events-none opacity-50 dark:opacity-80 ${className}`}
    />
  );
}
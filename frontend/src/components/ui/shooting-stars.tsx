'use client';
import { useEffect, useRef } from 'react';

const NEON = ['#a855f7','#22d3ee','#f472b6','#60a5fa','#34d399'];

export function ShootingStars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const shooting: any[] = [];

    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = () => {
      const col = NEON[Math.floor(Math.random() * NEON.length)];
      shooting.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height * 0.5,
        vx: 7 + Math.random() * 6,
        vy: 4 + Math.random() * 4,
        life: 1, col, tail: [],
        glow: 1.5 + Math.random() * 1.5,
      });
    };

    const interval = setInterval(spawn, 600);
    spawn(); spawn();

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i];
        s.tail.push({ x: s.x, y: s.y });
        if (s.tail.length > 20) s.tail.shift();
        s.x += s.vx; s.y += s.vy; s.life -= 0.018;
        if (s.life <= 0 || s.x > c.width + 50) { shooting.splice(i, 1); continue; }

        const grad = ctx.createLinearGradient(s.tail[0]?.x ?? s.x, s.tail[0]?.y ?? s.y, s.x, s.y);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, s.col + 'cc');
        ctx.beginPath();
        ctx.moveTo(s.tail[0]?.x ?? s.x, s.tail[0]?.y ?? s.y);
        s.tail.forEach((t: any) => ctx.lineTo(t.x, t.y));
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.glow * s.life;
        ctx.globalAlpha = s.life;
        ctx.shadowColor = s.col;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.glow * s.life, 0, Math.PI * 2);
        ctx.fillStyle = s.col;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { clearInterval(interval); cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
}
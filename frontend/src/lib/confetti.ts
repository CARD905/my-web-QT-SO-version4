import confetti from 'canvas-confetti';

/** Fire a celebration burst (used on Approve action) */
export function fireConfetti() {
  const colors = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  // Burst from left
  confetti({
    particleCount: 80,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.7 },
    colors,
  });

  // Burst from right
  confetti({
    particleCount: 80,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.7 },
    colors,
  });

  // Center burst (delayed)
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
      ticks: 200,
    });
  }, 200);
}

/** Subtle success burst (smaller than full confetti) */
export function fireSparkle() {
  confetti({
    particleCount: 30,
    spread: 50,
    origin: { y: 0.5 },
    colors: ['#3b82f6', '#a855f7', '#10b981'],
    ticks: 100,
    scalar: 0.7,
  });
}
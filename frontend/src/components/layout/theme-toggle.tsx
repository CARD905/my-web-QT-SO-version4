'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Use resolvedTheme so toggle works correctly when theme="system"
  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      className="relative h-9 w-9 rounded-md hover:bg-accent flex items-center justify-center transition-all hover:scale-110 active:scale-95 overflow-hidden"
      title={isDark ? 'Switch to Light' : 'Switch to Dark'}
      aria-label="Toggle theme"
    >
      {/* Sun icon */}
      <Sun
        className={`absolute h-4 w-4 transition-all duration-500 ${
          isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 text-amber-500'
        }`}
      />
      {/* Moon icon */}
      <Moon
        className={`absolute h-4 w-4 transition-all duration-500 ${
          isDark ? 'rotate-0 scale-100 opacity-100 text-blue-400' : '-rotate-90 scale-0 opacity-0'
        }`}
      />
    </button>
  );
}
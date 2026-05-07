'use client';

import { Menu } from 'lucide-react';

export function MobileMenuTrigger() {
  return (
    <button
      onClick={() => {
        window.dispatchEvent(new CustomEvent('mobile-sidebar:open'));
      }}
      className="lg:hidden p-2 rounded-lg hover:bg-accent text-foreground transition-all active:scale-95"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
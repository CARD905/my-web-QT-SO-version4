'use client';

import { Menu } from 'lucide-react';

interface MobileMenuButtonProps {
  onClick: () => void;
}

export function MobileMenuButton({ onClick }: MobileMenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-md hover:bg-accent text-muted-foreground"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
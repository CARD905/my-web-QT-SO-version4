'use client';

import { ThemeToggle } from './theme-toggle';
import { LangSwitcher } from './lang-switcher';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';

export function Header() {
  return (
    <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur border-b">
      <div className="flex h-full items-center justify-end gap-1 px-6">
        <NotificationBell />
        <LangSwitcher />
        <ThemeToggle />
        <div className="ml-2 h-6 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}

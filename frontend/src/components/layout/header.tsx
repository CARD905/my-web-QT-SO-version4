import { auth } from '@/lib/auth';
import { LangSwitcher } from './lang-switcher';
import { ThemeToggle } from './theme-toggle';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';
import { MobileMenuTrigger } from './mobile-menu-trigger';

export async function Header() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="header-bg sticky top-0 z-30 h-16 px-3 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 overflow-hidden">
      {/* Subtle gradient shimmer bar at very bottom of header */}
      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.30), rgba(236,72,153,0.25), transparent)', backgroundSize: '200% 100%', animation: 'gradient-shift 4s ease infinite' }} />

      {/* Left: Hamburger (mobile) + Online status */}
      <div className="flex items-center gap-2.5 min-w-0">
        <MobileMenuTrigger />
        <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-full px-2.5 py-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Online</span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        <NotificationBell />
        <LangSwitcher />
        <ThemeToggle />
        <div className="w-px h-5 bg-border/60 mx-1.5 hidden sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
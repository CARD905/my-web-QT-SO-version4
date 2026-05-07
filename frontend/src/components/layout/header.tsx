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
    <header className="h-16 border-b bg-card/60 backdrop-blur-xl sticky top-0 z-30 px-3 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 supports-[backdrop-filter]:bg-card/40">
      {/* Left: Hamburger (mobile) + Online status */}
      <div className="flex items-center gap-2 min-w-0">
        <MobileMenuTrigger />
        <div className="hidden sm:flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-sm text-muted-foreground hidden sm:inline">Online</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        <NotificationBell />
        <LangSwitcher />
        <ThemeToggle />
        <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
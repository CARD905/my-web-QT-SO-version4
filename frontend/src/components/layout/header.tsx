import { auth } from '@/lib/auth';
import { LangSwitcher } from './lang-switcher';
import { ThemeToggle } from './theme-toggle';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';

export async function Header() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="h-16 border-b bg-card/60 backdrop-blur-xl sticky top-0 z-30 px-4 lg:px-6 flex items-center justify-between gap-4 supports-[backdrop-filter]:bg-card/40">
      {/* Page title - left */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="hidden sm:flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-sm text-muted-foreground hidden sm:inline">Online</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        <LangSwitcher />
        <ThemeToggle />
        <div className="w-px h-6 bg-border mx-1" />
        <UserMenu />
      </div>
    </header>
  );
}
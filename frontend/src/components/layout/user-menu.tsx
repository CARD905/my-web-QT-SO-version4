'use client';

import { LogOut, User as UserIcon } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/lib/i18n';

export function UserMenu() {
  const t = useT();
  const { data: session } = useSession();

  if (!session?.user) return null;

  const initials = (session.user.name || session.user.email || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 px-2 gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={session.user.avatarUrl || undefined} alt={session.user.name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden md:inline text-sm font-medium max-w-[120px] truncate">
            {session.user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{session.user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
            <p className="text-xs leading-none text-primary mt-1">{session.user.role}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="h-4 w-4" />
          {t('nav.profile')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {t('nav.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

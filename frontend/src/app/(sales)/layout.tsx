import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AuroraBackground } from '@/components/effects/aurora-background';
import { MouseSpotlight } from '@/components/effects/mouse-spotlight';

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // No role-based redirect — permissions are enforced per-page
  // Sidebar + PermissionGate handle UI visibility based on actual permissions

  const variant = pickAuroraVariant(session.user.role);

  return (
    <div className="flex min-h-screen relative">
      <AuroraBackground variant={variant} />
      <MouseSpotlight />
      <Sidebar role={session.user.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 lg:p-8 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}

function pickAuroraVariant(roleCode: string | undefined): 'default' | 'admin' | 'manager' | 'approver' {
  if (roleCode === 'ADMIN' || roleCode === 'CEO') return 'admin';
  if (roleCode === 'MANAGER') return 'manager';
  return 'default';
}
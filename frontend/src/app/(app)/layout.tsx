import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import { Header } from '@/components/layout/header';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return (
    <AppShell role={session.user.role} header={<Header />}>
      {children}
    </AppShell>
  );
}
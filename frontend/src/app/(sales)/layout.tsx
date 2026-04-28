import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect('/login');

  // Approvers should not see Sales pages
  if (session.user.role === 'APPROVER') {
    redirect('/approver/dashboard');
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar role={session.user.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 lg:p-8 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = (session.user as { role?: string })?.role || 'OFFICER';

  // Manager-level roles → manager dashboard
  if (role === 'MANAGER' || role === 'ADMIN' || role === 'CEO') {
    redirect('/manager/dashboard');
  }
  // Legacy support
  if (role === 'APPROVER') {
    redirect('/approver/dashboard');
  }
  // Default: Officer/Sales → standard dashboard
  redirect('/dashboard');
}
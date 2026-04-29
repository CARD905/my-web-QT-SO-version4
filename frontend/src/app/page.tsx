import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = session.user.role;
  if (role === 'MANAGER' || role === 'ADMIN') redirect('/manager/dashboard');
  if (role === 'APPROVER') redirect('/approver/dashboard');
  redirect('/dashboard');
}
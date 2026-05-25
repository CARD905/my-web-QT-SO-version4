// frontend/src/app/(app)/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import SalesDashboardPage from './sales';
import ManagerDashboardPage from './manager';
import CeoExecutiveDashboard from './ceo';

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === 'ADMIN') redirect('/admin');
  if (role === 'CEO') return <CeoExecutiveDashboard />;
  if (role === 'MANAGER') return <ManagerDashboardPage />;

  // OFFICER / SALES
  return <SalesDashboardPage />;
}
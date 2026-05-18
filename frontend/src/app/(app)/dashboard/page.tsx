// frontend/src/app/(app)/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import SalesDashboardPage from './sales';
import ManagerDashboardPage from './manager';

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user?.role;

  // ✅ Admin → ไปหน้า Admin Panel โดยตรง ไม่เกี่ยวกับ business
  if (role === 'ADMIN') {
    redirect('/admin');
  }

  if (role === 'MANAGER' || role === 'CEO') {
    return <ManagerDashboardPage />;
  }

  // OFFICER / SALES
  return <SalesDashboardPage />;
}
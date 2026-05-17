import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import SalesDashboardPage from './sales';
import ManagerDashboardPage from './manager';


export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === 'MANAGER' || role === 'CEO' || role === 'ADMIN') {
    return <ManagerDashboardPage />;
  }  
  return <SalesDashboardPage />;
}
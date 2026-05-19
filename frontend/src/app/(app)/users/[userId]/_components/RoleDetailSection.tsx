// frontend/src/app/(app)/users/[userId]/_components/RoleDetailSection.tsx
'use client';

import { OfficerDetailPage } from './OfficerDetailPage';
import { ManagerDetailPage } from './ManagerDetailPage';
import { CeoDetailPage }     from './CeoDetailPage';


interface Props {
  roleCode: string;
}

export function RoleDetailSection({ roleCode }: Props) {
  switch (roleCode) {
    case 'OFFICER':
    case 'SALES':
      return <OfficerDetailPage />;

    case 'MANAGER':
      return <ManagerDetailPage />;

    case 'CEO':
      return <CeoDetailPage />;

    default:
      return (
        <div className="max-w-md mx-auto mt-16 text-center space-y-2 text-muted-foreground">
          <p className="text-sm">ไม่รู้จัก Role: <code className="font-mono text-xs bg-muted px-1 rounded">{roleCode}</code></p>
        </div>
      );
  }
}
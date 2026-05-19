// frontend/src/app/(app)/users/[userId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { RoleDetailSection } from './_components/RoleDetailSection';
import type { ApiResponse } from '@/types/api';

export default function UserDetailPage() {
  const params  = useParams();
  const userId  = params.userId as string;

  // ✅ โหลดแค่ role เพื่อเลือก component — แต่ละ component โหลด data เองอีกรอบ
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<any>>(`/manager-dashboard/users/${userId}`);
        setRoleCode(res.data.data?.user?.role?.code ?? null);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return (
    <div className="flex gap-5 max-w-6xl mx-auto p-5">
      <div className="w-56 shrink-0 space-y-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
      <div className="flex-1 space-y-4">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );

  if (!roleCode) return (
    <Card className="max-w-md mx-auto mt-16">
      <CardContent className="py-16 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-3">ไม่พบข้อมูลผู้ใช้</p>
        <Link href="/users" className="text-sm text-primary hover:underline">← กลับรายการ Users</Link>
      </CardContent>
    </Card>
  );

  // ✅ ส่งแค่ roleCode — แต่ละ component ดึง userId จาก useParams เอง
  return <RoleDetailSection roleCode={roleCode} />;
}
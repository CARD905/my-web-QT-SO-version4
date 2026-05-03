'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Construction, Shield } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { ApiResponse } from '@/types/api';

interface MatrixData {
  roles: Array<{
    id: string;
    code: string;
    nameTh: string;
    nameEn: string;
    level: number;
    permissionCodes: string[];
  }>;
  permissions: Array<{
    code: string;
    resource: string;
    action: string;
    scope: string;
    nameTh: string;
    nameEn: string;
    groupKey: string | null;
  }>;
}

export default function ManagePermissionsPage() {
  const t = useT();
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ApiResponse<MatrixData>>('/permissions/matrix');
        if (!cancelled) setData(res.data.data ?? null);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Permission Matrix</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Read-only view — Phase 7 will add edit capabilities
        </p>
      </div>

      {/* Phase 7 Coming Soon Banner */}
      <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="py-4 flex items-center gap-3">
          <Construction className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-amber-900 dark:text-amber-100">
              Phase 7: Role/Permission Editor
            </span>
            <span className="text-amber-700 dark:text-amber-300 ml-2">
              — Currently view-only. Editing permissions through UI is coming soon.
            </span>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-4">
          {data.roles.map((role) => (
            <Card key={role.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>{role.nameTh}</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    ({role.code} · L{role.level})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-2">
                  {role.permissionCodes.length} permissions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissionCodes.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No permissions</span>
                  ) : (
                    role.permissionCodes.map((code) => (
                      <span
                        key={code}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border"
                      >
                        {code}
                      </span>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
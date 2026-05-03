'use client';

import { useMemo } from 'react';
import { usePermissionsContext } from '@/contexts/permissions-context';
import { can, getScope, hasRole, hasRoleLevel } from '@/lib/permissions';
import type { PermissionScope } from '@/types/api';

export function usePermissions() {
  const { data, loading, refresh } = usePermissionsContext();

  const helpers = useMemo(
    () => ({
      can: (resource: string, action: string, scope: PermissionScope = 'OWN') =>
        can(data, resource, action, scope),
      getScope: (resource: string, action: string) => getScope(data, resource, action),
      hasRole: (...codes: string[]) => hasRole(data, ...codes),
      hasRoleLevel: (minLevel: number) => hasRoleLevel(data, minLevel),
    }),
    [data],
  );

  return {
    ...helpers,
    role: data?.role ?? null,
    user: data?.user ?? null,
    team: data?.team ?? null,
    permissions: data?.permissions ?? [],
    loading,
    refresh,
  };
}
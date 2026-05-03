'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import type { PermissionScope } from '@/types/api';

interface PermissionGateProps {
  children: ReactNode;
  resource?: string;
  action?: string;
  scope?: PermissionScope;
  role?: string | string[];
  minLevel?: number;
  fallback?: ReactNode;
}

export function PermissionGate({
  children,
  resource,
  action,
  scope = 'OWN',
  role,
  minLevel,
  fallback = null,
}: PermissionGateProps) {
  const { can, hasRole, hasRoleLevel, loading } = usePermissions();

  if (loading) return null;

  if (resource && action) {
    if (!can(resource, action, scope)) return <>{fallback}</>;
  }

  if (role) {
    const codes = Array.isArray(role) ? role : [role];
    if (!hasRole(...codes)) return <>{fallback}</>;
  }

  if (minLevel !== undefined) {
    if (!hasRoleLevel(minLevel)) return <>{fallback}</>;
  }

  return <>{children}</>;
}
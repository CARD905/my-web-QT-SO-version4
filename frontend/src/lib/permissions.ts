import { api } from './api';
import type { ApiResponse, PermissionScope } from '@/types/api';

export interface MyPermissionsData {
  user: { id: string; email: string; name: string };
  role: {
    id: string;
    code: string;
    nameTh: string;
    nameEn: string;
    level: number;
    themeColor: string | null;
    defaultApprovalLimit: string | number | null;
  };
  team: {
    id: string;
    name: string;
    department: { id: string; name: string } | null;
  } | null;
  permissions: string[];
  permissionsByResource: Record<string, Record<string, PermissionScope>>;
}

const SCOPE_RANK: Record<PermissionScope, number> = {
  OWN: 1,
  TEAM: 2,
  DEPARTMENT: 3,
  ALL: 4,
};

export async function fetchMyPermissions(): Promise<MyPermissionsData | null> {
  try {
    const res = await api.get<ApiResponse<MyPermissionsData>>('/permissions/me');
    return res.data.data ?? null;
  } catch {
    return null;
  }
}

export function can(
  data: MyPermissionsData | null,
  resource: string,
  action: string,
  requiredScope: PermissionScope = 'OWN',
): boolean {
  if (!data) return false;
  const userScope = data.permissionsByResource?.[resource]?.[action];
  if (!userScope) return false;
  return SCOPE_RANK[userScope] >= SCOPE_RANK[requiredScope];
}

export function getScope(
  data: MyPermissionsData | null,
  resource: string,
  action: string,
): PermissionScope | null {
  return data?.permissionsByResource?.[resource]?.[action] ?? null;
}

export function hasRole(data: MyPermissionsData | null, ...codes: string[]): boolean {
  if (!data) return false;
  return codes.includes(data.role.code);
}

export function hasRoleLevel(data: MyPermissionsData | null, minLevel: number): boolean {
  if (!data) return false;
  return data.role.level >= minLevel;
}
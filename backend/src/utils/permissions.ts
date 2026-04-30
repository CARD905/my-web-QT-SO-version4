import { PermissionScope } from '@prisma/client';
import { prisma } from '../config/prisma';

/**
 * Check if a role has a specific permission (queries DB).
 * Cache-friendly — call once per request and reuse.
 */
export async function getRolePermissions(roleId: string): Promise
  Array<{
    code: string;
    resource: string;
    action: string;
    scope: PermissionScope;
    nameTh: string;
    nameEn: string;
    groupKey: string;
  }>
> {
  const rolePerms = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return rolePerms.map((rp) => ({
    code: rp.permission.code,
    resource: rp.permission.resource,
    action: rp.permission.action,
    scope: rp.scopeOverride ?? rp.permission.scope,
    nameTh: rp.permission.nameTh,
    nameEn: rp.permission.nameEn,
    groupKey: rp.permission.groupKey,
  }));
}

/**
 * Check if user has permission with a specific scope or higher.
 * SCOPE ordering: OWN < TEAM < DEPARTMENT < ALL
 */
const SCOPE_RANK: Record<PermissionScope, number> = {
  OWN: 1,
  TEAM: 2,
  DEPARTMENT: 3,
  ALL: 4,
};

export async function hasPermission(
  roleId: string,
  resource: string,
  action: string,
  requiredScope: PermissionScope = 'OWN',
): Promise<boolean> {
  const perms = await getRolePermissions(roleId);
  return perms.some(
    (p) =>
      p.resource === resource &&
      p.action === action &&
      SCOPE_RANK[p.scope] >= SCOPE_RANK[requiredScope],
  );
}

/**
 * Get the highest scope a role has for a given resource:action.
 * Returns null if no permission found.
 */
export async function getMaxScope(
  roleId: string,
  resource: string,
  action: string,
): Promise<PermissionScope | null> {
  const perms = await getRolePermissions(roleId);
  const matching = perms.filter(
    (p) => p.resource === resource && p.action === action,
  );
  if (matching.length === 0) return null;
  return matching.reduce((max, p) => (SCOPE_RANK[p.scope] > SCOPE_RANK[max] ? p.scope : max), matching[0].scope);
}
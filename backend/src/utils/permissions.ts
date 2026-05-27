import { PermissionScope } from '@prisma/client';
import { prisma } from '../config/prisma';

type UserPermissionRow = {
  granted: boolean;
  permission: {
    code: string; resource: string; action: string; scope: PermissionScope;
    nameTh: string; nameEn: string; groupKey: string;
  };
};

interface PermissionInfo {
  code: string;
  resource: string;
  action: string;
  scope: PermissionScope;
  nameTh: string;
  nameEn: string;
  groupKey: string;
}

const SCOPE_RANK: Record<PermissionScope, number> = {
  OWN: 1,
  TEAM: 2,
  DEPARTMENT: 3,
  ALL: 4,
};

/**
 * Get all permissions for a role (queries DB).
 */
export async function getRolePermissions(
  roleId: string,
): Promise<PermissionInfo[]> {
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
 * Get user's effective permissions = role permissions + user-level overrides.
 * User overrides can grant or revoke specific permissions.
 */
export async function getUserEffectivePermissions(
  userId: string,
  roleId: string,
): Promise<PermissionInfo[]> {
  const [rolePerms, userOverrides] = await Promise.all([
    getRolePermissions(roleId),
    prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    }) as Promise<UserPermissionRow[]>,
  ]);

  if (userOverrides.length === 0) return rolePerms;

  const revokedCodes = new Set(
    userOverrides.filter((u) => !u.granted).map((u) => u.permission.code),
  );
  const grantedItems: PermissionInfo[] = userOverrides
    .filter((u) => u.granted)
    .map((u) => ({
      code: u.permission.code,
      resource: u.permission.resource,
      action: u.permission.action,
      scope: u.permission.scope,
      nameTh: u.permission.nameTh,
      nameEn: u.permission.nameEn,
      groupKey: u.permission.groupKey,
    }));

  const roleCodeSet = new Set(rolePerms.map((p) => p.code));
  return [
    ...rolePerms.filter((p) => !revokedCodes.has(p.code)),
    ...grantedItems.filter((g) => !roleCodeSet.has(g.code)),
  ];
}

/**
 * Check if user has permission with a specific scope or higher.
 * When userId is provided, applies user-level overrides on top of role perms.
 */
export async function hasPermission(
  roleId: string,
  resource: string,
  action: string,
  requiredScope: PermissionScope = 'OWN',
  userId?: string,
): Promise<boolean> {
  const perms = userId
    ? await getUserEffectivePermissions(userId, roleId)
    : await getRolePermissions(roleId);

  return perms.some(
    (p) =>
      p.resource === resource &&
      p.action === action &&
      SCOPE_RANK[p.scope] >= SCOPE_RANK[requiredScope],
  );
}

/**
 * Get the highest scope a role has for a given resource:action.
 */
export async function getMaxScope(
  roleId: string,
  resource: string,
  action: string,
  userId?: string,
): Promise<PermissionScope | null> {
  const perms = userId
    ? await getUserEffectivePermissions(userId, roleId)
    : await getRolePermissions(roleId);

  const matching = perms.filter(
    (p) => p.resource === resource && p.action === action,
  );
  if (matching.length === 0) return null;

  return matching.reduce(
    (max, p) => (SCOPE_RANK[p.scope] > SCOPE_RANK[max] ? p.scope : max),
    matching[0].scope,
  );
}

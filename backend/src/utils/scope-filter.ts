import { PermissionScope } from '@prisma/client';
import { prisma } from '../config/prisma';
import { getMaxScope } from './permissions';
import { AppError } from './response';

/**
 * Recursively get all user IDs in the hierarchy under a given user
 * (direct reports + their reports, etc.)
 */
async function getReportsTreeIds(userId: string): Promise<string[]> {
  const allIds = new Set<string>();
  const queue: string[] = [userId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (allIds.has(currentId)) continue;
    allIds.add(currentId);

    const reports = await prisma.user.findMany({
      where: { reportsToId: currentId, deletedAt: null },
      select: { id: true },
    });
    for (const r of reports) {
      if (!allIds.has(r.id)) queue.push(r.id);
    }
  }

  return Array.from(allIds);
}

/**
 * Get all user IDs in the same team(s) as the user
 * (Manager: members of teams they manage + themselves)
 * (Officer: members of their team + themselves)
 */
async function getTeamMemberIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      managedTeams: { select: { id: true } },
      team: { select: { id: true } },
    },
  });
  if (!user) return [userId];

  // Collect all relevant team IDs
  const teamIds = new Set<string>();
  if (user.team) teamIds.add(user.team.id);
  for (const t of user.managedTeams) teamIds.add(t.id);

  if (teamIds.size === 0) return [userId];

  const members = await prisma.user.findMany({
    where: { teamId: { in: Array.from(teamIds) }, deletedAt: null },
    select: { id: true },
  });

  // Include the user themselves
  const ids = new Set(members.map((m) => m.id));
  ids.add(userId);

  return Array.from(ids);
}

/**
 * Get all user IDs in the same department as the user
 * (across all teams in that department)
 */
async function getDepartmentMemberIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { team: { include: { department: true } } },
  });

  if (!user?.team?.departmentId) return [userId];

  const members = await prisma.user.findMany({
    where: {
      team: { departmentId: user.team.departmentId },
      deletedAt: null,
    },
    select: { id: true },
  });

  const ids = new Set(members.map((m) => m.id));
  ids.add(userId);

  return Array.from(ids);
}

/**
 * Build a Prisma `where` filter based on user's scope for a given resource:action.
 * Returns null if user has no permission, or empty {} if scope=ALL.
 *
 * Usage:
 *   const filter = await buildScopeFilter(currentUser, 'quotation', 'view', 'createdById');
 *   const quotations = await prisma.quotation.findMany({ where: { ...filter, ... } });
 *
 * @param currentUser - The authenticated user
 * @param resource - e.g. 'quotation', 'customer'
 * @param action - e.g. 'view', 'approve'
 * @param ownerField - Field name on the entity that holds the user ID (e.g. 'createdById')
 */
export async function buildScopeFilter(
  currentUser: { id: string; roleId: string },
  resource: string,
  action: string,
  ownerField: string = 'createdById',
): Promise<Record<string, unknown> | null> {
  const scope = await getMaxScope(currentUser.roleId, resource, action);

  if (!scope) {
    return null; // No permission
  }

  switch (scope) {
    case 'ALL':
      return {};

    case 'DEPARTMENT': {
      const userIds = await getDepartmentMemberIds(currentUser.id);
      return { [ownerField]: { in: userIds } };
    }

    case 'TEAM': {
      // Combines team members + recursive reports tree
      const [teamIds, reportIds] = await Promise.all([
        getTeamMemberIds(currentUser.id),
        getReportsTreeIds(currentUser.id),
      ]);
      const allIds = Array.from(new Set([...teamIds, ...reportIds]));
      return { [ownerField]: { in: allIds } };
    }

    case 'OWN':
      return { [ownerField]: currentUser.id };

    default:
      return null;
  }
}

/**
 * Assert that user has permission, throwing 403 if not.
 * Returns the scope they have.
 */
export async function assertPermission(
  currentUser: { id: string; roleId: string },
  resource: string,
  action: string,
  requiredScope: PermissionScope = 'OWN',
): Promise<PermissionScope> {
  const userScope = await getMaxScope(currentUser.roleId, resource, action);

  if (!userScope) {
    throw new AppError(
      403,
      'PERMISSION_DENIED',
      `You don't have permission to ${action} ${resource}`,
    );
  }

  const RANK = { OWN: 1, TEAM: 2, DEPARTMENT: 3, ALL: 4 };
  if (RANK[userScope] < RANK[requiredScope]) {
    throw new AppError(
      403,
      'INSUFFICIENT_SCOPE',
      `Your scope (${userScope}) is below required (${requiredScope})`,
    );
  }

  return userScope;
}

/**
 * Check if user can act on a specific entity (ownership / team / department check)
 */
export async function canActOnEntity(
  currentUser: { id: string; roleId: string },
  resource: string,
  action: string,
  entityOwnerId: string,
): Promise<boolean> {
  const scope = await getMaxScope(currentUser.roleId, resource, action);
  if (!scope) return false;

  switch (scope) {
    case 'ALL':
      return true;
    case 'DEPARTMENT': {
      const ids = await getDepartmentMemberIds(currentUser.id);
      return ids.includes(entityOwnerId);
    }
    case 'TEAM': {
      const [teamIds, reportIds] = await Promise.all([
        getTeamMemberIds(currentUser.id),
        getReportsTreeIds(currentUser.id),
      ]);
      const allIds = new Set([...teamIds, ...reportIds]);
      return allIds.has(entityOwnerId);
    }
    case 'OWN':
      return entityOwnerId === currentUser.id;
    default:
      return false;
  }
}
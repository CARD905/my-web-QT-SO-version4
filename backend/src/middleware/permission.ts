import { NextFunction, Request, Response } from 'express';
import { PermissionScope } from '@prisma/client';
import { AppError } from '../utils/response';
import { hasPermission } from '../utils/permissions';

/**
 * Middleware: require user to have a specific permission with given scope.
 *
 * Usage:
 *   router.get('/quotations', requirePermission('quotation', 'view', 'OWN'), ...)
 *   router.post('/quotations/:id/approve', requirePermission('quotation', 'approve', 'TEAM'), ...)
 */
export function requirePermission(
  resource: string,
  action: string,
  scope: PermissionScope = 'OWN',
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user as { id: string; roleId?: string } | undefined;
      if (!user || !user.roleId) {
        return next(new AppError(401, 'UNAUTHENTICATED', 'Not authenticated'));
      }

      const allowed = await hasPermission(user.roleId, resource, action, scope);
      if (!allowed) {
        return next(
          new AppError(
            403,
            'PERMISSION_DENIED',
            `You don't have permission to ${action} ${resource}`,
          ),
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: any of the listed permissions matches.
 * Useful for endpoints accessible by multiple roles.
 *
 * Usage:
 *   router.get('/quotations',
 *     requireAnyPermission(
 *       ['quotation', 'view', 'OWN'],
 *       ['quotation', 'view', 'TEAM'],
 *       ['quotation', 'view', 'ALL'],
 *     ),
 *     ...);
 */
export function requireAnyPermission(
  ...checks: Array<[string, string, PermissionScope?]>
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user as { id: string; roleId?: string } | undefined;
      if (!user || !user.roleId) {
        return next(new AppError(401, 'UNAUTHENTICATED', 'Not authenticated'));
      }

      for (const [resource, action, scope = 'OWN'] of checks) {
        const ok = await hasPermission(user.roleId, resource, action, scope);
        if (ok) return next();
      }

      next(
        new AppError(
          403,
          'PERMISSION_DENIED',
          `You don't have permission for this action`,
        ),
      );
    } catch (err) {
      next(err);
    }
  };
}
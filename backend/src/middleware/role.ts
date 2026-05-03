import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response';

/**
 * Legacy: require user has one of the specified role codes.
 * Kept for backward compat — new code should use requirePermission.
 */
export function requireRole(...roleCodes: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user as { roleCode?: string; role?: string } | undefined;
    if (!user) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Not authenticated'));
    }

    const userRole = user.roleCode || user.role || 'OFFICER';

    // Map legacy → new role codes
    const normalize = (r: string) => {
      if (r === 'SALES') return 'OFFICER';
      if (r === 'APPROVER') return 'MANAGER';
      return r;
    };

    const userRoleNormalized = normalize(userRole);
    const allowedNormalized = roleCodes.map(normalize);

    if (!allowedNormalized.includes(userRoleNormalized)) {
      return next(
        new AppError(403, 'FORBIDDEN', `Insufficient role (need: ${roleCodes.join(' or ')})`),
      );
    }

    next();
  };
}

// Re-export for convenience
export { requirePermission, requireAnyPermission } from './permission';
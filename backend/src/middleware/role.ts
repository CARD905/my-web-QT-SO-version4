import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from '../utils/response';

/**
 * Restrict route to certain roles.
 * Must be used AFTER `authenticate`.
 *
 * Usage:
 *   router.post('/', authenticate, requireRole('SALES'), handler)
 *   router.post('/approve', authenticate, requireRole('APPROVER', 'ADMIN'), handler)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          `Role ${req.user.role} cannot access this resource`,
        ),
      );
    }
    next();
  };
}

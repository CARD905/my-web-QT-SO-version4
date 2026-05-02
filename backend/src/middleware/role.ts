import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/response';

/**
 * Phase 1 stub — accept any authenticated user.
 * Phase 2 will refactor to permission-based check from DB.
 */
export function requireRole(..._roleCodes: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Not authenticated'));
    }
    next();
  };
}

export function requirePermission(_resource: string, _action: string, _scope?: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Not authenticated'));
    }
    next();
  };
}
import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError, fail } from '../utils/response';
import { logger } from '../utils/logger';
import { isDev } from '../config/env';

export const notFoundHandler = (req: Request, res: Response) => {
  return fail(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
};

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // Zod validation
  if (err instanceof ZodError) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Invalid input', err.flatten());
  }

  // Custom AppError
  if (err instanceof AppError) {
    return fail(res, err.statusCode, err.code, err.message, err.details);
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return fail(
        res,
        409,
        'DUPLICATE',
        `Duplicate value for field: ${(err.meta as { target?: string[] })?.target?.join(', ')}`,
      );
    }
    if (err.code === 'P2025') {
      return fail(res, 404, 'NOT_FOUND', 'Record not found');
    }
    if (err.code === 'P2003') {
      return fail(res, 400, 'FOREIGN_KEY_CONSTRAINT', 'Related record does not exist');
    }
    logger.error(`Prisma error ${err.code}`, err.message);
    return fail(res, 400, 'DATABASE_ERROR', err.message);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Database validation failed');
  }

  // Unknown error
  const error = err as Error;
  logger.error('Unhandled error', error.stack || error.message);

  return fail(
    res,
    500,
    'INTERNAL_ERROR',
    isDev ? error.message || 'Internal server error' : 'Internal server error',
    isDev ? { stack: error.stack } : undefined,
  );
};

/** Wrap async route handlers so errors flow into errorHandler */
export const asyncHandler =
  <T extends Request = Request>(
    fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };

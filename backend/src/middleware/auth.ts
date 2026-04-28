import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/response';
import { prisma } from '../config/prisma';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  name: string;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'TOKEN_EXPIRED', 'Token expired');
      }
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid token');
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, name: true, isActive: true, deletedAt: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new AppError(401, 'USER_INACTIVE', 'User is inactive or not found');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/** Optional auth - attaches user if token present, but does not fail */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    // ignore invalid token
  }
  next();
}

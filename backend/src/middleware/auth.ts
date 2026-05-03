import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/response';
import { prisma } from '../config/prisma';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  roleId: string;
  roleCode: string;
  role?: string; // legacy compat
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

    // Verify user still exists and is active — include role relation
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new AppError(401, 'USER_INACTIVE', 'User is inactive or not found');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.code,
      roleCode: user.role.code,
      roleId: user.roleId,
      teamId: user.teamId,
    } as Express.Request['user'];

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
      name: payload.name,
      role: payload.roleCode || payload.role || 'OFFICER',
      roleCode: payload.roleCode || payload.role || 'OFFICER',
      roleId: payload.roleId,
    } as Express.Request['user'];
  } catch {
    // ignore invalid token
  }
  next();
}
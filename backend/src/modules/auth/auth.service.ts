import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/response';
import { logActivity } from '../../utils/activity-log';
import {
  ChangePasswordInput,
  LoginInput,
  UpdateProfileInput,
} from './auth.schema';
import { JwtPayload } from '../../middleware/auth';

const ACCESS_OPTS: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };

function signAccessToken(user: {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleCode: string;
}) {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    roleCode: user.roleCode,
    // Legacy compat — some old code reads `role`
    role: user.roleCode as JwtPayload['role'],
  };
  return jwt.sign(payload, env.JWT_SECRET, ACCESS_OPTS);
}

function generateRefreshTokenString(): string {
  return crypto.randomBytes(48).toString('hex');
}

function refreshTokenExpiry(): Date {
  const match = env.REFRESH_TOKEN_EXPIRES_IN.match(/^(\d+)([smhd])$/);
  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const ms =
    unit === 's' ? value * 1000
    : unit === 'm' ? value * 60 * 1000
    : unit === 'h' ? value * 60 * 60 * 1000
    : value * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}

export const authService = {
  async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    // findFirst because email is now @@unique([email, deletedAt])
    const user = await prisma.user.findFirst({
      where: {
        email: input.email.toLowerCase(),
        deletedAt: null,
      },
      include: { role: true },
    });

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
    }

    const validPassword = await bcrypt.compare(input.password, user.password);
    if (!validPassword) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleCode: user.role.code,
    });
    const refreshTokenStr = generateRefreshTokenString();
    const expiresAt = refreshTokenExpiry();

    await prisma.refreshToken.create({
      data: { token: refreshTokenStr, userId: user.id, expiresAt },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await logActivity(prisma, {
      userId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      description: `User ${user.email} logged in`,
      context: { ipAddress, userAgent },
    });

    return {
      accessToken,
      refreshToken: refreshTokenStr,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.code,
        roleId: user.roleId,
        avatarUrl: user.avatarUrl,
        preferredLang: user.preferredLang,
        preferredTheme: user.preferredTheme,
        teamId: user.teamId,
      },
    };
  },

  async refresh(refreshTokenStr: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
      include: { user: { include: { role: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    if (!stored.user.isActive || stored.user.deletedAt) {
      throw new AppError(401, 'USER_INACTIVE', 'User is inactive');
    }

    // Rotate refresh token
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const newRefresh = generateRefreshTokenString();
    await prisma.refreshToken.create({
      data: {
        token: newRefresh,
        userId: stored.userId,
        expiresAt: refreshTokenExpiry(),
      },
    });

    const accessToken = signAccessToken({
      id: stored.user.id,
      email: stored.user.email,
      name: stored.user.name,
      roleId: stored.user.roleId,
      roleCode: stored.user.role.code,
    });

    return { accessToken, refreshToken: newRefresh };
  },

  async logout(refreshTokenStr: string, userId: string) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshTokenStr, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logActivity(prisma, {
      userId,
      action: 'auth.logout',
      entityType: 'User',
      entityId: userId,
      description: 'User logged out',
    });
  },

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, team: true },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.code,
      roleId: user.roleId,
      roleName: user.role.nameTh,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      preferredLang: user.preferredLang,
      preferredTheme: user.preferredTheme,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      teamId: user.teamId,
      teamName: user.team?.name ?? null,
    };
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: input,
      include: { role: true },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.code,
      roleId: user.roleId,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      preferredLang: user.preferredLang,
      preferredTheme: user.preferredTheme,
    };
  },

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const valid = await bcrypt.compare(input.currentPassword, user.password);
    if (!valid) {
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
    }

    const hashed = await bcrypt.hash(input.newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
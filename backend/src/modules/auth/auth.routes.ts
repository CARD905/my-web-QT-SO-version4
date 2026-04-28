import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
} from './auth.schema';

const router = Router();

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS' }, message: 'Too many auth attempts' },
});

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(authController.login),
);

router.post(
  '/refresh',
  authLimiter,
  validate(refreshTokenSchema),
  asyncHandler(authController.refresh),
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(authController.logout),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(authController.me),
);

router.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(authController.updateProfile),
);

router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword),
);

export default router;

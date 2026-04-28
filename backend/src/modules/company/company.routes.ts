import { Router } from 'express';
import { companyController } from './company.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { updateCompanySchema } from './company.schema';

const router = Router();

router.use(authenticate);

// Everyone can read (used for displaying in PDF, headers, etc.)
router.get('/', asyncHandler(companyController.get));

// Only Admin can update
router.patch(
  '/',
  requireRole('ADMIN'),
  validate(updateCompanySchema),
  asyncHandler(companyController.update),
);

export default router;
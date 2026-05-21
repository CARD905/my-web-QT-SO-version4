import { Router } from 'express';
import multer from 'multer';
import { companyController } from './company.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { updateCompanySchema } from './company.schema';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

// Only Admin can upload logo
router.post(
  '/logo',
  requireRole('ADMIN'),
  upload.single('file'),
  asyncHandler(companyController.uploadLogo),
);

export default router;
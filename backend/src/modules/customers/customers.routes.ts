import { Router } from 'express';
import { customersController } from './customers.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import {
  createCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from './customers.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate(listCustomersSchema, 'query'), asyncHandler(customersController.list));
router.get('/:id', asyncHandler(customersController.getById));

// CREATE — Manager/Admin only
router.post(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  validate(createCustomerSchema),
  asyncHandler(customersController.create),
);

// UPDATE — Sales can edit (to reduce manager workload)
router.patch(
  '/:id',
  requireRole('SALES', 'MANAGER', 'ADMIN'),
  validate(updateCustomerSchema),
  asyncHandler(customersController.update),
);

// DELETE — Manager/Admin only
router.delete(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(customersController.remove),
);

export default router;
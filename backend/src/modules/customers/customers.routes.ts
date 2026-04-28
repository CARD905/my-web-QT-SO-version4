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

// All endpoints require authentication
router.use(authenticate);

// Sales, Approver, Admin can read
router.get('/', validate(listCustomersSchema, 'query'), asyncHandler(customersController.list));
router.get('/:id', asyncHandler(customersController.getById));

// Sales & Admin can create/update
router.post(
  '/',
  requireRole('SALES', 'ADMIN'),
  validate(createCustomerSchema),
  asyncHandler(customersController.create),
);

router.patch(
  '/:id',
  requireRole('SALES', 'ADMIN'),
  validate(updateCustomerSchema),
  asyncHandler(customersController.update),
);

router.delete(
  '/:id',
  requireRole('SALES', 'ADMIN'),
  asyncHandler(customersController.remove),
);

export default router;

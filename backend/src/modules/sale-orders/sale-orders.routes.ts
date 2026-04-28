import { Router } from 'express';
import { saleOrdersController } from './sale-orders.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { listSaleOrdersSchema } from './sale-orders.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate(listSaleOrdersSchema, 'query'), asyncHandler(saleOrdersController.list));
router.get('/:id', asyncHandler(saleOrdersController.getById));

// PDF
router.post('/:id/pdf', asyncHandler(saleOrdersController.generatePdf));
router.get('/:id/pdf/download', asyncHandler(saleOrdersController.downloadPdf));

export default router;

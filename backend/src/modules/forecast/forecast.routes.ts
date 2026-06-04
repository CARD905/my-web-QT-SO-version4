import { Router } from 'express';
import { forecastController } from './forecast.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { asyncHandler } from '../../middleware/error';

const router = Router();

router.use(authenticate);
router.use(requireRole('MANAGER', 'CEO', 'ADMIN'));

router.get('/summary', asyncHandler(forecastController.summary));
router.get('/targets', asyncHandler(forecastController.getTargets));
router.post('/targets', asyncHandler(forecastController.upsertTarget));
router.delete('/targets/:year/:month', asyncHandler(forecastController.deleteTarget));

export default router;

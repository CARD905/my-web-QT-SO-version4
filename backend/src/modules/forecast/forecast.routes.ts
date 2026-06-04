import { Router } from 'express';
import { forecastController } from './forecast.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { asyncHandler } from '../../middleware/error';

const router = Router();
router.use(authenticate);

// OFFICER sees personal forecast; MANAGER/CEO/ADMIN see team/all
router.get('/advanced', requireRole('OFFICER', 'MANAGER', 'CEO', 'ADMIN'), asyncHandler(forecastController.advanced));

// Summary + targets: management only
router.get('/summary',          requireRole('MANAGER', 'CEO', 'ADMIN'), asyncHandler(forecastController.summary));
router.get('/targets',          requireRole('MANAGER', 'CEO', 'ADMIN'), asyncHandler(forecastController.getTargets));
router.post('/targets',         requireRole('MANAGER', 'CEO', 'ADMIN'), asyncHandler(forecastController.upsertTarget));
router.delete('/targets/:year/:month', requireRole('MANAGER', 'CEO', 'ADMIN'), asyncHandler(forecastController.deleteTarget));

export default router;

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { asyncHandler } from '../../middleware/error';
import { success, created } from '../../utils/response';
import { categoriesService } from './categories.service';

const router = Router();

router.use(authenticate);

// GET /product-categories — all authenticated users
router.get('/', asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const data = await categoriesService.list(includeInactive);
  return success(res, data);
}));

// Admin-only mutations
router.post('/', requireRole('ADMIN', 'CEO'), asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'name is required' } });
  const cat = await categoriesService.create({ name, description });
  return created(res, cat, 'Category created');
}));

router.patch('/:id', requireRole('ADMIN', 'CEO'), asyncHandler(async (req, res) => {
  const cat = await categoriesService.update(req.params.id, req.body);
  return success(res, cat, 'Category updated');
}));

router.delete('/:id', requireRole('ADMIN', 'CEO'), asyncHandler(async (req, res) => {
  await categoriesService.remove(req.params.id);
  return success(res, null, 'Category deleted');
}));

export default router;

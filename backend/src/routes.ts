import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import customersRoutes from './modules/customers/customers.routes';
import productsRoutes from './modules/products/products.routes';
import quotationsRoutes from './modules/quotations/quotations.routes';
import saleOrdersRoutes from './modules/sale-orders/sale-orders.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import uploadsRoutes from './modules/uploads/uploads.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

router.use('/auth', authRoutes);
router.use('/customers', customersRoutes);
router.use('/products', productsRoutes);
router.use('/quotations', quotationsRoutes);
router.use('/sale-orders', saleOrdersRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/uploads', uploadsRoutes);

export default router;

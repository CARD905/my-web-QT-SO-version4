/**
 * PO Workflow Routes
 * Path: backend/src/modules/quotations/po.routes.ts
 */
import { Router } from 'express';
import { poController } from './po.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { uploadPoFile } from '../../middleware/upload';
import { requireAnyPermission } from '../../middleware/permission'; // ← แก้จาก rbac

const router = Router();
router.use(authenticate);

// ─── GET /quotations/checklist ──────────────────────────────────────────
router.get(
  '/quotations/checklist',
  asyncHandler(poController.checklist),
);

// ─── POST /quotations/:id/po-upload ─────────────────────────────────────
router.post(
  '/quotations/:id/po-upload',
  uploadPoFile,
  asyncHandler(poController.upload),
);

// ─── POST /quotations/:id/po-submit ─────────────────────────────────────
router.post(
  '/quotations/:id/po-submit',
  asyncHandler(poController.submit),
);

// ─── POST /quotations/:id/po-approve ────────────────────────────────────
router.post(
  '/quotations/:id/po-approve',
  requireAnyPermission(
    ['quotation', 'approve', 'TEAM'],
    ['quotation', 'approve', 'ALL'],
  ),
  asyncHandler(poController.approve),
);

// ─── POST /quotations/:id/po-reject ─────────────────────────────────────
router.post(
  '/quotations/:id/po-reject',
  requireAnyPermission(
    ['quotation', 'approve', 'TEAM'],
    ['quotation', 'approve', 'ALL'],
  ),
  asyncHandler(poController.reject),
);

export default router;
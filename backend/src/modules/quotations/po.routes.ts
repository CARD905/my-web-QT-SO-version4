/**
 * PO Workflow Routes
 * Path: backend/src/modules/quotations/po.routes.ts
 *
 * Note: Permission checks ทำใน service layer (เหมือนที่ quotations.service.ts ใช้)
 * ไม่ใช้ middleware แยก เพื่อให้สอดคล้องกับ pattern เดิมของ project
 */
import { Router } from 'express';
import { poController } from './po.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { uploadPoFile } from '../../middleware/upload';

const router = Router();
router.use(authenticate);

// ─── GET /quotations/checklist ──────────────────────────────────────────
// ทุก role เข้าได้ (filter ตาม role ใน service)
router.get(
  '/quotations/checklist',
  asyncHandler(poController.checklist),
);

// ─── POST /quotations/:id/po-upload ─────────────────────────────────────
// Officer (owner) อัปโหลดไฟล์ PO — check ใน service
router.post(
  '/quotations/:id/po-upload',
  uploadPoFile,
  asyncHandler(poController.upload),
);

// ─── POST /quotations/:id/po-submit ─────────────────────────────────────
// Officer (owner) ส่ง PO ให้ Manager — check ใน service
router.post(
  '/quotations/:id/po-submit',
  asyncHandler(poController.submit),
);

// ─── POST /quotations/:id/po-approve ────────────────────────────────────
// Manager+ อนุมัติ PO — check ใน service
router.post(
  '/quotations/:id/po-approve',
  asyncHandler(poController.approve),
);

// ─── POST /quotations/:id/po-reject ─────────────────────────────────────
// Manager+ ปฏิเสธ PO — check ใน service
router.post(
  '/quotations/:id/po-reject',
  asyncHandler(poController.reject),
);

export default router;
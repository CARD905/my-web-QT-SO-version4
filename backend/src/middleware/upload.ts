/**
 * Upload middleware — Multer with memory storage
 * Path: backend/src/middleware/upload.ts
 *
 * Why memory storage: ไม่เก็บไฟล์ลง disk — stream ไป Cloudinary โดยตรง
 */
import multer from 'multer';
import { Request } from 'express';
import { ALLOWED_PO_MIME_TYPES, MAX_PO_FILE_SIZE } from '../utils/storage';

const memoryStorage = multer.memoryStorage();

// ─── PO file upload (single file, field name 'file') ─────────────────────
export const uploadPoFile = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_PO_FILE_SIZE, // 10 MB
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    if (ALLOWED_PO_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
}).single('file');
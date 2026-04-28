import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/response';

const ATTACHMENT_DIR = path.join(env.UPLOAD_DIR, 'attachments');
fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ATTACHMENT_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${safeName}${ext}`);
  },
});

export const uploadAttachment = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new AppError(400, 'INVALID_FILE_TYPE', `File type ${file.mimetype} not allowed`));
    }
    cb(null, true);
  },
});

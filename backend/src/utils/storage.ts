/**
 * Cloudinary Storage Helper
 * Path: backend/src/utils/storage.ts
 */
import { v2 as cloudinary } from 'cloudinary';

// ─── Config ──────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const isConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (!isConfigured) {
  console.warn('[storage] Cloudinary not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
}

// ─── Allowed types ────────────────────────────────────────────────────────
export const ALLOWED_PO_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
];

export const MAX_PO_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Upload buffer → Cloudinary ──────────────────────────────────────────
export async function uploadToCloudinary(
  buffer: Buffer,
  options: {
    folder?: string;
    publicId?: string;
    mimeType?: string;
  } = {},
): Promise<{ publicId: string; url: string; secureUrl: string }> {
  if (!isConfigured) throw new Error('Cloudinary is not configured');

  return new Promise((resolve, reject) => {
    const resourceType =
      options.mimeType === 'application/pdf' ? 'raw' : 'image';

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder:        options.folder ?? 'wisdom-po-files',
        public_id:     options.publicId,
        resource_type: resourceType,
        // PDF: เก็บเป็น raw file
        // Image: auto optimize
        ...(resourceType === 'image' && {
          quality: 'auto',
          fetch_format: 'auto',
        }),
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Upload failed'));
          return;
        }
        resolve({
          publicId:  result.public_id,
          url:       result.url,
          secureUrl: result.secure_url,
        });
      },
    );

    uploadStream.end(buffer);
  });
}

// ─── Delete from Cloudinary ───────────────────────────────────────────────
export async function deleteFromCloudinary(
  publicId: string,
  mimeType?: string,
): Promise<void> {
  if (!isConfigured || !publicId) return;

  try {
    const resourceType = mimeType === 'application/pdf' ? 'raw' : 'image';
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('[storage] Failed to delete:', publicId, err);
    // ไม่ throw — ลบไม่สำเร็จไม่ควรพังงานหลัก
  }
}

// ─── Validate file ────────────────────────────────────────────────────────
export function validatePoFile(
  mimeType: string,
  size: number,
): { valid: boolean; error?: string } {
  if (!ALLOWED_PO_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: 'ประเภทไฟล์ไม่รองรับ — รองรับ PDF, PNG, JPG, WebP เท่านั้น',
    };
  }
  if (size > MAX_PO_FILE_SIZE) {
    return {
      valid: false,
      error: `ไฟล์ใหญ่เกินไป — สูงสุด ${MAX_PO_FILE_SIZE / 1024 / 1024} MB`,
    };
  }
  return { valid: true };
}

// ─── Generate folder path ─────────────────────────────────────────────────
export function generatePoFolder(quotationId: string): string {
  return `wisdom-po-files/${quotationId}`;
}
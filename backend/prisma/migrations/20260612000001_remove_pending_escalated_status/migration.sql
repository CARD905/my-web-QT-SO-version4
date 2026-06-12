UPDATE "quotations"
SET "status" = 'PENDING'
WHERE "status" = 'PENDING_ESCALATED';

ALTER TABLE "quotations" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "QuotationStatus_new" AS ENUM (
  'DRAFT',
  'REVISED',
  'PENDING',
  'PENDING_BACKUP',
  'APPROVED',
  'REJECTED',
  'SENT',
  'SIGNED',
  'CANCELLED',
  'EXPIRED',
  'PO_PENDING',
  'PO_APPROVED',
  'PO_REJECTED'
);

ALTER TABLE "quotations"
ALTER COLUMN "status" TYPE "QuotationStatus_new"
USING ("status"::text::"QuotationStatus_new");

ALTER TYPE "QuotationStatus" RENAME TO "QuotationStatus_old";
ALTER TYPE "QuotationStatus_new" RENAME TO "QuotationStatus";
DROP TYPE "QuotationStatus_old";

ALTER TABLE "quotations" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

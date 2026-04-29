-- Add MANAGER to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';

-- Add PENDING_MANAGER to QuotationStatus enum
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'PENDING_MANAGER';

-- Add QUOTATION_ESCALATED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUOTATION_ESCALATED';

-- Add approverLimit / managerLimit columns
ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "approver_limit" DECIMAL(15, 2) NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS "manager_limit" DECIMAL(15, 2) NOT NULL DEFAULT 0;
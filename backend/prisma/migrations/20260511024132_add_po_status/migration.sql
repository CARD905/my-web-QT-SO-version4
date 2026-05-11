/*
  Warnings:

  - The values [PENDING] on the enum `SaleOrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `created_by_id` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `prefix` on the `document_counters` table. All the data in the column will be lost.
  - You are about to drop the column `created_by_id` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `file_name` on the `quotation_attachments` table. All the data in the column will be lost.
  - You are about to drop the column `file_url` on the `quotation_attachments` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `quotation_items` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `quotation_versions` table. All the data in the column will be lost.
  - You are about to drop the column `cancellation_reason` on the `quotations` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `sale_order_items` table. All the data in the column will be lost.
  - You are about to drop the column `created_by_id` on the `sale_orders` table. All the data in the column will be lost.
  - You are about to drop the column `pdf_generated` on the `sale_orders` table. All the data in the column will be lost.
  - You are about to drop the column `pdf_generated_at` on the `sale_orders` table. All the data in the column will be lost.
  - You are about to drop the column `pdf_url` on the `sale_orders` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - The `preferred_lang` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `preferred_theme` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[type,year]` on the table `document_counters` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[quotation_id,version_number]` on the table `quotation_versions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,deleted_at]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_email` to the `activity_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_name` to the `activity_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_role_code` to the `activity_logs` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `action` on the `activity_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `type` to the `document_counters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_path` to the `quotation_attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filename` to the `quotation_attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `original_name` to the `quotation_attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `version_number` to the `quotation_versions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role_id` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('OWN', 'TEAM', 'DEPARTMENT', 'ALL');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'DELEGATED', 'SKIPPED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApproverType" AS ENUM ('PRIMARY', 'BACKUP', 'ESCALATION', 'DELEGATE');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "InvitationChannel" AS ENUM ('MANUAL', 'EMAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('th', 'en');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('light', 'dark', 'system');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'QUOTATION_ESCALATED';
ALTER TYPE "NotificationType" ADD VALUE 'USER_INVITED';
ALTER TYPE "NotificationType" ADD VALUE 'TEAM_REASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'MANAGER_RESIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'ROLE_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'PO_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PO_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SO_CREATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuotationStatus" ADD VALUE 'PENDING_BACKUP';
ALTER TYPE "QuotationStatus" ADD VALUE 'PENDING_ESCALATED';
ALTER TYPE "QuotationStatus" ADD VALUE 'SENT';
ALTER TYPE "QuotationStatus" ADD VALUE 'SIGNED';
ALTER TYPE "QuotationStatus" ADD VALUE 'PO_PENDING';
ALTER TYPE "QuotationStatus" ADD VALUE 'PO_APPROVED';
ALTER TYPE "QuotationStatus" ADD VALUE 'PO_REJECTED';

-- AlterEnum
BEGIN;
CREATE TYPE "SaleOrderStatus_new" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "sale_orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "sale_orders" ALTER COLUMN "status" TYPE "SaleOrderStatus_new" USING ("status"::text::"SaleOrderStatus_new");
ALTER TYPE "SaleOrderStatus" RENAME TO "SaleOrderStatus_old";
ALTER TYPE "SaleOrderStatus_new" RENAME TO "SaleOrderStatus";
DROP TYPE "SaleOrderStatus_old";
ALTER TABLE "sale_orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activity_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "sale_orders" DROP CONSTRAINT "sale_orders_created_by_id_fkey";

-- DropIndex
DROP INDEX "activity_logs_user_id_idx";

-- DropIndex
DROP INDEX "customers_contact_name_idx";

-- DropIndex
DROP INDEX "customers_tax_id_idx";

-- DropIndex
DROP INDEX "document_counters_prefix_year_key";

-- DropIndex
DROP INDEX "notifications_created_at_idx";

-- DropIndex
DROP INDEX "products_name_idx";

-- DropIndex
DROP INDEX "quotation_versions_quotation_id_version_idx";

-- DropIndex
DROP INDEX "users_email_key";

-- DropIndex
DROP INDEX "users_role_idx";

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "request_id" TEXT,
ADD COLUMN     "user_email" TEXT NOT NULL,
ADD COLUMN     "user_name" TEXT NOT NULL,
ADD COLUMN     "user_role_code" TEXT NOT NULL,
ALTER COLUMN "user_id" DROP NOT NULL,
DROP COLUMN "action",
ADD COLUMN     "action" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "created_by_id",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "document_counters" DROP COLUMN "prefix",
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "created_by_id";

-- AlterTable
ALTER TABLE "quotation_attachments" DROP COLUMN "file_name",
DROP COLUMN "file_url",
ADD COLUMN     "file_path" TEXT NOT NULL,
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "original_name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "quotation_items" DROP COLUMN "description",
ADD COLUMN     "product_description" TEXT;

-- AlterTable
ALTER TABLE "quotation_versions" DROP COLUMN "version",
ADD COLUMN     "version_number" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "quotations" DROP COLUMN "cancellation_reason",
ADD COLUMN     "backup_approver_id" TEXT,
ADD COLUMN     "cancelled_reason" TEXT,
ADD COLUMN     "current_step" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "po_approved_at" TIMESTAMP(3),
ADD COLUMN     "po_approved_by_id" TEXT,
ADD COLUMN     "po_file_mime_type" TEXT,
ADD COLUMN     "po_file_name" TEXT,
ADD COLUMN     "po_file_size" INTEGER,
ADD COLUMN     "po_file_url" TEXT,
ADD COLUMN     "po_rejected_at" TIMESTAMP(3),
ADD COLUMN     "po_rejected_by_id" TEXT,
ADD COLUMN     "po_rejection_reason" TEXT,
ADD COLUMN     "po_submitted_at" TIMESTAMP(3),
ADD COLUMN     "po_upload_history" JSONB,
ADD COLUMN     "po_uploaded_at" TIMESTAMP(3),
ADD COLUMN     "po_uploaded_by_id" TEXT,
ADD COLUMN     "primary_approver_id" TEXT,
ADD COLUMN     "rejected_by_id" TEXT,
ADD COLUMN     "total_steps" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "issue_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "expiry_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "subtotal" DROP DEFAULT,
ALTER COLUMN "grand_total" DROP DEFAULT;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "replaced_by" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- AlterTable
ALTER TABLE "sale_order_items" DROP COLUMN "description",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "product_description" TEXT;

-- AlterTable
ALTER TABLE "sale_orders" DROP COLUMN "created_by_id",
DROP COLUMN "pdf_generated",
DROP COLUMN "pdf_generated_at",
DROP COLUMN "pdf_url",
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "status" SET DEFAULT 'DRAFT',
ALTER COLUMN "issue_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "subtotal" DROP DEFAULT,
ALTER COLUMN "grand_total" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "approval_limit" DECIMAL(15,2),
ADD COLUMN     "delegate_to_id" TEXT,
ADD COLUMN     "reports_to_id" TEXT,
ADD COLUMN     "role_id" TEXT NOT NULL,
ADD COLUMN     "team_id" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "preferred_lang",
ADD COLUMN     "preferred_lang" "Lang" NOT NULL DEFAULT 'th',
DROP COLUMN "preferred_theme",
ADD COLUMN     "preferred_theme" "Theme" NOT NULL DEFAULT 'light';

-- DropEnum
DROP TYPE "ActivityAction";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "default_approval_limit" DECIMAL(15,2),
    "theme_color" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "group_key" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "scope_override" "PermissionScope",
    "granted_by_id" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department_id" TEXT NOT NULL,
    "manager_id" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_approver_authorizations" (
    "id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "backup_approver_id" TEXT NOT NULL,
    "authorized_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_approver_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "role_id" TEXT NOT NULL,
    "team_id" TEXT,
    "reports_to_id" TEXT,
    "invited_by_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "InvitationChannel" NOT NULL DEFAULT 'MANUAL',
    "email_sent_at" TIMESTAMP(3),
    "email_error" TEXT,
    "accepted_at" TIMESTAMP(3),
    "accepted_by_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_approvals" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "approver_name" TEXT NOT NULL,
    "approver_email" TEXT NOT NULL,
    "approver_role_id" TEXT NOT NULL,
    "approver_role_code" TEXT NOT NULL,
    "approver_role_name" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "total_steps" INTEGER NOT NULL,
    "approver_type" "ApproverType" NOT NULL DEFAULT 'PRIMARY',
    "status" "ApprovalAction" NOT NULL,
    "comment" TEXT,
    "grand_total_at_action" DECIMAL(15,2) NOT NULL,
    "approver_limit_at_action" DECIMAL(15,2),
    "exceeds_limit" BOOLEAN NOT NULL DEFAULT false,
    "quotation_version" INTEGER NOT NULL,
    "escalated_to_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "acted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_level_idx" ON "roles"("level");

-- CreateIndex
CREATE INDEX "roles_isActive_idx" ON "roles"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_group_key_idx" ON "permissions"("group_key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_scope_key" ON "permissions"("resource", "action", "scope");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_deleted_at_idx" ON "departments"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "teams_code_key" ON "teams"("code");

-- CreateIndex
CREATE INDEX "teams_department_id_idx" ON "teams"("department_id");

-- CreateIndex
CREATE INDEX "teams_manager_id_idx" ON "teams"("manager_id");

-- CreateIndex
CREATE INDEX "teams_deleted_at_idx" ON "teams"("deleted_at");

-- CreateIndex
CREATE INDEX "backup_approver_authorizations_officer_id_idx" ON "backup_approver_authorizations"("officer_id");

-- CreateIndex
CREATE INDEX "backup_approver_authorizations_backup_approver_id_idx" ON "backup_approver_authorizations"("backup_approver_id");

-- CreateIndex
CREATE INDEX "backup_approver_authorizations_is_active_idx" ON "backup_approver_authorizations"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "backup_approver_authorizations_officer_id_backup_approver_i_key" ON "backup_approver_authorizations"("officer_id", "backup_approver_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_accepted_by_id_key" ON "invitations"("accepted_by_id");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_status_idx" ON "invitations"("status");

-- CreateIndex
CREATE INDEX "invitations_expires_at_idx" ON "invitations"("expires_at");

-- CreateIndex
CREATE INDEX "quotation_approvals_quotation_id_step_idx" ON "quotation_approvals"("quotation_id", "step");

-- CreateIndex
CREATE INDEX "quotation_approvals_approver_id_idx" ON "quotation_approvals"("approver_id");

-- CreateIndex
CREATE INDEX "quotation_approvals_approver_id_status_idx" ON "quotation_approvals"("approver_id", "status");

-- CreateIndex
CREATE INDEX "quotation_approvals_status_idx" ON "quotation_approvals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_approvals_quotation_id_step_approver_id_quotation_key" ON "quotation_approvals"("quotation_id", "step", "approver_id", "quotation_version");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "customers_deleted_at_idx" ON "customers"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_counters_type_year_key" ON "document_counters"("type", "year");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "products_deleted_at_idx" ON "products"("deleted_at");

-- CreateIndex
CREATE INDEX "quotation_versions_quotation_id_idx" ON "quotation_versions"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_versions_quotation_id_version_number_key" ON "quotation_versions"("quotation_id", "version_number");

-- CreateIndex
CREATE INDEX "quotations_primary_approver_id_idx" ON "quotations"("primary_approver_id");

-- CreateIndex
CREATE INDEX "quotations_backup_approver_id_idx" ON "quotations"("backup_approver_id");

-- CreateIndex
CREATE INDEX "quotations_status_expiry_date_idx" ON "quotations"("status", "expiry_date");

-- CreateIndex
CREATE INDEX "quotations_created_by_id_created_at_idx" ON "quotations"("created_by_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "quotations_primary_approver_id_status_idx" ON "quotations"("primary_approver_id", "status");

-- CreateIndex
CREATE INDEX "quotations_deleted_at_idx" ON "quotations"("deleted_at");

-- CreateIndex
CREATE INDEX "quotations_expiry_date_idx" ON "quotations"("expiry_date");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "sale_orders_deleted_at_idx" ON "sale_orders"("deleted_at");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_team_id_idx" ON "users"("team_id");

-- CreateIndex
CREATE INDEX "users_reports_to_id_idx" ON "users"("reports_to_id");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_deleted_at_key" ON "users"("email", "deleted_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_delegate_to_id_fkey" FOREIGN KEY ("delegate_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_approver_authorizations" ADD CONSTRAINT "backup_approver_authorizations_authorized_by_id_fkey" FOREIGN KEY ("authorized_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_approver_authorizations" ADD CONSTRAINT "backup_approver_authorizations_backup_approver_id_fkey" FOREIGN KEY ("backup_approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_approver_authorizations" ADD CONSTRAINT "backup_approver_authorizations_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_backup_approver_id_fkey" FOREIGN KEY ("backup_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_primary_approver_id_fkey" FOREIGN KEY ("primary_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_po_uploaded_by_id_fkey" FOREIGN KEY ("po_uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_po_approved_by_id_fkey" FOREIGN KEY ("po_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_po_rejected_by_id_fkey" FOREIGN KEY ("po_rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_attachments" ADD CONSTRAINT "quotation_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_approvals" ADD CONSTRAINT "quotation_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_approvals" ADD CONSTRAINT "quotation_approvals_approver_role_id_fkey" FOREIGN KEY ("approver_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_approvals" ADD CONSTRAINT "quotation_approvals_escalated_to_id_fkey" FOREIGN KEY ("escalated_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_approvals" ADD CONSTRAINT "quotation_approvals_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ManagerLevel" AS ENUM ('SECTION', 'DEPARTMENT', 'DIVISION');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PO_SUBMITTED';

-- AlterEnum
ALTER TYPE "SaleOrderStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "department_id" TEXT;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "current_approver_id" TEXT,
ADD COLUMN     "po_number" TEXT,
ADD COLUMN     "special_discount_at" TIMESTAMP(3),
ADD COLUMN     "special_discount_by_id" TEXT,
ADD COLUMN     "special_discount_final_pct" DECIMAL(5,2),
ADD COLUMN     "special_discount_percent" DECIMAL(5,2),
ADD COLUMN     "special_discount_reason" TEXT,
ADD COLUMN     "special_discount_requested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "special_discount_status" TEXT;

-- AlterTable
ALTER TABLE "sale_orders" ADD COLUMN     "deadline_date" TIMESTAMP(3),
ADD COLUMN     "po_file_url" TEXT,
ADD COLUMN     "po_number" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_team_lead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manager_level" "ManagerLevel";

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "group" TEXT NOT NULL DEFAULT 'general',
    "label" TEXT NOT NULL,
    "description" TEXT,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_group_idx" ON "system_settings"("group");

-- CreateIndex
CREATE INDEX "login_history_user_id_idx" ON "login_history"("user_id");

-- CreateIndex
CREATE INDEX "login_history_email_idx" ON "login_history"("email");

-- CreateIndex
CREATE INDEX "login_history_success_idx" ON "login_history"("success");

-- CreateIndex
CREATE INDEX "login_history_created_at_idx" ON "login_history"("created_at");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_current_approver_id_fkey" FOREIGN KEY ("current_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

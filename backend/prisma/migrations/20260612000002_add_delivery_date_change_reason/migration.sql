-- AddColumn delivery_date_changed_at and delivery_date_change_reason to quotations
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "delivery_date_changed_at" TIMESTAMP(3);
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "delivery_date_change_reason" TEXT;

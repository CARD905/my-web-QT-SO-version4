-- Insert USD exchange rate system setting (default 35 THB per 1 USD)
INSERT INTO "system_settings" ("id", "key", "value", "type", "group", "label", "description", "updated_at", "created_at")
VALUES (
  gen_random_uuid(),
  'currency.usdExchangeRate',
  '35',
  'number',
  'currency',
  'อัตราแลกเปลี่ยน USD/THB',
  'อัตรา 1 USD เท่ากับกี่ THB ใช้เปรียบเทียบกับวงเงินอนุมัติเมื่อ quotation เป็นสกุลเงิน USD',
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;

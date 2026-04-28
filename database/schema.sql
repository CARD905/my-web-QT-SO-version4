-- =====================================================
-- Quotation & Sale Order Management System
-- PostgreSQL Schema (สำหรับ pgAdmin)
-- =====================================================
-- Note: ถ้าใช้ Prisma ให้รัน `npx prisma migrate dev` แทน
-- ไฟล์นี้ไว้สำหรับสร้าง DB ด้วย pgAdmin โดยตรง
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============== ENUMS ==============

CREATE TYPE "UserRole" AS ENUM ('SALES', 'APPROVER', 'ADMIN');

CREATE TYPE "QuotationStatus" AS ENUM (
  'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'
);

CREATE TYPE "SaleOrderStatus" AS ENUM (
  'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'
);

CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

CREATE TYPE "Currency" AS ENUM ('THB', 'USD');

CREATE TYPE "NotificationType" AS ENUM (
  'QUOTATION_SUBMITTED', 'QUOTATION_APPROVED', 'QUOTATION_REJECTED',
  'QUOTATION_CANCELLED', 'QUOTATION_RESUBMITTED', 'SALE_ORDER_CREATED',
  'QUOTATION_EXPIRING_SOON'
);

CREATE TYPE "ActivityAction" AS ENUM (
  'CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'APPROVE',
  'REJECT', 'CANCEL', 'RESUBMIT', 'LOGIN', 'LOGOUT', 'EXPORT_PDF'
);

-- ============== USERS ==============

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password        VARCHAR(255) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  role            "UserRole" NOT NULL,
  avatar_url      TEXT,
  phone           VARCHAR(50),
  is_active       BOOLEAN DEFAULT TRUE,
  last_login_at   TIMESTAMP,
  preferred_lang  VARCHAR(10) DEFAULT 'th',
  preferred_theme VARCHAR(10) DEFAULT 'light',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  deleted_at      TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============== REFRESH TOKENS ==============

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token       VARCHAR(500) UNIQUE NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  revoked_at  TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ============== CUSTOMERS ==============

CREATE TABLE customers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_name      VARCHAR(255) NOT NULL,
  company           VARCHAR(255) NOT NULL,
  tax_id            VARCHAR(50),
  email             VARCHAR(255),
  phone             VARCHAR(50),
  billing_address   TEXT,
  shipping_address  TEXT,
  notes             TEXT,
  created_by_id     UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  deleted_at        TIMESTAMP
);

CREATE INDEX idx_customers_company ON customers(company);
CREATE INDEX idx_customers_contact_name ON customers(contact_name);
CREATE INDEX idx_customers_tax_id ON customers(tax_id);

-- ============== PRODUCTS ==============

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku           VARCHAR(100) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  unit_price    DECIMAL(15, 2) NOT NULL,
  unit          VARCHAR(50) DEFAULT 'pcs',
  is_active     BOOLEAN DEFAULT TRUE,
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  deleted_at    TIMESTAMP
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);

-- ============== QUOTATIONS ==============

CREATE TABLE quotations (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_no               VARCHAR(50) UNIQUE NOT NULL,
  version                    INTEGER DEFAULT 1,
  status                     "QuotationStatus" DEFAULT 'DRAFT',
  issue_date                 DATE NOT NULL,
  expiry_date                DATE NOT NULL,
  currency                   "Currency" DEFAULT 'THB',
  customer_id                UUID NOT NULL REFERENCES customers(id),
  customer_contact_name      VARCHAR(255) NOT NULL,
  customer_company           VARCHAR(255) NOT NULL,
  customer_tax_id            VARCHAR(50),
  customer_email             VARCHAR(255),
  customer_phone             VARCHAR(50),
  customer_billing_address   TEXT,
  customer_shipping_address  TEXT,
  subtotal                   DECIMAL(15, 2) DEFAULT 0,
  discount_total             DECIMAL(15, 2) DEFAULT 0,
  vat_enabled                BOOLEAN DEFAULT TRUE,
  vat_rate                   DECIMAL(5, 2) DEFAULT 7,
  vat_amount                 DECIMAL(15, 2) DEFAULT 0,
  grand_total                DECIMAL(15, 2) DEFAULT 0,
  payment_terms              VARCHAR(100),
  conditions                 TEXT,
  submitted_at               TIMESTAMP,
  approved_at                TIMESTAMP,
  approved_by_id             UUID REFERENCES users(id),
  rejected_at                TIMESTAMP,
  rejection_reason           TEXT,
  cancelled_at               TIMESTAMP,
  cancellation_reason        TEXT,
  created_by_id              UUID NOT NULL REFERENCES users(id),
  created_at                 TIMESTAMP DEFAULT NOW(),
  updated_at                 TIMESTAMP DEFAULT NOW(),
  deleted_at                 TIMESTAMP
);

CREATE INDEX idx_quotations_no ON quotations(quotation_no);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_customer ON quotations(customer_id);
CREATE INDEX idx_quotations_creator ON quotations(created_by_id);
CREATE INDEX idx_quotations_issue_date ON quotations(issue_date);

-- ============== QUOTATION ITEMS ==============

CREATE TABLE quotation_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id  UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  product_sku   VARCHAR(100),
  product_name  VARCHAR(255) NOT NULL,
  description   TEXT,
  quantity      DECIMAL(15, 2) NOT NULL,
  unit          VARCHAR(50) DEFAULT 'pcs',
  unit_price    DECIMAL(15, 2) NOT NULL,
  discount      DECIMAL(15, 2) DEFAULT 0,
  discount_type "DiscountType" DEFAULT 'PERCENTAGE',
  line_total    DECIMAL(15, 2) NOT NULL,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quotation_items_quotation ON quotation_items(quotation_id);

-- ============== QUOTATION VERSIONS ==============

CREATE TABLE quotation_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id    UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  snapshot        JSONB NOT NULL,
  changed_by_id   UUID NOT NULL REFERENCES users(id),
  change_reason   TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quotation_versions_quotation ON quotation_versions(quotation_id, version);

-- ============== QUOTATION COMMENTS ==============

CREATE TABLE quotation_comments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id  UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  message       TEXT NOT NULL,
  is_internal   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quotation_comments_quotation ON quotation_comments(quotation_id);

-- ============== QUOTATION ATTACHMENTS ==============

CREATE TABLE quotation_attachments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id    UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  file_name       VARCHAR(255) NOT NULL,
  file_url        TEXT NOT NULL,
  file_size       INTEGER NOT NULL,
  mime_type       VARCHAR(100) NOT NULL,
  uploaded_by_id  UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quotation_attachments_quotation ON quotation_attachments(quotation_id);

-- ============== SALE ORDERS ==============

CREATE TABLE sale_orders (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_order_no               VARCHAR(50) UNIQUE NOT NULL,
  quotation_id                UUID UNIQUE NOT NULL REFERENCES quotations(id),
  status                      "SaleOrderStatus" DEFAULT 'PENDING',
  issue_date                  DATE NOT NULL,
  currency                    "Currency" DEFAULT 'THB',
  customer_id                 UUID NOT NULL REFERENCES customers(id),
  customer_contact_name       VARCHAR(255) NOT NULL,
  customer_company            VARCHAR(255) NOT NULL,
  customer_tax_id             VARCHAR(50),
  customer_email              VARCHAR(255),
  customer_phone              VARCHAR(50),
  customer_billing_address    TEXT,
  customer_shipping_address   TEXT,
  subtotal                    DECIMAL(15, 2) DEFAULT 0,
  discount_total              DECIMAL(15, 2) DEFAULT 0,
  vat_enabled                 BOOLEAN DEFAULT TRUE,
  vat_rate                    DECIMAL(5, 2) DEFAULT 7,
  vat_amount                  DECIMAL(15, 2) DEFAULT 0,
  grand_total                 DECIMAL(15, 2) DEFAULT 0,
  payment_terms               VARCHAR(100),
  conditions                  TEXT,
  pdf_generated               BOOLEAN DEFAULT FALSE,
  pdf_url                     TEXT,
  pdf_generated_at            TIMESTAMP,
  created_by_id               UUID NOT NULL REFERENCES users(id),
  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW(),
  deleted_at                  TIMESTAMP
);

CREATE INDEX idx_sale_orders_no ON sale_orders(sale_order_no);
CREATE INDEX idx_sale_orders_status ON sale_orders(status);
CREATE INDEX idx_sale_orders_customer ON sale_orders(customer_id);

-- ============== SALE ORDER ITEMS ==============

CREATE TABLE sale_order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_order_id UUID NOT NULL REFERENCES sale_orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  product_sku   VARCHAR(100),
  product_name  VARCHAR(255) NOT NULL,
  description   TEXT,
  quantity      DECIMAL(15, 2) NOT NULL,
  unit          VARCHAR(50) DEFAULT 'pcs',
  unit_price    DECIMAL(15, 2) NOT NULL,
  discount      DECIMAL(15, 2) DEFAULT 0,
  discount_type "DiscountType" DEFAULT 'PERCENTAGE',
  line_total    DECIMAL(15, 2) NOT NULL,
  sort_order    INTEGER DEFAULT 0
);

CREATE INDEX idx_sale_order_items_so ON sale_order_items(sale_order_id);

-- ============== ACTIVITY LOGS ==============

CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  action      "ActivityAction" NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID,
  description TEXT NOT NULL,
  metadata    JSONB,
  ip_address  VARCHAR(50),
  user_agent  TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- ============== NOTIFICATIONS ==============

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        "NotificationType" NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL,
  link        TEXT,
  is_read     BOOLEAN DEFAULT FALSE,
  metadata    JSONB,
  created_at  TIMESTAMP DEFAULT NOW(),
  read_at     TIMESTAMP
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ============== COMPANY SETTINGS ==============

CREATE TABLE company_settings (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name            VARCHAR(255) NOT NULL,
  company_name_th         VARCHAR(255),
  tax_id                  VARCHAR(50),
  address                 TEXT,
  address_th              TEXT,
  phone                   VARCHAR(50),
  fax                     VARCHAR(50),
  email                   VARCHAR(255),
  website                 VARCHAR(255),
  logo_url                TEXT,
  default_vat_rate        DECIMAL(5, 2) DEFAULT 7,
  default_payment_terms   VARCHAR(100),
  default_currency        "Currency" DEFAULT 'THB',
  quotation_prefix        VARCHAR(20) DEFAULT 'QT',
  sale_order_prefix       VARCHAR(20) DEFAULT 'SO',
  bank_name               VARCHAR(255),
  bank_account            VARCHAR(100),
  bank_branch             VARCHAR(255),
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

-- ============== DOCUMENT COUNTERS ==============

CREATE TABLE document_counters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prefix      VARCHAR(20) NOT NULL,
  year        INTEGER NOT NULL,
  counter     INTEGER DEFAULT 0,
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(prefix, year)
);

-- ============== TRIGGERS ==============

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sale_orders_updated_at BEFORE UPDATE ON sale_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============== INITIAL DATA ==============

INSERT INTO company_settings (
  company_name, company_name_th, tax_id, address, address_th,
  phone, email, default_vat_rate, default_payment_terms, default_currency
) VALUES (
  'Your Company Co., Ltd.',
  'บริษัท ของคุณ จำกัด',
  '0000000000000',
  '123 Your Address, Bangkok 10000',
  '123 ที่อยู่บริษัท กรุงเทพฯ 10000',
  '02-000-0000',
  'info@yourcompany.com',
  7,
  'Net 30',
  'THB'
);

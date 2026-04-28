# Quotation System – Backend

REST API server สำหรับระบบจัดการใบเสนอราคาและใบสั่งขาย — **Phase 1 + 2 Complete** ✅

## 🛠️ Tech Stack

- **Node.js** 20+ / **Express.js** 4
- **TypeScript** 5
- **Prisma ORM** 5 + **PostgreSQL** 14+
- **JWT** Authentication + Refresh Token Rotation
- **Zod** Validation
- **bcrypt** Password Hashing
- **Puppeteer** PDF Generation (รองรับฟอนต์ไทย)
- **Multer** File Uploads
- **Helmet, CORS, Rate Limit** Security

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma           # 14 models
│   └── seed.ts                 # Seed users + customers + products
├── src/
│   ├── config/                 # env, prisma client
│   ├── middleware/             # auth, role, validate, error
│   ├── modules/
│   │   ├── auth/               # ✅ Login + Refresh + Profile
│   │   ├── customers/          # ✅ CRUD + search
│   │   ├── products/           # ✅ CRUD + SKU unique
│   │   ├── quotations/         # ✅ Full workflow (submit/approve/reject/cancel)
│   │   ├── sale-orders/        # ✅ Read-only + PDF (Puppeteer)
│   │   ├── dashboard/          # ✅ Sales + Approver stats
│   │   ├── notifications/      # ✅ List + read + count
│   │   └── uploads/            # ✅ Multer attachments
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── response.ts
│   │   ├── pagination.ts
│   │   ├── number-generator.ts # QT-2026-0001
│   │   ├── calc.ts             # Quotation totals
│   │   ├── activity-log.ts
│   │   └── notification.ts     # Notification helper
│   ├── types/express.d.ts
│   ├── routes.ts               # Aggregator
│   ├── app.ts                  # Express setup
│   └── server.ts               # Entry point
├── .env.example
├── package.json
└── tsconfig.json
```

## 🚀 Setup

### 1. Install

```bash
cd backend
npm install
```

### 2. Database

สร้าง DB ใหม่ใน pgAdmin ชื่อ `quotation_db`

### 3. Environment

```bash
cp .env.example .env
# แก้ DATABASE_URL และสร้าง secrets:
#   openssl rand -base64 64
```

### 4. Migrate + Seed

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

### 5. Run

```bash
npm run dev
```

→ http://localhost:4000/api/v1/health

---

## 📚 API Endpoints

### Base URL: `/api/v1`

### 🔐 Auth
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Login with email/password |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | Auth | Logout (revoke refresh) |
| GET | `/auth/me` | Auth | Current user profile |
| PATCH | `/auth/me` | Auth | Update profile |
| POST | `/auth/change-password` | Auth | Change password |

### 🤝 Customers
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/customers` | All | List with `?search=&page=&limit=` |
| GET | `/customers/:id` | All | Get one |
| POST | `/customers` | Sales/Admin | Create |
| PATCH | `/customers/:id` | Sales/Admin | Update |
| DELETE | `/customers/:id` | Sales/Admin | Soft delete (blocked if has active quotations) |

### 📦 Products
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/products` | All | List with `?search=&isActive=` |
| GET | `/products/:id` | All | Get one |
| POST | `/products` | Sales/Admin | Create (SKU must be unique) |
| PATCH | `/products/:id` | Sales/Admin | Update |
| DELETE | `/products/:id` | Sales/Admin | Soft delete |

### 📄 Quotations
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/quotations` | All | List (Sales sees only own). Filters: `?status=&customerId=&expiringSoon=&highValue=` |
| GET | `/quotations/:id` | Owner/Approver/Admin | Detail with items, comments, sale order |
| POST | `/quotations` | Sales/Admin | Create DRAFT |
| PATCH | `/quotations/:id` | Sales (owner) | Update DRAFT/REJECTED (creates version snapshot) |
| POST | `/quotations/:id/submit` | Sales (owner) | DRAFT → PENDING (notifies approvers) |
| POST | `/quotations/:id/cancel` | Sales (owner) | DRAFT/PENDING → CANCELLED |
| POST | `/quotations/:id/approve` | Approver/Admin | PENDING → APPROVED + **auto-create Sale Order** |
| POST | `/quotations/:id/reject` | Approver/Admin | PENDING → REJECTED (requires reason) |
| GET | `/quotations/:id/versions` | All | Version history |
| GET | `/quotations/:id/comments` | All | Comment thread (Sales sees public only) |
| POST | `/quotations/:id/comments` | All | Add comment |

### 📋 Sale Orders
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/sale-orders` | All | List (Sales sees only own) |
| GET | `/sale-orders/:id` | Owner/Approver/Admin | Get detail |
| POST | `/sale-orders/:id/pdf` | All | **Generate PDF** (returns `{ url, fileName }`) |
| GET | `/sale-orders/:id/pdf/download` | All | **Download PDF directly** (streamed file) |

### 📊 Dashboard
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/dashboard/sales` | Sales/Admin | Sales stats (totals, by status, expiring soon, recent) |
| GET | `/dashboard/approver` | Approver/Admin | Approver stats (pending count, total value, high-value, expiring soon) |

### 🔔 Notifications
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/notifications` | Auth | List user's notifications |
| GET | `/notifications/unread-count` | Auth | `{ count }` |
| PATCH | `/notifications/read-all` | Auth | Mark all as read |
| PATCH | `/notifications/:id/read` | Auth | Mark one as read |
| DELETE | `/notifications/:id` | Auth | Delete |

### 📎 Uploads
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| POST | `/uploads/quotations/:quotationId/attachments` | Auth | Upload file (multipart `file`) |
| GET | `/uploads/quotations/:quotationId/attachments` | Auth | List attachments |
| DELETE | `/uploads/attachments/:attachmentId` | Owner/Uploader/Admin | Delete attachment |

---

## 🔄 Quotation Workflow

```
        ┌──────────┐
        │  DRAFT   │ ◄──────── สร้างใหม่
        └────┬─────┘
             │ submit (Sales)
             ▼
        ┌──────────┐
        │ PENDING  │ ───── notify approvers
        └────┬─────┘
             │
   ┌─────────┴──────────┬──────────────┐
   │ approve            │ reject       │ cancel
   ▼                    ▼              ▼
┌──────────┐      ┌──────────┐   ┌────────────┐
│ APPROVED │      │ REJECTED │   │ CANCELLED  │
└────┬─────┘      └────┬─────┘   └────────────┘
     │                 │
  auto-create       edit & resubmit
     ▼                 │
┌──────────┐           ▼
│Sale Order│      ┌──────────┐
└──────────┘      │ PENDING  │
                  └──────────┘
```

**Rules:**
- เฉพาะ DRAFT/REJECTED แก้ไขได้ — แก้ครั้งใหม่จะสร้าง `QuotationVersion` snapshot
- เฉพาะเจ้าของ (Sales) เท่านั้นที่ submit/cancel/edit ของตัวเองได้
- Reject ต้องระบุ reason ≥ 1 char (ไปเก็บใน `rejectionReason` + เพิ่ม comment ให้ Sales เห็น)
- เอกสารหมดอายุ → approve ไม่ได้ (auto-set status = EXPIRED)
- เมื่อ Approved → สร้าง SaleOrder ใน transaction เดียวกัน (snapshot ทุกข้อมูล)

---

## 🧪 Quick API Test

### 1. Login
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sales@example.com","password":"Password@123"}'
```
Save the `accessToken` from response → use as `TOKEN`

### 2. Create Quotation (as Sales)
```bash
curl -X POST http://localhost:4000/api/v1/quotations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "00000000-0000-0000-0000-000000000001",
    "issueDate": "2026-04-27",
    "expiryDate": "2026-05-27",
    "currency": "THB",
    "vatEnabled": true,
    "vatRate": 7,
    "paymentTerms": "Net 30",
    "items": [
      {
        "productName": "Notebook Computer",
        "description": "i5 RAM 16GB",
        "quantity": 2,
        "unit": "pcs",
        "unitPrice": 25000,
        "discount": 5,
        "discountType": "PERCENTAGE"
      }
    ]
  }'
```
→ Returns `{ data: { id, quotationNo: "QT-2026-0001", ... } }`

### 3. Submit for Approval
```bash
curl -X POST http://localhost:4000/api/v1/quotations/<ID>/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Please approve"}'
```

### 4. Login as Approver, Approve
```bash
# Login as approver@example.com first
curl -X POST http://localhost:4000/api/v1/quotations/<ID>/approve \
  -H "Authorization: Bearer $APPROVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Approved"}'
```
→ Returns `{ data: { quotation, saleOrder: { saleOrderNo: "SO-2026-0001" } } }`

### 5. Generate PDF
```bash
curl -X POST http://localhost:4000/api/v1/sale-orders/<SO_ID>/pdf \
  -H "Authorization: Bearer $TOKEN"

# Or download directly:
curl http://localhost:4000/api/v1/sale-orders/<SO_ID>/pdf/download \
  -H "Authorization: Bearer $TOKEN" \
  -o sale-order.pdf
```

---

## ✅ Phase 1 + 2 Status

- [x] Database (14 models)
- [x] Auth (login/refresh/logout/me/change-password)
- [x] Customers CRUD
- [x] Products CRUD (SKU unique)
- [x] Quotations: Create/Update/Submit/Cancel + Versioning
- [x] Approval: Approve (auto-create SO) + Reject (with reason)
- [x] Comments + Activity Log + Notifications
- [x] Sale Orders read + PDF generation (Puppeteer + Sarabun font for Thai)
- [x] Dashboard (Sales + Approver stats)
- [x] File uploads (multer)
- [x] Auto-expire PENDING quotations past expiry date

## 🚧 Phase 3 (Next): Frontend

- Next.js 14 App Router setup
- shadcn/ui + Tailwind
- NextAuth.js + Express JWT bridge
- TH/EN i18n + Light/Dark theme
- Layouts + Sidebar + Header

## 🐛 Troubleshooting

**Puppeteer fails on first PDF generation**
→ Render/Linux: install missing libs, e.g. `apt install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2`. On macOS/Windows มักไม่มีปัญหา.

**`Cannot find module '@prisma/client'`**
→ รัน `npx prisma generate`

**`P2002 Unique constraint`**
→ ข้อมูลซ้ำ (เช่น SKU/email/quotationNo)

**`HAS_ACTIVE_QUOTATIONS` ตอนลบ Customer**
→ Customer มี Quotation status DRAFT/PENDING/APPROVED ค้างอยู่ ต้อง cancel ก่อน

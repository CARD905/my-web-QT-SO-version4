# Project Structure

```
quotation-system/
├── backend/                     # Express.js + TypeScript REST API
│   ├── prisma/
│   │   ├── schema.prisma        # 14 models
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/              # env validation, prisma client
│   │   ├── middleware/          # auth, role, validate, error
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── customers/
│   │   │   ├── products/
│   │   │   ├── quotations/      # ⭐ Core workflow
│   │   │   ├── sale-orders/     # + PDF (Puppeteer)
│   │   │   ├── dashboard/
│   │   │   ├── notifications/
│   │   │   └── uploads/         # Multer attachments
│   │   ├── utils/
│   │   ├── types/
│   │   ├── routes.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── frontend/                    # Next.js 14 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/auth/        # NextAuth handler
│   │   │   ├── login/           # Public login page
│   │   │   ├── (sales)/         # Sales role layout group
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   ├── quotations/
│   │   │   │   ├── sale-orders/
│   │   │   │   ├── customers/
│   │   │   │   └── products/
│   │   │   ├── (approver)/      # Approver role layout group
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   ├── approval-queue/
│   │   │   │   ├── quotations/
│   │   │   │   └── history/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/              # shadcn primitives
│   │   │   ├── layout/          # Sidebar, Header, etc.
│   │   │   └── providers.tsx
│   │   ├── lib/
│   │   │   ├── auth.ts          # NextAuth config
│   │   │   ├── api.ts           # Axios client
│   │   │   ├── i18n.tsx
│   │   │   └── utils.ts
│   │   ├── messages/
│   │   │   ├── th.json
│   │   │   └── en.json
│   │   ├── types/
│   │   └── middleware.ts        # Route protection
│   ├── .env.example
│   ├── components.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   └── package.json
│
├── database/
│   └── schema.sql               # Raw PostgreSQL DDL
│
├── README.md                    # Main entry
├── STRUCTURE.md                 # This file
└── DEPLOYMENT.md                # Render + pgAdmin guide
```

## 🎯 Development Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **1** | Database + Backend Core + Auth | ✅ Done |
| **2** | Backend APIs (CRUD + Approval flow) | ✅ Done |
| **3** | Frontend (Auth, Layout, Pages, i18n, Theme) | ✅ Done |
| **4-6** | (Now merged into Phase 3) | ✅ Done |
| **7** | Deployment Guide | ✅ See DEPLOYMENT.md |

## 🔑 Key Conventions

### Document Numbers
- Quotation: `QT-2026-0001` (atomic per year via `DocumentCounter` table)
- Sale Order: `SO-2026-0001`
- Generated inside Prisma transaction → no race conditions

### Status Lifecycle
- **Quotation:** `DRAFT → PENDING → APPROVED / REJECTED / CANCELLED`, auto-`EXPIRED` after expiry date
- **Sale Order:** `PENDING → CONFIRMED → COMPLETED`, or `CANCELLED`
- Auto-creation: `Quotation.APPROVED` triggers `SaleOrder` creation in same transaction

### Customer Snapshot
ข้อมูลลูกค้า (company, contact, tax id, addresses) ถูก **snapshot** ลงใน `Quotation` และ `SaleOrder` ตอนสร้าง — แก้ไข Customer master ภายหลังจะไม่กระทบเอกสารเก่าที่ออกไปแล้ว

### Soft Delete
- `User`, `Customer`, `Product`, `Quotation`, `SaleOrder` ใช้ `deletedAt` (ไม่ลบจริง)
- การ query ปกติจะกรอง `deletedAt: null` ออกอัตโนมัติ

### Money Precision
- ทุก money field: `Decimal(15, 2)` (max 13 หลักก่อนทศนิยม + 2 หลังทศนิยม)
- VAT rate: `Decimal(5, 2)` (เช่น `7.00`, `15.00`)
- คำนวณ subtotal/discount/VAT/grand total ใน utility `src/utils/calc.ts`

### Audit & Notifications
- ทุก action สำคัญถูกบันทึกใน `activity_logs` (CREATE/UPDATE/SUBMIT/APPROVE/...)
- Activity log + Notification creation **ห้าม block main flow** → ใช้ try/catch swallow
- Notification เกิดจาก: submit (notify all approvers), approve/reject (notify creator), cancel (notify approvers)

### Auth
- Access JWT 15 นาที (signed by backend)
- Refresh Token: opaque random 96-char hex stored in DB, rotated on each refresh
- NextAuth (frontend) จัดการ session + auto-refresh ผ่าน jwt callback
- 401 จาก backend → Axios interceptor บังคับ logout

## 📊 Database Models (14)

| Model | Description |
|-------|-------------|
| `User` | Sales / Approver / Admin |
| `RefreshToken` | JWT refresh storage with rotation |
| `Customer` | Customer master |
| `Product` | Product/service master |
| `Quotation` | + customer snapshot |
| `QuotationItem` | Line items |
| `QuotationVersion` | Snapshot ทุกครั้งที่แก้ไข |
| `QuotationComment` | Thread (Approver/Sales) |
| `QuotationAttachment` | Multer-uploaded files |
| `SaleOrder` | สร้างอัตโนมัติเมื่อ Approved |
| `SaleOrderItem` | Line items (immutable) |
| `ActivityLog` | Audit log ทุก action |
| `Notification` | In-app notification |
| `CompanySettings` | Singleton (ข้อมูลบริษัทผู้ออกเอกสาร) |
| `DocumentCounter` | Counter atomic per year |

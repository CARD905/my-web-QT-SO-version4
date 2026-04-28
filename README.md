# 📋 Quotation & Sale Order Management System

ระบบจัดการใบเสนอราคา (Quotation) และใบสั่งขาย (Sale Order) แบบครบวงจร พร้อม Approval Workflow

> 🇹🇭 **รองรับภาษาไทยเต็มรูปแบบ** — UI รองรับ TH/EN, PDF ใบเสนอราคารองรับฟอนต์ไทย (Sarabun)

---

## ✨ Features

### 👨‍💼 Sales
- Dashboard สรุปยอดส่วนตัว (สถิติตามสถานะ, ใกล้หมดอายุ, ล่าสุด)
- สร้าง / แก้ไข / ส่งอนุมัติ / ยกเลิก Quotation
- เลขที่เอกสาร auto-generate รูปแบบ `QT-2026-0001`
- จัดการ Customer & Product master พร้อม Modal สำหรับเพิ่มใหม่
- Auto-fill ข้อมูลลูกค้าตอนสร้าง Quotation
- ดู Sale Order (ที่สร้างอัตโนมัติเมื่อ Approved)
- Export PDF Sale Order ส่งให้ลูกค้าเซ็น

### 👔 Approver
- Dashboard: 📥 Pending, 💰 มูลค่ารวม, 🔴 High-value, ⏳ ใกล้หมดอายุ, today activity
- Approval Queue พร้อม filter (high-value / expiring) และ visual highlighting
- Quotation Detail (decision view) พร้อม comment thread
- Approve modal (auto-create Sale Order) / Reject modal (ต้องระบุเหตุผล)
- Approval History

### 🔄 Approval Workflow

```
   ┌──────────┐
   │  DRAFT   │ ◄── สร้างใหม่
   └────┬─────┘
        │ submit (Sales)
        ▼
   ┌──────────┐ ──── notify approvers
   │ PENDING  │
   └────┬─────┘
        │
   ┌────┴────┬────────────┐
   │ approve │ reject     │ cancel
   ▼         ▼            ▼
APPROVED   REJECTED    CANCELLED
   │            │
   │       edit & resubmit
   ▼            ▼
SaleOrder   PENDING
(auto)
```

**Rules:**
- เฉพาะ DRAFT/REJECTED แก้ไขได้ — แก้ครั้งใหม่จะสร้าง version snapshot
- เฉพาะเจ้าของ (Sales) เท่านั้น submit/cancel/edit ของตัวเองได้
- Reject ต้องระบุ reason
- เอกสารหมดอายุ → approve ไม่ได้
- Approved → สร้าง Sale Order ใน transaction เดียวกัน (snapshot ทุกข้อมูล)

---

## 🛠️ Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend | Express.js + TypeScript + Zod |
| Database | PostgreSQL 14+ + Prisma ORM |
| Auth | NextAuth.js v5 + JWT (backend) + Refresh Token Rotation |
| PDF | Puppeteer + Sarabun font (รองรับฟอนต์ไทย) |
| i18n | Custom React context (TH / EN) with cookie persistence |
| Theme | Light / Dark mode (next-themes) |
| State | TanStack Query (React Query) |
| Forms | React Hook Form + Zod |
| Toast | Sonner |

---

## 📁 Project Structure

```
quotation-system/
├── backend/         # Express + Prisma API
├── frontend/        # Next.js 14 app
├── database/        # Raw SQL schema (สำหรับ pgAdmin โดยตรง)
├── README.md        # This file
├── STRUCTURE.md     # โครงสร้างโดยละเอียด
└── DEPLOYMENT.md    # คู่มือ deploy ขึ้น Render + pgAdmin
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- pgAdmin (สำหรับ manage DB)

### 1️⃣ Setup Database (PostgreSQL)

เปิด pgAdmin → คลิกขวา Databases → Create Database → ตั้งชื่อ `quotation_db`

### 2️⃣ Setup Backend

```bash
cd backend
npm install
cp .env.example .env
# แก้ DATABASE_URL ให้ตรงกับเครื่อง
# generate secrets: openssl rand -base64 64

npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

→ http://localhost:4000/api/v1/health

### 3️⃣ Setup Frontend

เปิด terminal ใหม่:

```bash
cd frontend
npm install
cp .env.example .env.local
# ตั้ง AUTH_SECRET ให้ตรงกับ NEXTAUTH_SECRET ใน backend/.env

npm run dev
```

→ http://localhost:3000

### 4️⃣ Login

| Role | Email | Password |
|------|-------|----------|
| 👨‍💼 Sales | `sales@example.com` | `Password@123` |
| 👔 Approver | `approver@example.com` | `Password@123` |
| 🔧 Admin | `admin@example.com` | `Password@123` |

---

## 📚 Documentation

- [Backend Setup & API Reference](./backend/README.md) — endpoints, business logic, troubleshooting
- [Frontend Setup & Features](./frontend/README.md) — pages, theme customization, common workflows
- [Project Structure & Conventions](./STRUCTURE.md) — directory tree, design decisions
- [Deployment Guide](./DEPLOYMENT.md) — Render + pgAdmin step-by-step

---

## 🎯 Test the Full Workflow

1. **Login as Sales** (`sales@example.com`)
2. Click **Quotations** → **New Quotation**
3. Select customer (auto-fill), add line items, submit for approval
4. **Logout, Login as Approver** (`approver@example.com`)
5. Go to **Approval Queue** → click the pending quotation
6. Click **Approve** → Sale Order is auto-created
7. **Logout, Login as Sales again**
8. See notification bell 🔔 → "Quotation Approved"
9. Go to **Sale Orders** → click the new SO → **Save PDF** ✨

The PDF is rendered server-side by Puppeteer with Sarabun Thai font (matches your reference template).

---

## 🐛 Common Issues

**Login fails immediately**
→ Frontend `AUTH_SECRET` must match backend `NEXTAUTH_SECRET`

**CORS error**
→ Add `http://localhost:3000` to backend's `ALLOWED_ORIGINS` env var

**PDF generation fails on Linux/Render**
→ Install Chromium dependencies (see [DEPLOYMENT.md](./DEPLOYMENT.md))

**Prisma migrate fails**
→ Make sure PostgreSQL is running and `DATABASE_URL` is correct

---

## 📝 License

Proprietary — Internal use only.

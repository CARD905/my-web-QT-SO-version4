# 🚀 Deployment Guide

คู่มือ deploy ระบบขึ้น Production บน **Render** + **Supabase** (หรือ Render PostgreSQL)

---

## 📋 Overview

```
┌────────────────┐     ┌────────────────┐     ┌─────────────────────┐
│  Frontend      │────▶│   Backend      │────▶│  PostgreSQL          │
│  (Next.js)     │     │   (Express)    │     │  Supabase / Render   │
│  Render Web    │     │   Render Web   │     │                      │
└────────────────┘     └────────────────┘     └─────────────────────┘
                                                       ▲
                                                       │
                                                  ┌─────────┐
                                                  │ pgAdmin │
                                                  │ (Local) │
                                                  └─────────┘
```

---

## 👥 Role ในระบบ (ทั้งหมด 4 roles)

| Role | ชื่อไทย | สิทธิ์หลัก | Login ตัวอย่าง |
|------|---------|-----------|---------------|
| **OFFICER** | พนักงานขาย | สร้าง/แก้ไข Quotation, อัปโหลด PO, ดู Sale Order ของตัวเอง | `officer@wisdom.co.th` |
| **MANAGER** | ผู้จัดการ | อนุมัติ/ปฏิเสธ Quotation ของทีม, ตรวจสอบ Sale Order, ดู Sales Forecast | `manager@wisdom.co.th` |
| **ADMIN** | ผู้ดูแลระบบ | จัดการ Users/Roles/Teams/Departments, ดูข้อมูลทั้งหมด (ไม่ approve Quotation) | `admin@wisdom.co.th` |
| **CEO** | ผู้บริหาร | อนุมัติ Quotation ทุกรายการ, ดู Sales Forecast, ดูข้อมูลทั้งองค์กร | `ceo@wisdom.co.th` |

> ⚠️ **ไม่มี role "Sales" หรือ "Approver"** — OFFICER คือ Sales, MANAGER/CEO คือผู้อนุมัติ

---

## 1️⃣ ตั้งค่า Database

### ตัวเลือก A: Supabase (แนะนำ — ไม่มี 90-day expiry)

1. สร้าง project บน [https://supabase.com](https://supabase.com)
2. ไปที่ **Settings → Database** → คัดลอก **Connection String (Transaction pooler)**
   - Format: `postgresql://postgres.xxxx:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`
3. เก็บ URL ไว้ใช้เป็น `DATABASE_URL` ของ backend

### ตัวเลือก B: Render PostgreSQL

1. ไปที่ [https://dashboard.render.com](https://dashboard.render.com) → **New +** → **PostgreSQL**
2. ตั้งค่า:
   - **Name:** `quotation-db`
   - **Database:** `quotation_db`
   - **User:** `quotation_user`
   - **Region:** Singapore หรือ Oregon
   - **PostgreSQL Version:** 16
   - **Plan:** Free (ทดสอบ) / Starter $7/month (production)
3. กด **Create Database** → รอ ~2 นาที
4. บันทึก **Internal Database URL** (ใช้กับ backend บน Render เดียวกัน)

> ⚠️ **Render Free DB** จะ expire หลัง **90 วัน** — ใช้ Supabase หรือ Render Starter Plan สำหรับ production

---

## 2️⃣ เชื่อมต่อ pgAdmin (Local)

1. เปิด pgAdmin → คลิกขวา **Servers** → **Register** → **Server...**
2. **General tab:**
   - **Name:** `Production DB`
3. **Connection tab:**
   - **Host name/address:** hostname จาก Supabase หรือ Render
   - **Port:** `5432` (Supabase pooler: `6543` สำหรับ session mode)
   - **Maintenance database:** ชื่อ database
   - **Username:** จาก provider
   - **Password:** จาก provider
   - **Save password:** ✓
4. **SSL tab:**
   - **SSL mode:** `Require`
5. กด **Save**

> ⚠️ **ระวัง:** การแก้ไขข้อมูลโดยตรงผ่าน pgAdmin bypass business logic (activity log, notifications, approval flow)

---

## 3️⃣ Deploy Backend บน Render

### 3.1 Push code ขึ้น GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/quotation-system.git
git push -u origin main
```

### 3.2 สร้าง Web Service สำหรับ Backend

1. Render Dashboard → **New +** → **Web Service**
2. เลือก repo
3. ตั้งค่า:
   - **Name:** `quotation-backend`
   - **Region:** เดียวกับ database
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `bash render-build.sh`
   - **Start Command:** `npm start`
   - **Plan:** Free (ทดสอบ) / Starter (production)

### 3.3 สร้างไฟล์ `backend/render-build.sh`

Puppeteer ต้องการ Chromium dependencies บน Linux:

```bash
#!/usr/bin/env bash
set -e

# Install Chromium system deps สำหรับ Puppeteer (PDF generation)
apt-get update -qq && apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libasound2 libpango-1.0-0 libcairo2 \
  fonts-liberation fonts-thai-tlwg-ttf \
  || true

npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

ทำให้ไฟล์ executable:
```bash
chmod +x backend/render-build.sh
git add backend/render-build.sh
git commit -m "Add render build script"
```

### 3.4 Environment Variables — Backend

ใน **Environment** tab เพิ่มทุก key:

| Key | Value | หมายเหตุ |
|-----|-------|---------|
| `NODE_ENV` | `production` | |
| `PORT` | `4000` | |
| `API_PREFIX` | `/api/v1` | |
| `DATABASE_URL` | `postgresql://...` | จาก Supabase หรือ Render Internal URL |
| `JWT_SECRET` | random 64+ chars | `openssl rand -base64 64` |
| `JWT_EXPIRES_IN` | `15m` | |
| `REFRESH_TOKEN_SECRET` | random 64+ chars | **ต้องต่างจาก** `JWT_SECRET` |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` | |
| `NEXTAUTH_SECRET` | random 64+ chars | **จดไว้ — ใส่ frontend ด้วย** |
| `FRONTEND_URL` | `https://quotation-frontend.onrender.com` | อัปเดตหลัง deploy frontend |
| `ALLOWED_ORIGINS` | `https://quotation-frontend.onrender.com` | อัปเดตหลัง deploy frontend |
| `UPLOAD_DIR` | `./uploads` | ⚠️ ดูหมายเหตุ file storage ด้านล่าง |
| `MAX_FILE_SIZE` | `10485760` | 10 MB |
| `PDF_OUTPUT_DIR` | `./uploads/pdfs` | |
| `RATE_LIMIT_WINDOW_MS` | `900000` | 15 นาที |
| `RATE_LIMIT_MAX` | `100` | requests per window |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `true` | ใช้ system Chromium แทน |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium-browser` | path บน Render Linux |

### ⚠️ File Upload Storage (สำคัญ!)

Render's filesystem เป็น **ephemeral** — ไฟล์ที่ upload (PO files, PDF) จะ **หายหลัง redeploy**

**แนวทางแก้ไขสำหรับ production:**

| ตัวเลือก | ราคา | ความยาก |
|---------|------|---------|
| **Supabase Storage** | Free 1GB | ง่าย |
| **Cloudflare R2** | Free 10GB | ง่าย |
| **AWS S3** | Pay per use | ปานกลาง |
| **Render Disk** (add-on) | $0.25/GB/month | ง่ายสุด |

> 💡 **ทางเลือกง่ายที่สุด:** ใน Render → Service → **Disks** → เพิ่ม Persistent Disk ขนาด 1GB mount ที่ `/app/uploads`

### 3.5 Deploy และ Seed

1. กด **Manual Deploy** หรือ push code → รอ 5-10 นาที
2. ทดสอบ: `https://quotation-backend.onrender.com/api/v1/health`
3. **Seed ข้อมูลเริ่มต้น** (ครั้งแรก) ผ่าน Render Shell:

```bash
# Render Dashboard → backend service → Shell tab
npm run prisma:seed
```

หลัง seed จะมี 4 accounts พร้อมใช้ (ดู Section 5)

---

## 4️⃣ Deploy Frontend บน Render

### 4.1 สร้าง Web Service สำหรับ Frontend

1. Render Dashboard → **New +** → **Web Service**
2. ตั้งค่า:
   - **Name:** `quotation-frontend`
   - **Region:** เดียวกัน
   - **Branch:** `main`
   - **Root Directory:** `frontend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free / Starter

### 4.2 Environment Variables — Frontend

| Key | Value | หมายเหตุ |
|-----|-------|---------|
| `NODE_ENV` | `production` | |
| `NEXT_PUBLIC_API_URL` | `https://quotation-backend.onrender.com/api/v1` | |
| `BACKEND_URL` | `https://quotation-backend.onrender.com` | |
| `AUTH_SECRET` | **ต้องตรงกับ `NEXTAUTH_SECRET` ของ backend** | copy มา |
| `NEXTAUTH_URL` | `https://quotation-frontend.onrender.com` | |
| `AUTH_URL` | `https://quotation-frontend.onrender.com` | |

### 4.3 Deploy

รอ 5 นาที → frontend live ที่ `https://quotation-frontend.onrender.com`

### 4.4 อัปเดต CORS ของ Backend

กลับไปที่ **backend** service → Environment → แก้:
- `FRONTEND_URL` = `https://quotation-frontend.onrender.com`
- `ALLOWED_ORIGINS` = `https://quotation-frontend.onrender.com`

→ Backend จะ auto-redeploy

---

## 5️⃣ ทดสอบบน Production

เปิด `https://quotation-frontend.onrender.com` แล้ว login ด้วย:

| Role | Email | Password | สิทธิ์ที่ทดสอบได้ |
|------|-------|----------|-----------------|
| **OFFICER** | `officer@wisdom.co.th` | `Password@123` | สร้าง Quotation, อัปโหลด PO |
| **MANAGER** | `manager@wisdom.co.th` | `Password@123` | อนุมัติ Quotation, ดู Forecast |
| **CEO** | `ceo@wisdom.co.th` | `Password@123` | อนุมัติทุกรายการ, ดู Forecast |
| **ADMIN** | `admin@wisdom.co.th` | `Password@123` | จัดการ Users/Roles |

### ทดสอบ Flow หลัก

1. **Login as OFFICER** (`officer@wisdom.co.th`)
2. สร้าง Quotation → เพิ่ม Line Items → Submit for approval
3. **Login as MANAGER** (`manager@wisdom.co.th`)
4. ไปที่ **Approval Queue** → อนุมัติ → Sale Order ถูกสร้างอัตโนมัติ
5. **Login as OFFICER อีกครั้ง**
6. ระฆัง 🔔 จะแจ้งเตือน "Quotation Approved"
7. ไปที่ **Sale Orders** → อัปโหลด PO → Submit
8. **Login as MANAGER** → ตรวจสอบ Sale Order → Approve
9. ดู **Sales Forecast** (MANAGER/CEO เท่านั้น)

> ⚠️ **เปลี่ยน password และ email ทุก account ก่อนใช้งานจริง!**

---

## 🔄 การ Update โค้ดในภายหลัง

```bash
git add .
git commit -m "Update: [description]"
git push origin main
```

Render จะ auto-redeploy ทั้ง frontend และ backend (~5 นาที)

---

## 🛠️ Manage Database ผ่าน pgAdmin

| งาน | วิธี |
|-----|------|
| ดูข้อมูลทุก table | Object Explorer → Schemas → Tables → View/Edit Rows |
| Backup database | คลิกขวา database → Backup → Format: Custom |
| Restore | คลิกขวา database → Restore |
| แก้ Company Info | แก้ table `company_settings` row เดียว |
| รัน SQL | Query Tool (Ctrl+Shift+Q) |

---

## 📊 Monitoring

| สิ่งที่ดู | วิธี |
|---------|------|
| Logs real-time | Render Dashboard → Service → **Logs** tab |
| CPU / Memory | Render Dashboard → Service → **Metrics** tab |
| Database size | Render Dashboard → Database → **Info** / Supabase Dashboard |
| Activity logs | Admin Panel → Activity Logs (ในระบบ) |
| Sales performance | MANAGER/CEO → **Sales Forecast** |

---

## 💰 Cost Estimate

### Free Tier

| Service | Plan | Limit | ข้อจำกัด |
|---------|------|-------|---------|
| Frontend (Render) | Free | 750 hr/month | Sleep หลัง 15 min idle |
| Backend (Render) | Free | 750 hr/month | Sleep หลัง 15 min idle |
| PostgreSQL (Render) | Free | 1GB | **Expire หลัง 90 วัน** |
| PostgreSQL (Supabase) | Free | 500MB, 2 projects | ไม่ expire |

### Paid (Production แนะนำ)

| Service | ราคา | สิ่งที่ได้เพิ่ม |
|---------|------|--------------|
| Render Starter (per service) | ~$7/month | ไม่ sleep, deploy เร็วขึ้น |
| Render PostgreSQL Starter | $7/month | ไม่ expire, 10GB |
| Render Disk (file uploads) | $0.25/GB/month | Persistent file storage |
| Supabase Pro | $25/month | 8GB DB, 100GB storage |

> 💡 **ค่าใช้จ่ายขั้นต่ำสำหรับ production ที่ stable:** ~$21/month (2 Web Services + 1 DB บน Render Starter)

---

## 🐛 Troubleshooting

### Backend deploy fails: "Cannot find @prisma/client"
```
→ ใส่ npx prisma generate ใน build command ก่อน npm run build
```

### Login ไม่ผ่าน → "RefreshAccessTokenError" หรือ "JWT Error"
```
→ AUTH_SECRET (frontend) ต้องตรงกับ NEXTAUTH_SECRET (backend)
→ ทั้งสองต้องเป็น string เดียวกัน ไม่มี space นำหน้า/ตามหลัง
```

### CORS blocked
```
→ ALLOWED_ORIGINS ต้องเป็น https:// ไม่มี trailing slash
→ ตัวอย่างที่ถูก: https://quotation-frontend.onrender.com
→ ตัวอย่างที่ผิด: https://quotation-frontend.onrender.com/
```

### PDF generation ล้มเหลว / timeout
```
→ ตรวจ PUPPETEER_EXECUTABLE_PATH ว่าชี้ถูก path
→ Free plan memory อาจไม่พอ → upgrade เป็น Starter
→ หรือเปลี่ยนใช้ @sparticuz/chromium (lightweight)
```

### PO files หายหลัง redeploy
```
→ Render ephemeral filesystem — ใส่ Persistent Disk หรือใช้ external storage
→ Render Dashboard → Service → Disks → Add Disk (mount: /app/uploads)
```

### Database connection timeout
```
→ ใช้ Internal Database URL (ไม่ใช่ External) เมื่อ backend อยู่บน Render เดียวกัน
→ Supabase: ใช้ Transaction Pooler URL สำหรับ Prisma
```

### "Service Unavailable" / ช้ามากหลังไม่มี traffic
```
→ Free plan sleep หลัง 15 นาที
→ ตั้ง UptimeRobot (https://uptimerobot.com) ping /api/v1/health ทุก 5 นาที — ฟรี
→ หรือ upgrade เป็น Starter plan
```

### Seed ไม่ผ่าน: "Unique constraint failed"
```
→ Seed ออกแบบมาให้รัน idempotent (ซ้ำได้) — ถ้า error ให้ดู log ว่า table ไหน
→ หากต้องการ reset: ลบ DB แล้วสร้างใหม่ + migrate + seed
```

### Prisma migrate deploy ล้มเหลว
```
→ ตรวจ DATABASE_URL ว่าถูกต้อง
→ Supabase: ต้องใช้ Direct URL (ไม่ใช่ pooler) สำหรับ migrate
   เพิ่ม DIRECT_URL ใน schema.prisma datasource:
   directUrl = env("DIRECT_URL")
```

---

## 🔒 Security Checklist (ก่อน Go-Live)

### Accounts & Secrets
- [ ] เปลี่ยน password และ email ของทุก seed account (officer/manager/ceo/admin @wisdom.co.th)
- [ ] ใช้ secrets ที่ random จริง (`openssl rand -base64 64`) — อย่า reuse จาก dev
- [ ] `JWT_SECRET` ≠ `REFRESH_TOKEN_SECRET` ≠ `NEXTAUTH_SECRET` (3 ค่าต่างกัน)
- [ ] ไม่ commit `.env` ขึ้น Git — ใส่ใน `.gitignore`

### Application
- [ ] `NODE_ENV=production` ทั้ง frontend และ backend
- [ ] HTTPS เท่านั้น (Render auto-provides TLS/Let's Encrypt)
- [ ] `ALLOWED_ORIGINS` ระบุเฉพาะ domain ที่ trust
- [ ] Rate limiting เปิดอยู่ (มีอยู่แล้วใน backend)

### Database
- [ ] ตั้ง Company Info จริงใน `company_settings` ผ่าน Admin Panel หรือ pgAdmin
- [ ] Backup database ก่อน go-live (pg_dump ผ่าน pgAdmin)
- [ ] ตั้ง schedule backup (Supabase: auto daily backup บน Pro plan)

### OFFICER/MANAGER Roles
- [ ] สร้าง user จริงผ่าน Admin Panel (Admin → Users → Invite)
- [ ] กำหนด Team ให้ OFFICER แต่ละคน เพื่อให้ MANAGER เห็นได้ถูกต้อง
- [ ] ตรวจสอบ approval limit ของ MANAGER แต่ละคน (default: 100,000 บาท)
- [ ] CEO มีสิทธิ์ approve ทุกรายการโดยไม่มี limit

### Monitoring
- [ ] ตั้ง UptimeRobot หรือ Betterstack monitor ที่ `/api/v1/health`
- [ ] ดู Activity Logs ใน Admin Panel เป็นระยะ
- [ ] Monitor Sales Forecast ผ่าน MANAGER/CEO dashboard

---

## 📚 References

- [Render Docs](https://render.com/docs)
- [Render PostgreSQL](https://render.com/docs/databases)
- [Render Persistent Disks](https://render.com/docs/disks)
- [Render Environment Variables](https://render.com/docs/configure-environment-variables)
- [Supabase Docs](https://supabase.com/docs)
- [Supabase + Prisma](https://supabase.com/docs/guides/database/prisma)
- [pgAdmin Docs](https://www.pgadmin.org/docs/)
- [UptimeRobot (free keep-alive)](https://uptimerobot.com)

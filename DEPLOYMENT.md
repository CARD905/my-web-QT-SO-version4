# 🚀 Deployment Guide

คู่มือ deploy ระบบขึ้น Production บน **Render** + **pgAdmin** (จัดการ DB)

---

## 📋 Overview

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  Frontend      │────▶│   Backend      │────▶│  PostgreSQL    │
│  (Next.js)     │     │   (Express)    │     │  (Render DB)   │
│  Render Web    │     │   Render Web   │     │                │
└────────────────┘     └────────────────┘     └────────────────┘
                                                       ▲
                                                       │
                                                  ┌─────────┐
                                                  │ pgAdmin │
                                                  │ (Local) │
                                                  └─────────┘
```

---

## 1️⃣ สร้าง PostgreSQL Database บน Render

1. ไปที่ https://dashboard.render.com → **New +** → **PostgreSQL**
2. ตั้งค่า:
   - **Name:** `quotation-db`
   - **Database:** `quotation_db`
   - **User:** `quotation_user`
   - **Region:** เลือก Singapore หรือ Oregon
   - **PostgreSQL Version:** 16
   - **Plan:** Free (สำหรับทดสอบ)
3. กด **Create Database** → รอ ~2 นาที

หลังสร้างเสร็จ จะได้ค่า:
- **Internal Database URL** — ใช้กับ backend ที่ deploy บน Render เดียวกัน
- **External Database URL** — ใช้จาก pgAdmin เครื่องคุณ
- **Username, Password, Hostname, Port (default 5432)**

> 💡 **เก็บข้อมูล connection ไว้ — จะใช้ในขั้นตอนต่อไป**

---

## 2️⃣ เชื่อมต่อ pgAdmin

1. เปิด pgAdmin → คลิกขวา **Servers** → **Register** → **Server...**
2. **General tab:**
   - **Name:** `Render Quotation DB`
3. **Connection tab:**
   - **Host name/address:** จาก Render (เช่น `dpg-xxxxx-a.singapore-postgres.render.com`)
   - **Port:** `5432`
   - **Maintenance database:** `quotation_db`
   - **Username:** `quotation_user`
   - **Password:** จาก Render
   - **Save password:** ✓
4. **SSL tab:**
   - **SSL mode:** `Require`
5. กด **Save**

หากเชื่อมต่อสำเร็จจะเห็น database `quotation_db` พร้อมใช้งาน

> ⚠️ **ปัญหาที่พบบ่อย:** Render Free Plan จะ disconnect database หลัง 90 วันถ้าไม่ใช้ — backup ข้อมูลเป็นระยะ

---

## 3️⃣ Deploy Backend บน Render

### 3.1 Push code ขึ้น GitHub

```bash
cd quotation-system
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/quotation-system.git
git push -u origin main
```

### 3.2 สร้าง Web Service สำหรับ Backend

1. Render Dashboard → **New +** → **Web Service**
2. เลือก repo `quotation-system`
3. ตั้งค่า:
   - **Name:** `quotation-backend`
   - **Region:** เดียวกับ database
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:**
     ```
     npm install && npx prisma generate && npx prisma migrate deploy && npm run build
     ```
   - **Start Command:**
     ```
     npm start
     ```
   - **Plan:** Free (Starter)

### 3.3 Environment Variables

ใน **Environment** tab เพิ่ม:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `API_PREFIX` | `/api/v1` |
| `DATABASE_URL` | Internal Database URL จาก Render |
| `JWT_SECRET` | Random 64+ chars (`openssl rand -base64 64`) |
| `JWT_EXPIRES_IN` | `15m` |
| `REFRESH_TOKEN_SECRET` | Random 64+ chars (different from JWT_SECRET) |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` |
| `NEXTAUTH_SECRET` | Random 64+ chars (จะใส่ frontend ด้วย) |
| `FRONTEND_URL` | `https://quotation-frontend.onrender.com` (จะรู้หลัง deploy frontend) |
| `ALLOWED_ORIGINS` | `https://quotation-frontend.onrender.com` |
| `UPLOAD_DIR` | `./uploads` |
| `MAX_FILE_SIZE` | `10485760` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX` | `100` |
| `PDF_OUTPUT_DIR` | `./uploads/pdfs` |

### 3.4 ⚠️ Puppeteer dependencies (สำคัญ!)

Render Linux ต้องติดตั้ง Chromium dependencies เพิ่ม สร้างไฟล์ `backend/render-build.sh`:

```bash
#!/usr/bin/env bash
set -e

# Install Chromium dependencies (sudo not available - use apt-get directly)
apt-get update -qq && apt-get install -y \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2 \
  fonts-liberation || true

npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

หรือเปลี่ยน Build Command ใน Render UI เป็น `bash render-build.sh`

> 💡 อีกทางเลือก: ถ้า Render ไม่อนุญาต apt-get — ใช้ Render's **Native Runtime** หรือใช้ **Docker** (สร้าง Dockerfile ที่ใช้ `node:20-slim` + `chromium`)

### 3.5 กด Deploy

รอ 5-10 นาที → backend จะ live ที่ `https://quotation-backend.onrender.com`

ทดสอบ: `https://quotation-backend.onrender.com/api/v1/health`

### 3.6 Seed initial data

หลัง deploy สำเร็จครั้งแรก:

```bash
# จาก Render Shell tab ของ backend service:
npm run prisma:seed
```

---

## 4️⃣ Deploy Frontend บน Render

### 4.1 สร้าง Web Service สำหรับ Frontend

1. Render Dashboard → **New +** → **Web Service**
2. เลือก repo เดียวกัน
3. ตั้งค่า:
   - **Name:** `quotation-frontend`
   - **Region:** เดียวกัน
   - **Branch:** `main`
   - **Root Directory:** `frontend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free

### 4.2 Environment Variables

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_API_URL` | `https://quotation-backend.onrender.com/api/v1` |
| `BACKEND_URL` | `https://quotation-backend.onrender.com` |
| `AUTH_SECRET` | **ต้องตรงกับ `NEXTAUTH_SECRET` ของ backend** |
| `NEXTAUTH_URL` | `https://quotation-frontend.onrender.com` |
| `AUTH_URL` | `https://quotation-frontend.onrender.com` |

### 4.3 กด Deploy

รอ 5 นาที → frontend จะ live ที่ `https://quotation-frontend.onrender.com`

### 4.4 อัปเดต CORS ของ Backend

กลับไปที่ **backend** service → Environment → แก้:
- `FRONTEND_URL` = `https://quotation-frontend.onrender.com`
- `ALLOWED_ORIGINS` = `https://quotation-frontend.onrender.com`

→ Backend จะ auto-redeploy

---

## 5️⃣ ทดสอบบน Production

1. เปิด `https://quotation-frontend.onrender.com`
2. Login ด้วย test account: `sales@example.com` / `Password@123`
3. ทดสอบ flow ทั้งหมด

---

## 🔄 การ Update โค้ดในภายหลัง

แค่ push เข้า GitHub:

```bash
git add .
git commit -m "Update X feature"
git push origin main
```

Render จะ auto-deploy ทั้ง frontend และ backend

---

## 🛠️ การ Manage Database ผ่าน pgAdmin

หลัง deploy แล้ว สามารถใช้ pgAdmin เครื่อง local:
- ดูข้อมูลทุก table
- รัน SQL query เอง
- Backup/Restore database
- แก้ไขข้อมูลโดยตรง

> ⚠️ **ระวัง:** การแก้ไขข้อมูลโดยตรงผ่าน pgAdmin **bypass business logic** เช่น activity log, notifications

---

## 📊 Monitoring

- **Logs:** Render Dashboard → Service → Logs tab (real-time)
- **Metrics:** Render Dashboard → Service → Metrics tab (CPU, Memory, Bandwidth)
- **Database size:** Render Dashboard → Database → Info

---

## 💰 Cost Estimate (Free Tier)

| Service | Free Plan | Limit |
|---------|-----------|-------|
| Frontend (Web Service) | ✅ Free | 750 hr/month, sleeps after 15 min idle |
| Backend (Web Service) | ✅ Free | 750 hr/month, sleeps after 15 min idle |
| PostgreSQL Database | ✅ Free | 1GB storage, 90 days lifetime |

> ⚠️ **Free plan limitations:**
> - Web services จะ "sleep" หลัง 15 นาทีไม่มี traffic → request แรกหลัง wake จะช้า ~30 วินาที
> - Database Free จะถูก expire หลัง 90 วัน — backup เป็นระยะ
> - สำหรับ production ใช้งานจริงแนะนำ **Starter Plan** (~$7/month/service)

---

## 🐛 Troubleshooting

### Backend deploy fails: "Cannot find @prisma/client"
→ ใส่ `npx prisma generate` ใน Build Command ก่อน `npm run build`

### Login จาก frontend ไม่ผ่าน → "RefreshAccessTokenError"
→ Check `AUTH_SECRET` (frontend) === `NEXTAUTH_SECRET` (backend)

### CORS blocked
→ Check `ALLOWED_ORIGINS` ของ backend มี URL ของ frontend แบบ exact match (https://, no trailing slash)

### PDF generation timeout
→ Puppeteer ใช้ memory เยอะ — Free plan อาจไม่พอ. Upgrade เป็น Starter หรือเปลี่ยนเป็น `@sparticuz/chromium` (lightweight)

### Database connection slow
→ Free plan database อาจจะ slow. ใช้ **Internal Database URL** (ไม่ใช่ External) เพื่อให้เชื่อมต่อภายใน Render network

### "Service Unavailable" หลังไม่ใช้นาน
→ Free plan sleep หลัง 15 นาที → request แรกจะช้า. ตั้ง cron-job เช็ค `/health` ทุก 10 นาทีเพื่อ keep-alive

---

## 🔒 Security Checklist (Production)

- [ ] เปลี่ยน default password ของ test users (sales/approver/admin) — หรือลบทิ้ง
- [ ] ใช้ secrets ที่ random จริง (`openssl rand -base64 64`) อย่า reuse จาก dev
- [ ] เปิด HTTPS เท่านั้น (Render auto-provides Let's Encrypt)
- [ ] Set `NODE_ENV=production`
- [ ] Backup database เป็นระยะ (pg_dump ผ่าน pgAdmin หรือ Render snapshot)
- [ ] Review `ALLOWED_ORIGINS` — เฉพาะ domain ที่ trust
- [ ] เปิด rate limiting (มีอยู่แล้วใน backend)
- [ ] Monitor activity_logs เป็นระยะ
- [ ] เปลี่ยน `CompanySettings` ผ่าน pgAdmin ให้เป็นข้อมูลบริษัทจริง

---

## 📚 References

- [Render Docs](https://render.com/docs)
- [Render PostgreSQL](https://render.com/docs/databases)
- [Render Environment Variables](https://render.com/docs/configure-environment-variables)
- [pgAdmin Docs](https://www.pgadmin.org/docs/)

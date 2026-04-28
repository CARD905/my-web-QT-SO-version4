# Quotation System – Frontend

Next.js 14 App Router frontend for the Quotation & Sale Order Management System

## 🛠️ Tech Stack

- **Next.js** 14 (App Router) + **TypeScript**
- **NextAuth.js** v5 (Credentials provider + JWT bridge to Express)
- **shadcn/ui** + **Tailwind CSS** (custom theme)
- **next-themes** Light/Dark mode
- **Custom i18n** TH/EN with cookie-based persistence
- **React Hook Form** + **Zod** validation
- **Axios** + auto-refresh interceptor
- **TanStack Query** (React Query) for caching
- **Sonner** Toast notifications
- **Lucide React** Icons

## 📁 Project Structure

```
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── api/auth/[...nextauth]/route.ts   # NextAuth handler
│   │   ├── login/                            # Public login page
│   │   ├── (sales)/                          # Sales role layout
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── quotations/
│   │   │   │   ├── page.tsx                  # List
│   │   │   │   ├── new/page.tsx              # Create form (matches screenshot!)
│   │   │   │   └── [id]/page.tsx             # Detail
│   │   │   ├── sale-orders/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx             # With PDF download
│   │   │   ├── customers/page.tsx            # With New Customer modal
│   │   │   └── products/page.tsx             # With New Product modal
│   │   ├── (approver)/                       # Approver role layout
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   ├── approval-queue/
│   │   │   ├── quotations/[id]/page.tsx      # Decision view + Approve/Reject
│   │   │   └── history/
│   │   ├── globals.css                       # Theme tokens (Light/Dark)
│   │   ├── layout.tsx                        # Root + Providers
│   │   └── page.tsx                          # Redirect by role
│   ├── components/
│   │   ├── ui/                               # shadcn components
│   │   ├── layout/                           # Sidebar, Header, etc.
│   │   └── providers.tsx                     # NextAuth + Theme + i18n + Query
│   ├── lib/
│   │   ├── auth.ts                           # NextAuth config (with refresh rotation)
│   │   ├── auth-handler.ts                   # API route exports
│   │   ├── api.ts                            # Axios client
│   │   ├── server-fetch.ts                   # Server-side fetch helper
│   │   ├── i18n.tsx                          # Translation provider
│   │   └── utils.ts                          # cn(), formatMoney, formatDate, etc.
│   ├── messages/
│   │   ├── th.json
│   │   └── en.json
│   ├── types/
│   │   ├── api.ts                            # Backend response types
│   │   └── next-auth.d.ts                    # NextAuth augmentation
│   └── middleware.ts                         # Auth route protection
├── .env.example
├── components.json                           # shadcn config
├── next.config.mjs
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## 🚀 Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

แก้ไข `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
BACKEND_URL=http://localhost:4000

# IMPORTANT: ต้องตรงกับ NEXTAUTH_SECRET ใน backend/.env!
AUTH_SECRET="<your secret - same as backend NEXTAUTH_SECRET>"
NEXTAUTH_URL=http://localhost:3000
```

> Generate secret: `openssl rand -base64 64`

### 3. Run backend first

```bash
# In backend directory
cd ../backend
npm run dev
```

### 4. Run frontend

```bash
# In frontend directory
npm run dev
```

→ http://localhost:3000

## 🔐 Test Accounts

| Role | Email | Password |
|------|-------|----------|
| 👨‍💼 Sales | `sales@example.com` | `Password@123` |
| 👔 Approver | `approver@example.com` | `Password@123` |
| 🔧 Admin | `admin@example.com` | `Password@123` |

## ✨ Features

### Sales User
- ✅ Dashboard: stats cards, status breakdown, expiring soon, recent quotations
- ✅ Quotations: list with search/filter, **New Quotation form** (matches screenshot!) with auto-fill, line items, real-time calculation, save draft / submit for approval
- ✅ Quotation detail: status flow, submit/cancel
- ✅ Sale Orders: read-only list, **PDF download** (Puppeteer-rendered with Thai font)
- ✅ Customers: list with **New Customer modal**
- ✅ Products: list with **New Product modal**

### Approver User
- ✅ Dashboard: 📥 pending count, 💰 total value, 🔴 high-value, ⏳ expiring soon, today's activity
- ✅ Approval Queue: filterable, highlighted high-value (red border) and expiring badges
- ✅ Quotation Detail: full decision view with **big grand total**, comments thread
- ✅ **Approve modal** (auto-creates Sale Order) / **Reject modal** (requires reason)
- ✅ History: approved/rejected past quotations

### Cross-cutting
- ✅ Login page with show/hide password
- ✅ TH/EN language toggle (saved in cookie)
- ✅ Light/Dark/System theme (next-themes)
- ✅ **Notification bell** with unread badge, polls every 60s
- ✅ User menu with logout
- ✅ Collapsible sidebar
- ✅ Auto refresh access token (NextAuth callback) → no manual logout when JWT expires
- ✅ Role-based middleware redirect (Sales → /dashboard, Approver → /approver/dashboard)
- ✅ Mobile-friendly responsive design

## 🎨 Theme Customization

แก้ที่ `src/app/globals.css` — CSS variables HSL format. เปลี่ยน primary color:

```css
:root {
  --primary: 221 83% 53%; /* blue */
}
```

Examples:
- Blue: `221 83% 53%`
- Green: `142 71% 45%`
- Purple: `262 83% 58%`
- Orange: `25 95% 53%`

## 🧪 Common Workflows to Test

### Sales Flow
1. Login as `sales@example.com`
2. Dashboard → see stats
3. **Quotations → New Quotation** → fill form → Save Draft
4. From detail page → Submit for Approval
5. Wait → Sales gets notification when Approved/Rejected
6. **Sale Orders → click one → Save PDF** (downloads with Thai font!)

### Approver Flow
1. Login as `approver@example.com`
2. **Approval Queue** → see pending requests
3. Click one → review details → **Approve** (auto-creates Sale Order) or **Reject with reason**
4. **History** → see past decisions

## 🚧 Troubleshooting

**`AUTH_SECRET` mismatch** → Frontend cannot login
→ Make sure `AUTH_SECRET` (frontend) === `NEXTAUTH_SECRET` (backend)

**Login succeeds but immediately logged out**
→ Backend must be running and reachable at `BACKEND_URL`. Check browser console for CORS errors.

**CORS blocked**
→ Add `http://localhost:3000` to backend's `ALLOWED_ORIGINS` in `.env`

**`getSession` not working in API client**
→ Make sure `<SessionProvider>` is wrapping your app (already done in `providers.tsx`)

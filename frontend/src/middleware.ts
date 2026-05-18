// frontend/src/middleware.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ✅ Routes ที่ ADMIN ไม่ควรเข้า (business pages)
const ADMIN_BLOCKED = [
  '/quotations',
  '/sale-orders',
  '/special-discount',
  '/approval-queue',
  '/history',
  '/team',
];

// ✅ Routes ที่ OFFICER ไม่ควรเข้า
const OFFICER_BLOCKED = [
  '/admin',
  '/approval-queue',
  '/history',
  '/team',
];

export default auth((req: NextRequest & { auth: any }) => {
  const role = req.auth?.user?.role as string | undefined;
  const path = req.nextUrl.pathname;

  if (!role) return NextResponse.next();

  // Block ADMIN จาก business pages
  if (role === 'ADMIN') {
    const blocked = ADMIN_BLOCKED.some((p) => path === p || path.startsWith(p + '/'));
    if (blocked) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
  }

  // Block OFFICER จาก management pages
  if (role === 'OFFICER' || role === 'SALES') {
    const blocked = OFFICER_BLOCKED.some((p) => path === p || path.startsWith(p + '/'));
    if (blocked) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|invite|login).*)',
  ],
};
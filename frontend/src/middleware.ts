import { auth } from '@/lib/auth';

export default auth;

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};

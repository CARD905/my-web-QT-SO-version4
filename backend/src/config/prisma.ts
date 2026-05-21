import { PrismaClient } from '@prisma/client';
import { isDev } from './env';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Render PgBouncer session mode has a hard cap of pool_size connections.
// Cap Prisma's own pool to avoid "max clients reached" on startup.
function buildDbUrl(raw: string | undefined): string {
  if (!raw) return '';
  let url = raw;
  // Supabase session-mode pooler (port 5432) has a hard pool_size cap shared across
  // all clients. Switch to transaction-mode pooler (port 6543) automatically when
  // pgbouncer=true is present — transaction mode has no per-session connection limit.
  if (url.includes('pgbouncer=true') && url.includes(':5432/')) {
    url = url.replace(':5432/', ':6543/');
  }
  if (url.includes('connection_limit')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=3&pool_timeout=10`;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: isDev ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: { url: buildDbUrl(process.env.DATABASE_URL) },
    },
  });

if (isDev) {
  global.prisma = prisma;
}

export default prisma;

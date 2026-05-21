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
  if (raw.includes('connection_limit')) return raw;
  const sep = raw.includes('?') ? '&' : '?';
  // 5 = safe default (leaves headroom for migrations / admin tools)
  return `${raw}${sep}connection_limit=5&pool_timeout=20`;
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

import { PrismaClient } from '@prisma/client';
import { isDev } from './env';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: isDev ? ['query', 'error', 'warn'] : ['error'],
  });

if (isDev) {
  global.prisma = prisma;
}

export default prisma;

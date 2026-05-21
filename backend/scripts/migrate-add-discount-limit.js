require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL || '';
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  console.log('Adding discount_limit column to users...');
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "discount_limit" DECIMAL(5,2)`
  );
  console.log('Migration complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

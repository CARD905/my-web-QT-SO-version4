require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL || '';
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  console.log('Creating product_categories table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "product_categories" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_name_key" ON "product_categories"("name")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "product_categories_is_active_idx" ON "product_categories"("is_active")`);

  console.log('Adding category_id column to products...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" TEXT`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "products_category_id_idx" ON "products"("category_id")`);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey') THEN
        ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey"
          FOREIGN KEY ("category_id") REFERENCES "product_categories"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END;
    $$
  `);

  console.log('Migration complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

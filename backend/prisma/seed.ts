/**
 * Prisma Seed Script
 *
 * Creates initial data for development:
 * - 1 Sales user
 * - 1 Approver user
 * - 1 Admin user
 * - 3 Sample customers
 * - 5 Sample products
 * - Default company settings (if not exists)
 *
 * Run: npm run prisma:seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ============== USERS ==============
  console.log('👤 Creating users...');

  const passwordHash = await bcrypt.hash('Password@123', 12);

  const sales = await prisma.user.upsert({
    where: { email: 'sales@example.com' },
    update: {},
    create: {
      email: 'sales@example.com',
      password: passwordHash,
      name: 'พนักงานขาย ทดสอบ',
      role: 'SALES',
      phone: '081-234-5678',
      preferredLang: 'th',
      preferredTheme: 'light',
    },
  });
  console.log(`   ✅ Sales:    ${sales.email}  (password: Password@123)`);

  const approver = await prisma.user.upsert({
    where: { email: 'approver@example.com' },
    update: {},
    create: {
      email: 'approver@example.com',
      password: passwordHash,
      name: 'ผู้อนุมัติ ทดสอบ',
      role: 'APPROVER',
      phone: '081-234-5679',
      preferredLang: 'th',
      preferredTheme: 'light',
    },
  });
  console.log(`   ✅ Approver: ${approver.email}  (password: Password@123)`);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: passwordHash,
      name: 'ผู้ดูแลระบบ',
      role: 'ADMIN',
      phone: '081-234-5680',
      preferredLang: 'th',
      preferredTheme: 'light',
    },
  });
  console.log(`   ✅ Admin:    ${admin.email}  (password: Password@123)\n`);

  // ============== COMPANY SETTINGS ==============
  console.log('🏢 Creating company settings...');
  const existingCompany = await prisma.companySettings.findFirst();
  if (!existingCompany) {
    await prisma.companySettings.create({
      data: {
        companyName: 'Your Company Co., Ltd.',
        companyNameTh: 'บริษัท ของคุณ จำกัด',
        taxId: '0105561234567',
        address: '123 Sukhumvit Rd, Watthana, Bangkok 10110',
        addressTh: '123 ถนนสุขุมวิท แขวงคลองเตย เขตวัฒนา กรุงเทพฯ 10110',
        phone: '02-123-4567',
        fax: '02-123-4568',
        email: 'info@yourcompany.com',
        website: 'https://yourcompany.com',
        defaultVatRate: 7,
        defaultPaymentTerms: 'Net 30',
        defaultCurrency: 'THB',
        quotationPrefix: 'QT',
        saleOrderPrefix: 'SO',
        bankName: 'Kasikorn Bank',
        bankAccount: '123-4-56789-0',
        bankBranch: 'Sukhumvit',
      },
    });
    console.log('   ✅ Company settings created\n');
  } else {
    console.log('   ⏭️  Company settings already exist\n');
  }

  // ============== CUSTOMERS ==============
  console.log('🤝 Creating sample customers...');

  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        contactName: 'คุณสมชาย ใจดี',
        company: 'บริษัท เอบีซี จำกัด',
        taxId: '0105551234567',
        email: 'somchai@abc.co.th',
        phone: '02-555-1234',
        billingAddress: '99/1 ถ.พระราม 9 ห้วยขวาง กรุงเทพฯ 10310',
        shippingAddress: '99/1 ถ.พระราม 9 ห้วยขวาง กรุงเทพฯ 10310',
        notes: 'ลูกค้า VIP',
        createdById: sales.id,
      },
    }),
    prisma.customer.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        contactName: 'คุณวันดี รักงาน',
        company: 'บริษัท เอ็กซ์วายแซด จำกัด',
        taxId: '0105557654321',
        email: 'wandee@xyz.co.th',
        phone: '02-555-5678',
        billingAddress: '55/8 ถ.สุขุมวิท คลองเตย กรุงเทพฯ 10110',
        shippingAddress: '55/8 ถ.สุขุมวิท คลองเตย กรุงเทพฯ 10110',
        createdById: sales.id,
      },
    }),
    prisma.customer.upsert({
      where: { id: '00000000-0000-0000-0000-000000000003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000003',
        contactName: 'Mr. John Smith',
        company: 'Global Trade Co., Ltd.',
        taxId: '0105559876543',
        email: 'john@globaltrade.com',
        phone: '02-555-9999',
        billingAddress: '88 Rama IV Rd, Pathumwan, Bangkok 10330',
        shippingAddress: '88 Rama IV Rd, Pathumwan, Bangkok 10330',
        createdById: sales.id,
      },
    }),
  ]);
  console.log(`   ✅ ${customers.length} customers created\n`);

  // ============== PRODUCTS ==============
  console.log('📦 Creating sample products...');

  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'PRD-0001' },
      update: {},
      create: {
        sku: 'PRD-0001',
        name: 'Notebook Computer Standard',
        description: 'โน้ตบุ๊ก 15.6" Intel Core i5, RAM 16GB, SSD 512GB',
        unitPrice: 25000,
        unit: 'pcs',
        createdById: sales.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PRD-0002' },
      update: {},
      create: {
        sku: 'PRD-0002',
        name: 'Wireless Mouse',
        description: 'เมาส์ไร้สาย 2.4GHz รับประกัน 1 ปี',
        unitPrice: 450,
        unit: 'pcs',
        createdById: sales.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PRD-0003' },
      update: {},
      create: {
        sku: 'PRD-0003',
        name: 'Mechanical Keyboard',
        description: 'คีย์บอร์ด Mechanical RGB Switch สีน้ำเงิน',
        unitPrice: 1890,
        unit: 'pcs',
        createdById: sales.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'PRD-0004' },
      update: {},
      create: {
        sku: 'PRD-0004',
        name: 'Monitor 24" Full HD',
        description: 'จอมอนิเตอร์ 24 นิ้ว IPS Full HD 75Hz',
        unitPrice: 4500,
        unit: 'pcs',
        createdById: sales.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'SVC-0001' },
      update: {},
      create: {
        sku: 'SVC-0001',
        name: 'On-site Installation Service',
        description: 'บริการติดตั้งและตั้งค่านอกสถานที่',
        unitPrice: 1500,
        unit: 'hr',
        createdById: sales.id,
      },
    }),
  ]);
  console.log(`   ✅ ${products.length} products created\n`);

  // ============== DOCUMENT COUNTERS ==============
  console.log('🔢 Initializing document counters...');
  const currentYear = new Date().getFullYear();
  await prisma.documentCounter.upsert({
    where: { prefix_year: { prefix: 'QT', year: currentYear } },
    update: {},
    create: { prefix: 'QT', year: currentYear, counter: 0 },
  });
  await prisma.documentCounter.upsert({
    where: { prefix_year: { prefix: 'SO', year: currentYear } },
    update: {},
    create: { prefix: 'SO', year: currentYear, counter: 0 },
  });
  console.log(`   ✅ Counters ready for year ${currentYear}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Seeding completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📝 Test accounts:');
  console.log('   Sales:    sales@example.com    / Password@123');
  console.log('   Approver: approver@example.com / Password@123');
  console.log('   Admin:    admin@example.com    / Password@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

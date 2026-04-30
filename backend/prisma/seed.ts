import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS_DATA: Array<{
  code: string;
  resource: string;
  action: string;
  scope: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL';
  nameTh: string;
  nameEn: string;
  groupKey: string;
}> = [
  // Quotation
  { code: 'quotation:view:own', resource: 'quotation', action: 'view', scope: 'OWN', nameTh: 'ดูใบเสนอราคาของตัวเอง', nameEn: 'View own quotations', groupKey: 'quotation' },
  { code: 'quotation:view:team', resource: 'quotation', action: 'view', scope: 'TEAM', nameTh: 'ดูใบเสนอราคาของทีม', nameEn: 'View team quotations', groupKey: 'quotation' },
  { code: 'quotation:view:all', resource: 'quotation', action: 'view', scope: 'ALL', nameTh: 'ดูใบเสนอราคาทั้งหมด', nameEn: 'View all quotations', groupKey: 'quotation' },
  { code: 'quotation:create:own', resource: 'quotation', action: 'create', scope: 'OWN', nameTh: 'สร้างใบเสนอราคา', nameEn: 'Create quotation', groupKey: 'quotation' },
  { code: 'quotation:update:own', resource: 'quotation', action: 'update', scope: 'OWN', nameTh: 'แก้ไขใบเสนอราคาของตัวเอง', nameEn: 'Edit own quotation', groupKey: 'quotation' },
  { code: 'quotation:cancel:own', resource: 'quotation', action: 'cancel', scope: 'OWN', nameTh: 'ยกเลิกใบเสนอราคาของตัวเอง', nameEn: 'Cancel own quotation', groupKey: 'quotation' },
  { code: 'quotation:submit:own', resource: 'quotation', action: 'submit', scope: 'OWN', nameTh: 'ส่งขออนุมัติ', nameEn: 'Submit for approval', groupKey: 'quotation' },
  { code: 'quotation:approve:team', resource: 'quotation', action: 'approve', scope: 'TEAM', nameTh: 'อนุมัติของทีม', nameEn: 'Approve team quotations', groupKey: 'quotation' },
  { code: 'quotation:approve:all', resource: 'quotation', action: 'approve', scope: 'ALL', nameTh: 'อนุมัติทั้งหมด', nameEn: 'Approve any quotation', groupKey: 'quotation' },
  { code: 'quotation:reject:team', resource: 'quotation', action: 'reject', scope: 'TEAM', nameTh: 'ปฏิเสธของทีม', nameEn: 'Reject team quotations', groupKey: 'quotation' },
  { code: 'quotation:reject:all', resource: 'quotation', action: 'reject', scope: 'ALL', nameTh: 'ปฏิเสธทั้งหมด', nameEn: 'Reject any quotation', groupKey: 'quotation' },

  // Sale Order
  { code: 'saleOrder:view:own', resource: 'saleOrder', action: 'view', scope: 'OWN', nameTh: 'ดูใบสั่งขายของตัวเอง', nameEn: 'View own sale orders', groupKey: 'saleOrder' },
  { code: 'saleOrder:view:team', resource: 'saleOrder', action: 'view', scope: 'TEAM', nameTh: 'ดูใบสั่งขายของทีม', nameEn: 'View team sale orders', groupKey: 'saleOrder' },
  { code: 'saleOrder:view:all', resource: 'saleOrder', action: 'view', scope: 'ALL', nameTh: 'ดูใบสั่งขายทั้งหมด', nameEn: 'View all sale orders', groupKey: 'saleOrder' },
  { code: 'saleOrder:exportPdf:all', resource: 'saleOrder', action: 'exportPdf', scope: 'ALL', nameTh: 'ดาวน์โหลด PDF', nameEn: 'Export PDF', groupKey: 'saleOrder' },

  // Customer
  { code: 'customer:view:all', resource: 'customer', action: 'view', scope: 'ALL', nameTh: 'ดูลูกค้าทั้งหมด', nameEn: 'View all customers', groupKey: 'customer' },
  { code: 'customer:create:all', resource: 'customer', action: 'create', scope: 'ALL', nameTh: 'เพิ่มลูกค้า', nameEn: 'Create customer', groupKey: 'customer' },
  { code: 'customer:update:all', resource: 'customer', action: 'update', scope: 'ALL', nameTh: 'แก้ไขลูกค้า', nameEn: 'Edit customer', groupKey: 'customer' },
  { code: 'customer:delete:all', resource: 'customer', action: 'delete', scope: 'ALL', nameTh: 'ลบลูกค้า', nameEn: 'Delete customer', groupKey: 'customer' },

  // Product
  { code: 'product:view:all', resource: 'product', action: 'view', scope: 'ALL', nameTh: 'ดูสินค้าทั้งหมด', nameEn: 'View products', groupKey: 'product' },
  { code: 'product:create:all', resource: 'product', action: 'create', scope: 'ALL', nameTh: 'เพิ่มสินค้า', nameEn: 'Create product', groupKey: 'product' },
  { code: 'product:update:all', resource: 'product', action: 'update', scope: 'ALL', nameTh: 'แก้ไขสินค้า', nameEn: 'Edit product', groupKey: 'product' },
  { code: 'product:delete:all', resource: 'product', action: 'delete', scope: 'ALL', nameTh: 'ลบสินค้า', nameEn: 'Delete product', groupKey: 'product' },

  // Company
  { code: 'company:view:all', resource: 'company', action: 'view', scope: 'ALL', nameTh: 'ดูข้อมูลบริษัท', nameEn: 'View company', groupKey: 'company' },
  { code: 'company:update:all', resource: 'company', action: 'update', scope: 'ALL', nameTh: 'แก้ไขข้อมูลบริษัท', nameEn: 'Edit company', groupKey: 'company' },

  // User
  { code: 'user:view:team', resource: 'user', action: 'view', scope: 'TEAM', nameTh: 'ดูสมาชิกในทีม', nameEn: 'View team members', groupKey: 'user' },
  { code: 'user:view:all', resource: 'user', action: 'view', scope: 'ALL', nameTh: 'ดูผู้ใช้ทั้งหมด', nameEn: 'View all users', groupKey: 'user' },
  { code: 'user:invite:team', resource: 'user', action: 'invite', scope: 'TEAM', nameTh: 'เชิญสมาชิกในทีม', nameEn: 'Invite team members', groupKey: 'user' },
  { code: 'user:invite:all', resource: 'user', action: 'invite', scope: 'ALL', nameTh: 'เชิญผู้ใช้ทุกระดับ', nameEn: 'Invite any user', groupKey: 'user' },
  { code: 'user:update:team', resource: 'user', action: 'update', scope: 'TEAM', nameTh: 'แก้ไขสมาชิกในทีม', nameEn: 'Edit team members', groupKey: 'user' },
  { code: 'user:update:all', resource: 'user', action: 'update', scope: 'ALL', nameTh: 'แก้ไขผู้ใช้ทุกคน', nameEn: 'Edit any user', groupKey: 'user' },
  { code: 'user:changeRole:all', resource: 'user', action: 'changeRole', scope: 'ALL', nameTh: 'เปลี่ยนบทบาท', nameEn: 'Change user role', groupKey: 'user' },
  { code: 'user:delete:all', resource: 'user', action: 'delete', scope: 'ALL', nameTh: 'ลบผู้ใช้', nameEn: 'Delete user', groupKey: 'user' },

  // Team
  { code: 'team:view:all', resource: 'team', action: 'view', scope: 'ALL', nameTh: 'ดูทีม', nameEn: 'View teams', groupKey: 'team' },
  { code: 'team:create:all', resource: 'team', action: 'create', scope: 'ALL', nameTh: 'สร้างทีม', nameEn: 'Create team', groupKey: 'team' },
  { code: 'team:update:all', resource: 'team', action: 'update', scope: 'ALL', nameTh: 'แก้ไขทีม', nameEn: 'Edit team', groupKey: 'team' },
  { code: 'team:delete:all', resource: 'team', action: 'delete', scope: 'ALL', nameTh: 'ลบทีม', nameEn: 'Delete team', groupKey: 'team' },
  { code: 'team:assignMember:team', resource: 'team', action: 'assignMember', scope: 'TEAM', nameTh: 'จัดการสมาชิกในทีมตัวเอง', nameEn: 'Manage own team members', groupKey: 'team' },
  { code: 'team:assignMember:all', resource: 'team', action: 'assignMember', scope: 'ALL', nameTh: 'จัดการสมาชิกทุกทีม', nameEn: 'Manage any team members', groupKey: 'team' },

  // Department
  { code: 'department:view:all', resource: 'department', action: 'view', scope: 'ALL', nameTh: 'ดูแผนก', nameEn: 'View departments', groupKey: 'department' },
  { code: 'department:create:all', resource: 'department', action: 'create', scope: 'ALL', nameTh: 'สร้างแผนก', nameEn: 'Create department', groupKey: 'department' },
  { code: 'department:update:all', resource: 'department', action: 'update', scope: 'ALL', nameTh: 'แก้ไขแผนก', nameEn: 'Edit department', groupKey: 'department' },
  { code: 'department:delete:all', resource: 'department', action: 'delete', scope: 'ALL', nameTh: 'ลบแผนก', nameEn: 'Delete department', groupKey: 'department' },

  // Role & Permission
  { code: 'role:view:all', resource: 'role', action: 'view', scope: 'ALL', nameTh: 'ดูบทบาท', nameEn: 'View roles', groupKey: 'role' },
  { code: 'role:create:all', resource: 'role', action: 'create', scope: 'ALL', nameTh: 'สร้างบทบาท', nameEn: 'Create role', groupKey: 'role' },
  { code: 'role:update:all', resource: 'role', action: 'update', scope: 'ALL', nameTh: 'แก้ไขบทบาท', nameEn: 'Edit role', groupKey: 'role' },
  { code: 'role:delete:all', resource: 'role', action: 'delete', scope: 'ALL', nameTh: 'ลบบทบาท', nameEn: 'Delete role', groupKey: 'role' },
  { code: 'role:assignPermission:all', resource: 'role', action: 'assignPermission', scope: 'ALL', nameTh: 'กำหนดสิทธิ์ของบทบาท', nameEn: 'Assign role permissions', groupKey: 'role' },

  // Dashboard
  { code: 'dashboard:view:own', resource: 'dashboard', action: 'view', scope: 'OWN', nameTh: 'ดู Dashboard ของตัวเอง', nameEn: 'View own dashboard', groupKey: 'dashboard' },
  { code: 'dashboard:view:team', resource: 'dashboard', action: 'view', scope: 'TEAM', nameTh: 'ดู Dashboard ของทีม', nameEn: 'View team dashboard', groupKey: 'dashboard' },
  { code: 'dashboard:view:all', resource: 'dashboard', action: 'view', scope: 'ALL', nameTh: 'ดู Dashboard ทั้งหมด', nameEn: 'View all dashboards', groupKey: 'dashboard' },
];

const ROLES_DATA = [
  { code: 'OFFICER', nameTh: 'พนักงานขาย', nameEn: 'Officer', level: 1, defaultApprovalLimit: 0, themeColor: 'blue', isSystem: true },
  { code: 'MANAGER', nameTh: 'ผู้จัดการ', nameEn: 'Manager', level: 2, defaultApprovalLimit: 100000, themeColor: 'amber', isSystem: true },
  { code: 'ADMIN', nameTh: 'ผู้ดูแลระบบ', nameEn: 'Admin', level: 3, defaultApprovalLimit: 1000000, themeColor: 'rose', isSystem: true },
  { code: 'CEO', nameTh: 'ผู้บริหาร', nameEn: 'CEO', level: 4, defaultApprovalLimit: null, themeColor: 'purple', isSystem: true },
];

// Default permissions per role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  OFFICER: [
    'quotation:view:own', 'quotation:create:own', 'quotation:update:own',
    'quotation:cancel:own', 'quotation:submit:own',
    'saleOrder:view:own', 'saleOrder:exportPdf:all',
    'customer:view:all', 'customer:update:all',
    'product:view:all',
    'company:view:all',
    'dashboard:view:own',
  ],
  MANAGER: [
    'quotation:view:team', 'quotation:approve:team', 'quotation:reject:team',
    'saleOrder:view:team', 'saleOrder:exportPdf:all',
    'customer:view:all', 'customer:update:all',
    'product:view:all',
    'company:view:all',
    'user:view:team', 'user:invite:team', 'user:update:team',
    'team:assignMember:team',
    'dashboard:view:team',
  ],
  ADMIN: [
    'quotation:view:all', 'quotation:approve:all', 'quotation:reject:all',
    'saleOrder:view:all', 'saleOrder:exportPdf:all',
    'customer:view:all', 'customer:create:all', 'customer:update:all', 'customer:delete:all',
    'product:view:all', 'product:create:all', 'product:update:all', 'product:delete:all',
    'company:view:all', 'company:update:all',
    'user:view:all', 'user:invite:all', 'user:update:all', 'user:changeRole:all', 'user:delete:all',
    'team:view:all', 'team:create:all', 'team:update:all', 'team:delete:all', 'team:assignMember:all',
    'department:view:all', 'department:create:all', 'department:update:all', 'department:delete:all',
    'role:view:all', 'role:create:all', 'role:update:all', 'role:delete:all', 'role:assignPermission:all',
    'dashboard:view:all',
  ],
  CEO: [
    'quotation:view:all', 'quotation:approve:all', 'quotation:reject:all',
    'saleOrder:view:all', 'saleOrder:exportPdf:all',
    'customer:view:all', 'customer:create:all', 'customer:update:all', 'customer:delete:all',
    'product:view:all', 'product:create:all', 'product:update:all', 'product:delete:all',
    'company:view:all', 'company:update:all',
    'user:view:all', 'user:invite:all', 'user:update:all', 'user:changeRole:all',
    'team:view:all', 'team:create:all', 'team:update:all', 'team:assignMember:all',
    'department:view:all', 'department:create:all', 'department:update:all',
    'role:view:all', 'role:assignPermission:all',
    'dashboard:view:all',
  ],
};

async function main() {
  console.log('🌱 Seeding database...');

  // ===== 1. Permissions =====
  console.log('  📝 Seeding permissions...');
  for (const p of PERMISSIONS_DATA) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {
        nameTh: p.nameTh,
        nameEn: p.nameEn,
        groupKey: p.groupKey,
      },
      create: p,
    });
  }
  console.log(`     ✅ ${PERMISSIONS_DATA.length} permissions`);

  // ===== 2. Roles =====
  console.log('  👥 Seeding roles...');
  const roleMap = new Map<string, string>();
  for (const r of ROLES_DATA) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: {
        nameTh: r.nameTh,
        nameEn: r.nameEn,
        level: r.level,
        defaultApprovalLimit: r.defaultApprovalLimit !== null ? new Prisma.Decimal(r.defaultApprovalLimit) : null,
        themeColor: r.themeColor,
      },
      create: {
        ...r,
        defaultApprovalLimit: r.defaultApprovalLimit !== null ? new Prisma.Decimal(r.defaultApprovalLimit) : null,
      },
    });
    roleMap.set(r.code, role.id);
  }
  console.log(`     ✅ ${ROLES_DATA.length} roles`);

  // ===== 3. Role × Permission =====
  console.log('  🔐 Seeding role permissions...');
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleCode)!;
    // Clear existing
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    // Insert new
    for (const code of permCodes) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      if (perm) {
        await prisma.rolePermission.create({
          data: { roleId, permissionId: perm.id },
        });
      }
    }
  }
  console.log(`     ✅ Role permissions assigned`);

  // ===== 4. Department =====
  console.log('  🏢 Seeding department...');
  const dept = await prisma.department.upsert({
    where: { code: 'DEFAULT' },
    update: {},
    create: { code: 'DEFAULT', name: 'Default Department', description: 'แผนกหลัก' },
  });
  console.log(`     ✅ Department: ${dept.name}`);

  // ===== 5. Teams =====
  console.log('  👥 Seeding teams...');
  const teamSales = await prisma.team.upsert({
    where: { code: 'SALES_A' },
    update: {},
    create: {
      code: 'SALES_A',
      name: 'Sales Team A',
      description: 'ทีมขาย A',
      departmentId: dept.id,
    },
  });
  const teamTech = await prisma.team.upsert({
    where: { code: 'TECH' },
    update: {},
    create: {
      code: 'TECH',
      name: 'Tech Team',
      description: 'ทีมเทคนิค',
      departmentId: dept.id,
    },
  });
  console.log(`     ✅ 2 teams created`);

  // ===== 6. Users =====
  console.log('  👤 Seeding users...');
  const password = await bcrypt.hash('Password@123', 10);

  // CEO
  const ceo = await prisma.user.upsert({
    where: { email_deletedAt: { email: 'ceo@example.com', deletedAt: null as any } } as any,
    update: { roleId: roleMap.get('CEO')! },
    create: {
      email: 'ceo@example.com',
      password,
      name: 'CEO ทดสอบ',
      roleId: roleMap.get('CEO')!,
      preferredLang: 'th',
    },
  }).catch(async () => {
    // Fallback for unique email constraint quirks
    return prisma.user.create({
      data: {
        email: 'ceo@example.com',
        password,
        name: 'CEO ทดสอบ',
        roleId: roleMap.get('CEO')!,
      },
    });
  });

  const admin = await ensureUser({
    email: 'admin@example.com',
    name: 'Admin ทดสอบ',
    roleCode: 'ADMIN',
    roleMap,
    password,
  });

  // Manager Sales — heads SALES_A
  const managerSales = await ensureUser({
    email: 'manager-sales@example.com',
    name: 'ผู้จัดการขาย',
    roleCode: 'MANAGER',
    teamId: teamSales.id,
    roleMap,
    password,
  });

  // Manager Tech — heads TECH
  const managerTech = await ensureUser({
    email: 'manager-tech@example.com',
    name: 'ผู้จัดการเทคนิค',
    roleCode: 'MANAGER',
    teamId: teamTech.id,
    roleMap,
    password,
  });

  // Set team managers
  await prisma.team.update({ where: { id: teamSales.id }, data: { managerId: managerSales.id } });
  await prisma.team.update({ where: { id: teamTech.id }, data: { managerId: managerTech.id } });

  // Officer 1 — Sales Team A, reports to Manager Sales
  const officer1 = await ensureUser({
    email: 'officer1@example.com',
    name: 'พนักงานขาย 1',
    roleCode: 'OFFICER',
    teamId: teamSales.id,
    reportsToId: managerSales.id,
    roleMap,
    password,
  });

  // Officer 2 — Sales Team A, reports to Officer 1 (sub-hierarchy)
  await ensureUser({
    email: 'officer2@example.com',
    name: 'พนักงานขาย 2 (ลูกน้อง O1)',
    roleCode: 'OFFICER',
    teamId: teamSales.id,
    reportsToId: officer1.id,
    roleMap,
    password,
  });

  // Officer 3 — Tech Team
  await ensureUser({
    email: 'officer3@example.com',
    name: 'พนักงานเทคนิค',
    roleCode: 'OFFICER',
    teamId: teamTech.id,
    reportsToId: managerTech.id,
    roleMap,
    password,
  });

  console.log('     ✅ 7 users created');

  // ===== 7. Company Settings =====
  console.log('  ⚙️  Seeding company settings...');
  await prisma.companySettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      companyName: 'Your Company Co., Ltd.',
      companyNameTh: 'บริษัท ของคุณ จำกัด',
      defaultVatRate: new Prisma.Decimal(7),
      defaultCurrency: 'THB',
      defaultPaymentTerms: 'Net 30',
    },
  });

  console.log('\n✨ Seeding completed!\n');
  console.log('🔑 Test accounts (password: Password@123):');
  console.log('   👔 ceo@example.com              (CEO)');
  console.log('   🔧 admin@example.com            (Admin)');
  console.log('   👨‍💼 manager-sales@example.com   (Manager — Sales Team A)');
  console.log('   👨‍💼 manager-tech@example.com    (Manager — Tech Team)');
  console.log('   👨‍💼 officer1@example.com        (Officer — Sales Team A)');
  console.log('   👨‍💼 officer2@example.com        (Officer — reports to Officer 1)');
  console.log('   👨‍💼 officer3@example.com        (Officer — Tech Team)');
}

async function ensureUser(opts: {
  email: string;
  name: string;
  roleCode: string;
  teamId?: string;
  reportsToId?: string;
  roleMap: Map<string, string>;
  password: string;
}) {
  const existing = await prisma.user.findFirst({
    where: { email: opts.email, deletedAt: null },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: opts.name,
        roleId: opts.roleMap.get(opts.roleCode)!,
        teamId: opts.teamId,
        reportsToId: opts.reportsToId,
      },
    });
  }
  return prisma.user.create({
    data: {
      email: opts.email,
      password: opts.password,
      name: opts.name,
      roleId: opts.roleMap.get(opts.roleCode)!,
      teamId: opts.teamId,
      reportsToId: opts.reportsToId,
    },
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
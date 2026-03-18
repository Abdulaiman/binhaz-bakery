const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@binhaz.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`SUPER_ADMIN already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      mustChangePassword: true,
      isActive: true,
    },
  });

  console.log(`SUPER_ADMIN created: ${email}`);
  console.log(`Temporary password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

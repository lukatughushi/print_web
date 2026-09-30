const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('ADMINadmin1234', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: { role: 'ADMIN', passwordHash: hash },
    create: {
      email: 'admin@gmail.com',
      name: 'Admin',
      passwordHash: hash,
      role: 'ADMIN'
    }
  });
  console.log('Admin user ready:', user.email, user.role);
}

main().finally(() => prisma.$disconnect());

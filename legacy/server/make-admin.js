const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.update({
    where: { email: 'test2@test.com' },
    data: { role: 'ADMIN' },
  });
  console.log(`Done! ${user.email} is now ADMIN`);
}

main().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  for (const slotNumber of [1, 2, 3]) {
    await prisma.banner.upsert({
      where: { slotNumber },
      update: {},
      create: { slotNumber },
    });
  }
  console.log('Seeded 3 banner slots');
}

main().catch(console.error).finally(() => prisma.$disconnect());

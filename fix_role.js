import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.user.update({
    where: { email: 'alizohaib.web@gmail.com' },
    data: { role: 'MASTER_ADMIN' }
  });
  console.log("Updated alizohaib.web@gmail.com to MASTER_ADMIN");
}
main().finally(() => prisma.$disconnect());

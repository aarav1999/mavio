const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearGoogleAccount() {
  try {
    console.log('Finding accounts...');
    const accounts = await prisma.account.findMany();
    console.log('All accounts:', accounts);
    
    console.log('Deleting Google accounts...');
    const result = await prisma.account.deleteMany({
      where: { provider: 'google' }
    });
    console.log(`Deleted ${result.count} Google account(s)`);
    
    console.log('Remaining accounts:');
    const remaining = await prisma.account.findMany();
    console.log(remaining);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearGoogleAccount();

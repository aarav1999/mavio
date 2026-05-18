const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('Checking users and accounts...\n');
    
    const users = await prisma.user.findMany({
      include: {
        accounts: true,
      },
    });
    
    console.log(`Found ${users.length} user(s):\n`);
    
    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Accounts: ${user.accounts.length}`);
      user.accounts.forEach((account, i) => {
        console.log(`    Account ${i + 1}:`);
        console.log(`      Provider: ${account.provider}`);
        console.log(`      Provider Account ID: ${account.providerAccountId}`);
      });
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();

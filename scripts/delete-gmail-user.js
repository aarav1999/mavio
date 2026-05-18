const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteGmailUser() {
  try {
    console.log('Deleting Gmail user...');
    
    // Delete user with Gmail email
    const result = await prisma.user.delete({
      where: { email: 'kumar.suraj1222@gmail.com' },
    });
    
    console.log('Deleted user:', result.email);
    console.log('Success!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteGmailUser();

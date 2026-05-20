const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteGmailUser(email) {
  try {
    console.log('Deleting Gmail user:', email);
    
    // Delete user with specified email
    const result = await prisma.user.delete({
      where: { email },
    });
    
    console.log('Deleted user:', result.email);
    console.log('Success!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: node delete-gmail-user.js <email>');
  process.exit(1);
}

deleteGmailUser(email);

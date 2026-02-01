import { prisma } from './src/lib/prisma';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const count = await prisma.descriptor.count();
    console.log('✓ Connection successful!');
    console.log(`Descriptor count: ${count}`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('✗ Connection failed!');
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

testConnection();

/**
 * Database utility for direct Prisma access
 */
import { PrismaClient } from '../generated/prisma/index.js';

// Create a singleton Prisma client instance
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
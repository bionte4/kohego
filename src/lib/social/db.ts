import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { kohegoPrisma?: PrismaClient };

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDb() {
  if (!databaseConfigured()) return null;
  if (!globalForPrisma.kohegoPrisma) {
    globalForPrisma.kohegoPrisma = new PrismaClient({
      log: ["error"],
    });
  }
  return globalForPrisma.kohegoPrisma;
}

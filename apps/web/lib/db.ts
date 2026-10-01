import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const cache = globalThis as { siftPrisma?: PrismaClient };

/** One client per server instance (and across dev hot reloads). Created on first use, never at import. */
export function db(): PrismaClient {
  if (!cache.siftPrisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    cache.siftPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return cache.siftPrisma;
}

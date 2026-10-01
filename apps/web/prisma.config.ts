import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations use the direct (unpooled) connection; the app uses DATABASE_URL at runtime (lib/db.ts).
// The placeholder lets `prisma generate` run in CI, which has no database.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://placeholder/sift" },
});

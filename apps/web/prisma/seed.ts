// `pnpm --filter web db:seed`: demo data for the dashboard, plus the users and device TRD §3 asks for.
// Prints the generated tokens once; store them privately. Safe to re-run (upserts).
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { ReviewResult } from "@sift/shared";
import { db } from "../lib/db";
import { saveReview, splitRepo } from "../lib/ingest";

const fixture = (name: string) =>
  ReviewResult.parse(
    JSON.parse(
      readFileSync(new URL(`../../../packages/shared/src/fixtures/${name}`, import.meta.url), "utf8"),
    ),
  );

const prisma = db();
for (const name of ["review-result-pr.json", "review-result-stack.json"]) {
  const r = fixture(name);
  const repo = splitRepo(r.repo ?? "");
  if (repo) await saveReview(prisma, r, repo);
}

const repo = await prisma.repo.findFirstOrThrow({ where: { owner: "ydvSajal", name: "sift-demo-shop" } });
const stats: [string, number, number][] = [
  ["bug", 9, 1],
  ["security", 4, 1],
  ["error-handling", 5, 3],
  ["naming", 3, 6],
  ["style", 1, 9],
];
for (const [category, accepted, dismissed] of stats) {
  await prisma.categoryStat.upsert({
    where: { repoId_category: { repoId: repo.id, category } },
    update: { accepted, dismissed },
    create: { repoId: repo.id, category, accepted, dismissed },
  });
}

const token = () => randomBytes(16).toString("hex");
for (const githubLogin of ["demo-author", "senior-a", "senior-b"]) {
  const linkToken = token();
  await prisma.user.upsert({
    where: { githubLogin },
    update: { linkToken },
    create: { githubLogin, linkToken },
  });
  console.log(`telegram link token for ${githubLogin}: ${linkToken}`);
}
const deviceToken = token();
const owner = await prisma.user.findUniqueOrThrow({ where: { githubLogin: "senior-a" } });
await prisma.device.create({
  data: { userId: owner.id, tokenHash: createHash("sha256").update(deviceToken).digest("hex") },
});
console.log(`buddy device token: ${deviceToken}`);
await prisma.$disconnect();

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Repo" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ReviewJob" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewJob_status_createdAt_idx" ON "ReviewJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewJob_repoId_prNumber_headSha_key" ON "ReviewJob"("repoId", "prNumber", "headSha");

-- AddForeignKey
ALTER TABLE "ReviewJob" ADD CONSTRAINT "ReviewJob_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "JobRequest" ADD COLUMN "customerFirstName" TEXT;
ALTER TABLE "JobRequest" ADD COLUMN "customerLastName" TEXT;
ALTER TABLE "JobRequest" ADD COLUMN "emergencyLevel" INTEGER;
ALTER TABLE "JobRequest" ADD COLUMN "exactLocation" TEXT;
ALTER TABLE "JobRequest" ADD COLUMN "issueNotes" TEXT;
ALTER TABLE "JobRequest" ADD COLUMN "issueType" TEXT;

-- CreateEnum
CREATE TYPE "DescriptorBatchStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'RETURNED');

-- AlterTable: Add WSOS section linking and batch workflow fields to Descriptor
ALTER TABLE "Descriptor" ADD COLUMN "wsosSectionId" TEXT;
ALTER TABLE "Descriptor" ADD COLUMN "batchStatus" "DescriptorBatchStatus";
ALTER TABLE "Descriptor" ADD COLUMN "batchId" TEXT;
ALTER TABLE "Descriptor" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Descriptor" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Descriptor" ADD COLUMN "reviewerId" TEXT;
ALTER TABLE "Descriptor" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Descriptor" ADD COLUMN "reviewComment" TEXT;

-- CreateIndex
CREATE INDEX "Descriptor_wsosSectionId_idx" ON "Descriptor"("wsosSectionId");
CREATE INDEX "Descriptor_batchStatus_idx" ON "Descriptor"("batchStatus");
CREATE INDEX "Descriptor_batchId_idx" ON "Descriptor"("batchId");
CREATE INDEX "Descriptor_createdById_idx" ON "Descriptor"("createdById");

-- AddForeignKey
ALTER TABLE "Descriptor" ADD CONSTRAINT "Descriptor_wsosSectionId_fkey" FOREIGN KEY ("wsosSectionId") REFERENCES "WSOSSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Descriptor" ADD CONSTRAINT "Descriptor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Descriptor" ADD CONSTRAINT "Descriptor_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Descriptor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "criterionName" TEXT NOT NULL,
    "excellent" TEXT,
    "good" TEXT,
    "pass" TEXT,
    "belowPass" TEXT,
    "source" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "sector" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Descriptor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Descriptor_source_idx" ON "Descriptor"("source");

-- CreateIndex
CREATE INDEX "Descriptor_skillName_idx" ON "Descriptor"("skillName");

-- CreateIndex
CREATE INDEX "Descriptor_sector_idx" ON "Descriptor"("sector");

-- CreateIndex
CREATE INDEX "Descriptor_category_idx" ON "Descriptor"("category");

-- CreateIndex
CREATE INDEX "Descriptor_version_idx" ON "Descriptor"("version");

-- CreateIndex
CREATE UNIQUE INDEX "Descriptor_skillName_code_key" ON "Descriptor"("skillName", "code");

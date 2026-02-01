-- CreateEnum
CREATE TYPE "ResourceCategory" AS ENUM ('GUIDANCE', 'TEMPLATE', 'BEST_PRACTICE', 'ONBOARDING', 'POLICY');

-- CreateTable
CREATE TABLE "ResourceLink" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "category" "ResourceCategory" NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceLink_category_idx" ON "ResourceLink"("category");

-- CreateIndex
CREATE INDEX "ResourceLink_isFeatured_idx" ON "ResourceLink"("isFeatured");

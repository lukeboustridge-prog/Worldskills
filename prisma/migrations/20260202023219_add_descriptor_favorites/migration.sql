-- CreateTable
CREATE TABLE "DescriptorFavorite" (
    "userId" TEXT NOT NULL,
    "descriptorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DescriptorFavorite_pkey" PRIMARY KEY ("userId","descriptorId")
);

-- CreateIndex
CREATE INDEX "DescriptorFavorite_userId_idx" ON "DescriptorFavorite"("userId");

-- CreateIndex
CREATE INDEX "DescriptorFavorite_descriptorId_idx" ON "DescriptorFavorite"("descriptorId");

-- AddForeignKey
ALTER TABLE "DescriptorFavorite" ADD CONSTRAINT "DescriptorFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DescriptorFavorite" ADD CONSTRAINT "DescriptorFavorite_descriptorId_fkey" FOREIGN KEY ("descriptorId") REFERENCES "Descriptor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

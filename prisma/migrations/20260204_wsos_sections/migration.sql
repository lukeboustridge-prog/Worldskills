-- CreateTable
CREATE TABLE "WSOSSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WSOSSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WSOSSection_name_key" ON "WSOSSection"("name");

-- CreateIndex
CREATE INDEX "WSOSSection_name_idx" ON "WSOSSection"("name");

-- AddForeignKey
ALTER TABLE "WSOSSection" ADD CONSTRAINT "WSOSSection_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- GIN trigram index for similarity queries (manual addition - Prisma cannot generate this)
CREATE INDEX wsos_section_name_trgm ON "WSOSSection" USING GIN (name gin_trgm_ops);

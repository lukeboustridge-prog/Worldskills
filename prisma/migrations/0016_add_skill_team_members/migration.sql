-- Add Skill Team role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SkillTeam';

-- Create skill team membership table
CREATE TABLE "SkillMember" (
  "id" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SkillMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SkillMember_skillId_userId_key" ON "SkillMember"("skillId", "userId");
CREATE INDEX "SkillMember_skillId_idx" ON "SkillMember"("skillId");
CREATE INDEX "SkillMember_userId_idx" ON "SkillMember"("userId");

ALTER TABLE "SkillMember"
ADD CONSTRAINT "SkillMember_skillId_fkey"
FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SkillMember"
ADD CONSTRAINT "SkillMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

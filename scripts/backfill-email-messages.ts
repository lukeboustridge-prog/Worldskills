/**
 * Backfill script: Create Message records for existing Email records
 * that were sent via the skill email system but never persisted to the
 * Message table (which is what the skill Email History tab displays).
 *
 * Usage: npx tsx scripts/backfill-email-messages.ts
 */

import { PrismaClient, EmailType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all SKILL_BROADCAST emails that have skill links
  const emails = await prisma.email.findMany({
    where: {
      type: EmailType.SKILL_BROADCAST,
    },
    include: {
      skills: true,
      attachments: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${emails.length} skill broadcast emails to backfill`);

  let created = 0;
  let skipped = 0;

  for (const email of emails) {
    for (const emailSkill of email.skills) {
      // Check if a Message already exists for this email (avoid duplicates)
      // Match on skillId + authorId + createdAt within 1 second
      const existing = await prisma.message.findFirst({
        where: {
          skillId: emailSkill.skillId,
          authorId: email.senderId,
          body: { contains: email.subject },
          createdAt: {
            gte: new Date(email.createdAt.getTime() - 1000),
            lte: new Date(email.createdAt.getTime() + 1000),
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.message.create({
        data: {
          skillId: emailSkill.skillId,
          authorId: email.senderId,
          body: `**${email.subject}**\n\n${email.body}`,
          createdAt: email.createdAt,
          attachments: {
            create: email.attachments.map((a) => ({
              storageKey: a.storageKey,
              fileName: a.fileName,
              fileSize: a.fileSize,
              mimeType: a.mimeType,
              createdAt: a.createdAt,
            })),
          },
        },
      });

      created++;
      console.log(
        `  Created message for skill ${emailSkill.skillId} — "${email.subject}" (${email.createdAt.toISOString()})`
      );
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped (already exist): ${skipped}`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { NextResponse } from "next/server";
import { EmailType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST() {
  const user = await requireUser();
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const emails = await prisma.email.findMany({
    where: { type: EmailType.SKILL_BROADCAST },
    include: {
      skills: true,
      attachments: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let skipped = 0;

  for (const email of emails) {
    for (const emailSkill of email.skills) {
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
    }
  }

  return NextResponse.json({
    success: true,
    totalEmails: emails.length,
    created,
    skipped,
  });
}

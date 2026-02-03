"use server";

import { Role, EmailType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, type EmailAttachment as ResendAttachment } from "@/lib/email/resend";
import { getStorageEnv } from "@/lib/env";

const attachmentSchema = z.object({
  storageKey: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
});

const skillEmailSchema = z.object({
  skillIds: z.array(z.string()).min(1, "Select at least one skill"),
  subject: z.string().min(1, "Subject is required").max(200),
  body: z.string().min(1, "Message body is required"),
  attachments: z.array(attachmentSchema).default([]),
});

const internalEmailSchema = z.object({
  recipientUserIds: z.array(z.string()).min(1, "Select at least one recipient"),
  subject: z.string().min(1, "Subject is required").max(200),
  body: z.string().min(1, "Message body is required"),
  attachments: z.array(attachmentSchema).default([]),
});

async function getAttachmentContent(storageKey: string): Promise<Buffer> {
  const storage = getStorageEnv();

  const client = new S3Client({
    region: storage.region,
    endpoint: storage.endpoint,
    forcePathStyle: storage.forcePathStyle,
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    },
  });

  const command = new GetObjectCommand({
    Bucket: storage.bucket,
    Key: storageKey,
  });

  const response = await client.send(command);
  const body = response.Body;

  if (!body) {
    throw new Error("Failed to retrieve attachment content");
  }

  const chunks: Uint8Array[] = [];
  // @ts-expect-error - Body is a readable stream
  for await (const chunk of body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function prepareResendAttachments(
  attachments: z.infer<typeof attachmentSchema>[]
): Promise<ResendAttachment[]> {
  if (attachments.length === 0) {
    return [];
  }

  const prepared: ResendAttachment[] = [];

  for (const attachment of attachments) {
    const content = await getAttachmentContent(attachment.storageKey);
    prepared.push({
      content: content.toString("base64"),
      filename: attachment.fileName,
    });
  }

  return prepared;
}

function buildEmailHtml(params: {
  senderName: string;
  subject: string;
  body: string;
  attachmentCount: number;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skill-tracker.worldskills2026.com";
  const dashboardUrl = `${baseUrl}/dashboard`;
  const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";

  const attachmentNote =
    params.attachmentCount > 0
      ? `<p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">This email includes ${params.attachmentCount} attachment${params.attachmentCount > 1 ? "s" : ""}.</p>`
      : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
        <div style="background-color: #f4f4f5; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <div style="background-color: #2563eb; padding: 24px 24px 18px; text-align: center; border-bottom: 1px solid #1d4ed8;">
              <img src="${logoUrl}" alt="WorldSkills logo" style="height: 48px; width: auto; display: block; margin: 0 auto 16px; border-radius: 8px; background: #f8fafc; padding: 6px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">
                Worldskills Skill Tracker
              </h1>
            </div>
            <div style="padding: 28px 24px 32px;">
              <p style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #334155; line-height: 1.5;">
                <strong>${params.senderName}</strong> sent you a message.
              </p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Subject</p>
                <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1e293b;">${params.subject}</p>
                <p style="margin: 0; font-family: Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #475569; white-space: pre-wrap; line-height: 1.6;">${params.body}</p>
                ${attachmentNote}
              </div>
              <div style="text-align: center;">
                <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
                  View in Skill Tracker
                </a>
              </div>
            </div>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <p style="font-size: 12px; color: #94a3b8;">
              Sent via Worldskills Skill Tracker
            </p>
          </div>
          <div style="text-align: center; margin-top: 12px;">
            <p style="font-size: 11px; color: #cbd5e1;">
              This is an automated notification. Please do not reply directly to this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendSkillEmailAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== Role.SA && user.role !== Role.Secretariat && !user.isAdmin) {
    throw new Error("Only Skill Advisors or Secretariat can send skill emails");
  }

  const skillIdsRaw = formData.get("skillIds");
  const attachmentsRaw = formData.get("attachments");

  const parsed = skillEmailSchema.safeParse({
    skillIds: skillIdsRaw ? JSON.parse(skillIdsRaw as string) : [],
    subject: formData.get("subject"),
    body: formData.get("body"),
    attachments: attachmentsRaw ? JSON.parse(attachmentsRaw as string) : [],
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const { skillIds, subject, body, attachments } = parsed.data;

  // Verify user has access to selected skills
  const whereClause = user.role === Role.SA && !user.isAdmin
    ? { id: { in: skillIds }, saId: user.id }
    : { id: { in: skillIds } };

  const skills = await prisma.skill.findMany({
    where: whereClause,
    include: {
      sa: true,
      scm: true,
      teamMembers: { include: { user: true } },
    },
  });

  if (skills.length === 0) {
    throw new Error("No valid skills selected");
  }

  // Collect unique recipients across all skills
  const recipientMap = new Map<string, { email: string; name: string | null; role: string; userId: string | null }>();

  for (const skill of skills) {
    // Add SA
    if (skill.sa) {
      recipientMap.set(skill.sa.email, {
        email: skill.sa.email,
        name: skill.sa.name,
        role: "SA",
        userId: skill.sa.id,
      });
    }

    // Add SCM
    if (skill.scm) {
      recipientMap.set(skill.scm.email, {
        email: skill.scm.email,
        name: skill.scm.name,
        role: "SCM",
        userId: skill.scm.id,
      });
    }

    // Add team members
    for (const member of skill.teamMembers) {
      recipientMap.set(member.user.email, {
        email: member.user.email,
        name: member.user.name,
        role: "SkillTeam",
        userId: member.user.id,
      });
    }
  }

  const recipients = Array.from(recipientMap.values());

  if (recipients.length === 0) {
    throw new Error("No recipients found for selected skills");
  }

  // Create email record
  const email = await prisma.email.create({
    data: {
      type: EmailType.SKILL_BROADCAST,
      subject,
      body,
      senderId: user.id,
      skills: {
        create: skills.map((skill) => ({ skillId: skill.id })),
      },
      recipients: {
        create: recipients.map((r) => ({
          userId: r.userId,
          recipientEmail: r.email,
          recipientName: r.name,
          recipientRole: r.role,
        })),
      },
      attachments: {
        create: attachments.map((a) => ({
          storageKey: a.storageKey,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
        })),
      },
    },
  });

  // Prepare attachments for Resend (convert to base64)
  const resendAttachments = await prepareResendAttachments(attachments);

  const html = buildEmailHtml({
    senderName: user.name ?? "Skill Advisor",
    subject,
    body,
    attachmentCount: attachments.length,
  });

  const text = `${user.name ?? "Skill Advisor"} sent you a message.\n\nSubject: ${subject}\n\n${body}${attachments.length > 0 ? `\n\nThis email includes ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}.` : ""}`;

  // Send individual emails (batch API doesn't support attachments)
  const emailPromises = recipients.map((recipient) =>
    sendEmail({
      to: recipient.email,
      subject: `[Skill Tracker] ${subject}`,
      html,
      text,
      attachments: resendAttachments,
    }).catch((err) => {
      console.error(`Failed to send email to ${recipient.email}`, err);
      return null;
    })
  );

  await Promise.all(emailPromises);

  revalidatePath("/hub/emails");

  return { success: true, emailId: email.id, recipientCount: recipients.length };
}

export async function sendInternalEmailAction(formData: FormData) {
  const user = await requireUser();

  if (user.role !== Role.SA && user.role !== Role.Secretariat && !user.isAdmin) {
    throw new Error("Only Skill Advisors or Secretariat can send internal emails");
  }

  const recipientIdsRaw = formData.get("recipientUserIds");
  const attachmentsRaw = formData.get("attachments");

  const parsed = internalEmailSchema.safeParse({
    recipientUserIds: recipientIdsRaw ? JSON.parse(recipientIdsRaw as string) : [],
    subject: formData.get("subject"),
    body: formData.get("body"),
    attachments: attachmentsRaw ? JSON.parse(attachmentsRaw as string) : [],
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const { recipientUserIds, subject, body, attachments } = parsed.data;

  // Fetch recipient users (only SA and Secretariat)
  const recipientUsers = await prisma.user.findMany({
    where: {
      id: { in: recipientUserIds },
      role: { in: [Role.SA, Role.Secretariat] },
    },
  });

  if (recipientUsers.length === 0) {
    throw new Error("No valid recipients selected");
  }

  // Create email record
  const email = await prisma.email.create({
    data: {
      type: EmailType.INTERNAL,
      subject,
      body,
      senderId: user.id,
      recipients: {
        create: recipientUsers.map((r) => ({
          userId: r.id,
          recipientEmail: r.email,
          recipientName: r.name,
          recipientRole: r.role,
        })),
      },
      attachments: {
        create: attachments.map((a) => ({
          storageKey: a.storageKey,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
        })),
      },
    },
  });

  // Prepare attachments for Resend
  const resendAttachments = await prepareResendAttachments(attachments);

  const html = buildEmailHtml({
    senderName: user.name ?? "Team Member",
    subject,
    body,
    attachmentCount: attachments.length,
  });

  const text = `${user.name ?? "Team Member"} sent you a message.\n\nSubject: ${subject}\n\n${body}${attachments.length > 0 ? `\n\nThis email includes ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}.` : ""}`;

  // Send individual emails
  const emailPromises = recipientUsers.map((recipient) =>
    sendEmail({
      to: recipient.email,
      subject: `[Skill Tracker] ${subject}`,
      html,
      text,
      attachments: resendAttachments,
    }).catch((err) => {
      console.error(`Failed to send email to ${recipient.email}`, err);
      return null;
    })
  );

  await Promise.all(emailPromises);

  revalidatePath("/hub/emails");

  return { success: true, emailId: email.id, recipientCount: recipientUsers.length };
}

export async function getEmailsAction(params: { type?: EmailType; page?: number; limit?: number }) {
  const user = await requireUser();

  if (user.role !== Role.SA && user.role !== Role.Secretariat && !user.isAdmin) {
    throw new Error("You do not have permission to view emails");
  }

  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  const whereClause = {
    AND: [
      params.type ? { type: params.type } : {},
      {
        OR: [
          { senderId: user.id },
          { recipients: { some: { userId: user.id } } },
          { recipients: { some: { recipientEmail: user.email } } },
        ],
      },
    ],
  };

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true },
        },
        recipients: {
          select: { id: true, recipientEmail: true, recipientName: true, recipientRole: true },
        },
        attachments: {
          select: { id: true, fileName: true, fileSize: true, mimeType: true },
        },
        skills: {
          include: {
            skill: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.email.count({ where: whereClause }),
  ]);

  return {
    emails,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getRecipientsAction() {
  const user = await requireUser();

  if (user.role !== Role.SA && user.role !== Role.Secretariat && !user.isAdmin) {
    throw new Error("You do not have permission to view recipients");
  }

  const users = await prisma.user.findMany({
    where: {
      role: { in: [Role.SA, Role.Secretariat] },
      id: { not: user.id }, // Exclude current user
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return users;
}

export async function getSkillsForEmailAction() {
  const user = await requireUser();

  if (user.role !== Role.SA && user.role !== Role.Secretariat && !user.isAdmin) {
    throw new Error("You do not have permission to view skills");
  }

  // SA sees only their skills, Secretariat/Admin sees all
  const whereClause = user.role === Role.SA && !user.isAdmin
    ? { saId: user.id }
    : {};

  const skills = await prisma.skill.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      sector: true,
    },
    orderBy: { name: "asc" },
  });

  return skills;
}

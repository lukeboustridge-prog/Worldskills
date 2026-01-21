"use server";

import { randomUUID } from "node:crypto";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminUser } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { prisma } from "@/lib/prisma";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  skillName: z.string().optional()
});

const bulkImportSchema = z.object({
  users: z.array(userSchema),
  role: z.nativeEnum(Role)
});

export type ImportUser = z.infer<typeof userSchema>;

export type BulkImportResult = {
  success: boolean;
  created: number;
  updated: number;
  linked: number;
  emailsSent: number;
  errors: string[];
};

export async function bulkImportUsersAction(
  users: ImportUser[],
  role: Role
): Promise<BulkImportResult> {
  await requireAdminUser();

  const parsed = bulkImportSchema.safeParse({ users, role });
  if (!parsed.success) {
    return {
      success: false,
      created: 0,
      updated: 0,
      linked: 0,
      emailsSent: 0,
      errors: parsed.error.errors.map((e) => e.message)
    };
  }

  const result: BulkImportResult = {
    success: true,
    created: 0,
    updated: 0,
    linked: 0,
    emailsSent: 0,
    errors: []
  };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  for (const userData of parsed.data.users) {
    try {
      const email = userData.email.toLowerCase().trim();
      const name = userData.name.trim();

      // Upsert user
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      let user;
      if (existingUser) {
        user = await prisma.user.update({
          where: { email },
          data: {
            name,
            role: parsed.data.role
          }
        });
        result.updated++;
      } else {
        user = await prisma.user.create({
          data: {
            email,
            name,
            role: parsed.data.role,
            passwordHash: null
          }
        });
        result.created++;
      }

      // Link to skill if skillName provided
      if (userData.skillName) {
        const skillName = userData.skillName.trim();
        const skill = await prisma.skill.findFirst({
          where: {
            name: {
              equals: skillName,
              mode: "insensitive"
            }
          }
        });

        if (skill) {
          const updateData: { saId?: string; scmId?: string } = {};

          if (parsed.data.role === Role.SA) {
            updateData.saId = user.id;
          } else if (parsed.data.role === Role.SCM) {
            updateData.scmId = user.id;
          }

          if (parsed.data.role === Role.SkillTeam) {
            await prisma.skillMember.upsert({
              where: {
                skillId_userId: {
                  skillId: skill.id,
                  userId: user.id
                }
              },
              update: {},
              create: {
                skillId: skill.id,
                userId: user.id
              }
            });
            result.linked++;
          } else if (Object.keys(updateData).length > 0) {
            await prisma.skill.update({
              where: { id: skill.id },
              data: updateData
            });
            result.linked++;
          }
        } else {
          result.errors.push(`Skill not found: "${skillName}" for user ${email}`);
        }
      }

      // Generate verification token for new users or users without password
      if (!existingUser || !existingUser.passwordHash) {
        const token = randomUUID();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Delete any existing tokens for this email
        await prisma.verificationToken.deleteMany({
          where: { identifier: email }
        });

        // Create new token
        await prisma.verificationToken.create({
          data: {
            identifier: email,
            token,
            expires
          }
        });

        // Send welcome email
        try {
          const setupUrl = `${baseUrl}/setup-account?token=${token}`;
          await sendWelcomeEmail({
            to: email,
            name,
            token,
            role: parsed.data.role,
            skillName: userData.skillName,
            setupUrl
          });
          result.emailsSent++;
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
          result.errors.push(`Failed to send email to ${email}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`Error processing ${userData.email}: ${message}`);
    }
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return result;
}

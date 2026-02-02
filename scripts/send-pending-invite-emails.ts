import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

// Initialize inside function after env is loaded via --env-file
let resend: Resend;
let baseUrl: string;
let fromEmail: string;

function init() {
  resend = new Resend(process.env.RESEND_API_KEY);
  baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skill-tracker.worldskills2026.com";
  fromEmail = process.env.FROM_EMAIL || "noreply@worldskills2026.com";
}

const ROLE_LABELS: Record<Role, string> = {
  [Role.Pending]: "User",
  [Role.SA]: "Skill Advisor",
  [Role.SCM]: "Skill Competition Manager",
  [Role.SkillTeam]: "Skill Team",
  [Role.Secretariat]: "Secretariat"
};

async function sendWelcomeEmail(to: string, name: string, token: string, role: Role) {
  const setupUrl = `${baseUrl}/setup-account?token=${token}`;
  const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";
  const roleLabel = ROLE_LABELS[role];

  const html = `
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
                Welcome to WorldSkills Skill Tracker
              </h1>
            </div>
            <div style="padding: 28px 24px 32px;">
              <p style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #334155; line-height: 1.5;">
                Hello ${name},
              </p>
              <p style="margin-top: 0; margin-bottom: 24px; font-size: 16px; color: #334155; line-height: 1.5;">
                You have been added as <strong>${roleLabel}</strong>. Click the button below to set your password and access your account.
              </p>
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${setupUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
                  Set Up Your Account
                </a>
              </div>
              <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
                  This link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </div>
              <p style="margin-top: 0; margin-bottom: 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin-top: 8px; margin-bottom: 0; font-size: 12px; color: #94a3b8; word-break: break-all;">
                ${setupUrl}
              </p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <p style="font-size: 12px; color: #94a3b8;">
              Sent via Worldskills Skill Tracker
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `Hello ${name},

You have been added as ${roleLabel}.

Click the link below to set your password and access your account:
${setupUrl}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

Sent via Worldskills Skill Tracker`;

  return resend.emails.send({
    from: fromEmail,
    to,
    subject: "Welcome to WorldSkills Skill Tracker",
    html,
    text
  });
}

async function main() {
  init();
  console.log("=== Sending Emails to Pending Invitations ===\n");

  // Get pending invitations
  const invites = await prisma.invitation.findMany({
    where: { acceptedAt: null },
    select: { id: true, name: true, email: true, role: true, isAdmin: true }
  });

  console.log(`Found ${invites.length} pending invitations\n`);

  let sent = 0;
  let failed = 0;

  for (const invite of invites) {
    try {
      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email: invite.email }
      });

      // Create user if doesn't exist
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: invite.name,
            email: invite.email,
            role: invite.role,
            isAdmin: invite.isAdmin
          }
        });
        console.log(`  Created user: ${invite.email}`);
      }

      // Check if user already has a password (account set up)
      if (user.passwordHash) {
        console.log(`  Skip (already has account): ${invite.name}`);
        continue;
      }

      // Create verification token
      const token = randomUUID();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Delete existing tokens
      await prisma.verificationToken.deleteMany({
        where: { identifier: invite.email }
      });

      // Create new token
      await prisma.verificationToken.create({
        data: {
          identifier: invite.email,
          token,
          expires
        }
      });

      // Send email
      const result = await sendWelcomeEmail(invite.email, invite.name, token, invite.role);
      console.log(`  Sent to ${invite.name} (${invite.email})`);
      console.log(`    Resend response:`, JSON.stringify(result, null, 2));
      sent++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`  Failed: ${invite.email}`, error);
      failed++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Sent: ${sent}`);
  console.log(`Failed: ${failed}`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());

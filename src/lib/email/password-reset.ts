import { sendEmail } from "./resend";

interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
  userName?: string;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  userName,
}: SendPasswordResetEmailParams) {
  const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";
  const greeting = userName ? `Hi ${userName},` : "Hi,";

  const subject = "Reset Your Password - WorldSkills Skill Tracker";

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
                Worldskills Skill Tracker
              </h1>
            </div>

            <div style="padding: 28px 24px 32px;">

              <p style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #334155; line-height: 1.5;">
                ${greeting}
              </p>

              <p style="margin-top: 0; margin-bottom: 24px; font-size: 16px; color: #334155; line-height: 1.5;">
                We received a request to reset your password. Click the button below to choose a new password.
              </p>

              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
                  Reset Password
                </a>
              </div>

              <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
                  This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                </p>
              </div>

              <p style="margin-top: 0; margin-bottom: 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin-top: 8px; margin-bottom: 0; font-size: 12px; color: #94a3b8; word-break: break-all;">
                ${resetUrl}
              </p>

            </div>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <p style="font-size: 12px; color: #94a3b8;">
              Sent via Worldskills Skill Tracker
            </p>
          </div>

          <div style="text-align: center; margin-top: 12px;">
            <p style="font-size: 11px; color: #cbd5e1;">
              This is an automated message. Please do not reply directly to this email.
            </p>
          </div>

        </div>
      </body>
    </html>
  `;

  const text = `${greeting}

We received a request to reset your password for WorldSkills Skill Tracker.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

Sent via Worldskills Skill Tracker`;

  await sendEmail({
    to,
    subject,
    html,
    text,
  });
}

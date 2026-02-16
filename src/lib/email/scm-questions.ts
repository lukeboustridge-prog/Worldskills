import { sendEmail } from "./resend";

interface SendSCMQuestionsReminderEmailParams {
  to: string;
  name: string;
  unansweredCount: number;
}

export async function sendSCMQuestionsReminderEmail({
  to,
  name,
  unansweredCount,
}: SendSCMQuestionsReminderEmailParams) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skill-tracker.worldskills2026.com";
  const loginUrl = `${baseUrl}/login?showQuestions=1`;
  const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";

  const questionWord = unansweredCount === 1 ? "question" : "questions";
  const subject = `Action Required: ${unansweredCount} ${questionWord} pending in Skill Tracker`;

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
                WorldSkills Skill Tracker
              </h1>
            </div>

            <div style="padding: 28px 24px 32px;">

              <p style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #334155; line-height: 1.5;">
                Hi <strong>${name}</strong>,
              </p>

              <p style="margin-top: 0; margin-bottom: 24px; font-size: 16px; color: #334155; line-height: 1.5;">
                You have <strong>${unansweredCount} ${questionWord}</strong> waiting for your response in the Skill Tracker. Please take a moment to provide your answers.
              </p>

              <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">
                  These questions help us better support you and improve the competition experience. Your responses are important to us.
                </p>
              </div>

              <div style="text-align: center;">
                <a href="${loginUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
                  Answer Questions Now
                </a>
              </div>

            </div>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <p style="font-size: 12px; color: #94a3b8;">
              Sent via WorldSkills Skill Tracker
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

  const text = `Hi ${name},

You have ${unansweredCount} ${questionWord} waiting for your response in the Skill Tracker.

Please log in to provide your answers: ${loginUrl}

These questions help us better support you and improve the competition experience. Your responses are important to us.

- WorldSkills Skill Tracker`;

  await sendEmail({
    to,
    subject,
    html,
    text,
  });
}

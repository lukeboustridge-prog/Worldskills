import { sendEmail } from "./resend";

interface SendDeliverableStatusNotificationParams {
  to: string[];
  skillName: string;
  skillId: string;
  deliverableLabel: string;
  previousStatus: string;
  newStatus: string;
  changedByName: string;
  comment?: string | null;
}

export async function sendDeliverableStatusNotification({
  to,
  skillName,
  skillId,
  deliverableLabel,
  previousStatus,
  newStatus,
  changedByName,
  comment,
}: SendDeliverableStatusNotificationParams) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-actual-app-url.vercel.app";
  const skillUrl = `${baseUrl}/skills/${skillId}`;
  const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";

  const subject = `Deliverable Update: ${deliverableLabel} - ${newStatus}`;

  const commentSection = comment
    ? `
      <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #a16207; text-transform: uppercase; letter-spacing: 0.5px;">Comment</p>
        <p style="margin: 0; font-size: 14px; color: #78350f; white-space: pre-wrap; line-height: 1.6;">${comment}</p>
      </div>
    `
    : "";

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
                <strong>${changedByName}</strong> updated a deliverable status in <strong>${skillName}</strong>.
              </p>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1e293b;">${deliverableLabel}</p>
                <p style="margin: 0; font-size: 14px; color: #64748b;">
                  Status changed from <strong style="color: #475569;">${previousStatus}</strong> to <strong style="color: #059669;">${newStatus}</strong>
                </p>
              </div>

              ${commentSection}

              <div style="text-align: center;">
                <a href="${skillUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
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

  const commentText = comment ? `\n\nComment: ${comment}` : "";
  const text = `Deliverable Update: ${deliverableLabel}\n\nSkill: ${skillName}\n${changedByName} changed the status from ${previousStatus} to ${newStatus}.${commentText}\n\nView in Skill Tracker: ${skillUrl}`;

  await sendEmail({
    to,
    subject,
    html,
    text,
  });
}

interface SendSkillConversationNotificationParams {
  to: string[];
  skillName: string;
  skillId: string; // Kept for the URL, but removed from Subject
  authorName: string;
  messageContent: string;
}

export async function sendSkillConversationNotification({
  to,
  skillName,
  skillId,
  authorName,
  messageContent,
}: SendSkillConversationNotificationParams) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-actual-app-url.vercel.app";
  const skillUrl = `${baseUrl}/skills/${skillId}`;
  const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";
  
  // 1. Updated Subject Line
  const subject = `Skill Update: New Message in ${skillName}`;

  // 2. Updated HTML with "Card" styling and Button
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
              
              <p style="margin-top: 0; margin-bottom: 24px; font-size: 16px; color: #334155; line-height: 1.5;">
                <strong>${authorName}</strong> posted a new message in <strong>${skillName}</strong>.
              </p>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0; font-family: Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #475569; white-space: pre-wrap; line-height: 1.6;">${messageContent}</p>
              </div>

              <div style="text-align: center;">
                <a href="${skillUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px; transition: background-color 0.2s;">
                  Reply in Worldskills Skill Tracker
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

  const text = `Skill Update: New message in ${skillName}\n\n${authorName} wrote:\n\n${messageContent}\n\nView in Worldskills Skill Tracker: ${skillUrl}`;

  await sendEmail({
    to,
    subject,
    html,
    text,
  });
}

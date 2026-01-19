import { sendEmail } from "./resend";

interface MeetingDetails {
  title: string;
  startTime: Date;
  endTime: Date;
  meetingLink?: string | null;
  skillName: string;
}

interface SendMeetingInvitationParams {
  to: string[];
  meeting: MeetingDetails;
}

function formatDateForICS(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function formatDateForDisplay(date: Date): string {
  return date.toLocaleString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  });
}

function generateICS(meeting: MeetingDetails): string {
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}@worldskills`;
  const now = formatDateForICS(new Date());
  const start = formatDateForICS(meeting.startTime);
  const end = formatDateForICS(meeting.endTime);

  const description = meeting.meetingLink
    ? `Skill: ${meeting.skillName}\\n\\nJoin meeting: ${meeting.meetingLink}`
    : `Skill: ${meeting.skillName}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WorldSkills Skill Tracker//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${meeting.title}`,
    `DESCRIPTION:${description}`,
    meeting.meetingLink ? `URL:${meeting.meetingLink}` : null,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean);

  return lines.join("\r\n");
}

export async function sendMeetingInvitation({
  to,
  meeting
}: SendMeetingInvitationParams) {
  const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";
  const startDisplay = formatDateForDisplay(meeting.startTime);
  const endDisplay = formatDateForDisplay(meeting.endTime);

  const subject = `Meeting Invitation: ${meeting.title} - ${meeting.skillName}`;

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
                Meeting Invitation
              </h1>
            </div>

            <div style="padding: 28px 24px 32px;">

              <h2 style="margin-top: 0; margin-bottom: 8px; font-size: 18px; color: #1e293b;">
                ${meeting.title}
              </h2>

              <p style="margin-top: 0; margin-bottom: 24px; font-size: 14px; color: #64748b;">
                Skill: <strong>${meeting.skillName}</strong>
              </p>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 80px;">Start:</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #334155; font-weight: 500;">${startDisplay}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #64748b;">End:</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #334155; font-weight: 500;">${endDisplay}</td>
                  </tr>
                </table>
              </div>

              ${meeting.meetingLink ? `
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${meeting.meetingLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
                  Join Meeting
                </a>
              </div>

              <p style="margin-top: 0; margin-bottom: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                Or copy this link: <a href="${meeting.meetingLink}" style="color: #2563eb;">${meeting.meetingLink}</a>
              </p>
              ` : ""}

            </div>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <p style="font-size: 12px; color: #94a3b8;">
              Sent via Worldskills Skill Tracker
            </p>
          </div>

          <div style="text-align: center; margin-top: 12px;">
            <p style="font-size: 11px; color: #cbd5e1;">
              Add the attached .ics file to your calendar to save this event.
            </p>
          </div>

        </div>
      </body>
    </html>
  `;

  const text = `Meeting Invitation: ${meeting.title}

Skill: ${meeting.skillName}

Start: ${startDisplay}
End: ${endDisplay}
${meeting.meetingLink ? `\nJoin meeting: ${meeting.meetingLink}` : ""}

Add the attached .ics file to your calendar to save this event.

Sent via Worldskills Skill Tracker`;

  const icsContent = generateICS(meeting);
  const icsBase64 = Buffer.from(icsContent).toString("base64");

  await sendEmail({
    to,
    subject,
    html,
    text,
    attachments: [
      {
        content: icsBase64,
        filename: "invite.ics"
      }
    ]
  });
}

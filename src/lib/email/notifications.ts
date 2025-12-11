import { getFromEmail, sendEmail } from "./resend";

export type NotificationRecipient = {
  email: string;
  name?: string | null;
};

type SkillConversationNotificationParams = {
  skillId: string;
  skillName: string;
  messageBody: string;
  authorName?: string | null;
  authorEmail?: string | null;
  recipients: NotificationRecipient[];
  conversationUrl?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveAppBaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const withProtocol = candidate.startsWith("http") ? candidate : `https://${candidate}`;
      return new URL(withProtocol).origin;
    } catch {
      // ignore and try the next candidate
    }
  }

  return "https://skill-tracker";
}

function buildConversationUrl(skillId: string): string {
  const baseUrl = resolveAppBaseUrl();
  return `${baseUrl}/skills/${encodeURIComponent(skillId)}`;
}

export async function sendSkillConversationNotification(
  params: SkillConversationNotificationParams
) {
  if (params.recipients.length === 0) {
    return;
  }

  const uniqueRecipients: NotificationRecipient[] = [];
  const seenEmails = new Set<string>();

  for (const recipient of params.recipients) {
    const trimmed = recipient.email.trim();
    if (!trimmed) continue;
    const lowered = trimmed.toLowerCase();
    if (seenEmails.has(lowered)) continue;
    seenEmails.add(lowered);
    uniqueRecipients.push({ ...recipient, email: trimmed });
  }

  if (uniqueRecipients.length === 0) {
    return;
  }

  const authorLabel = params.authorName || params.authorEmail || "A teammate";
  const conversationUrl = params.conversationUrl ?? buildConversationUrl(params.skillId);
  const subject = `[Skill ${params.skillId}] New message in ${params.skillName}`;
  const textBody = `Skill ${params.skillName} (${params.skillId})\n\n${authorLabel} wrote:\n\n${params.messageBody}\n\nOpen conversation: ${conversationUrl}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <p style="margin: 0 0 12px 0; font-size: 15px;">New message in <strong>${escapeHtml(
        params.skillName
      )}</strong> (Skill ${escapeHtml(params.skillId)}).</p>
      <p style="margin: 0 0 8px 0; font-size: 15px;">${escapeHtml(authorLabel)} wrote:</p>
      <pre style="background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 14px; white-space: pre-wrap;">${escapeHtml(
        params.messageBody
      )}</pre>
      <p style="margin: 16px 0 0 0; font-size: 15px;">
        <a href="${conversationUrl}" style="color: #2563eb; text-decoration: none;">Open the conversation</a>
      </p>
    </div>
  `;

  const from = getFromEmail();

  await Promise.all(
    uniqueRecipients.map((recipient) =>
      sendEmail({
        from,
        to: recipient.email,
        subject,
        text: textBody,
        html: htmlBody
      })
    )
  );
}

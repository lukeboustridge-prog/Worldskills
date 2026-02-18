import { Resend } from "resend";

let cachedClient: Resend | null = null;

function requireApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return apiKey;
}

function requireFromEmail(): string {
  const fromEmail = process.env.FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("FROM_EMAIL is not configured");
  }
  return fromEmail;
}

export function getResendClient(): Resend {
  if (!cachedClient) {
    cachedClient = new Resend(requireApiKey());
  }
  return cachedClient;
}

export function getFromEmail(): string {
  return requireFromEmail();
}

export type EmailAttachment = {
  content: string;
  filename: string;
};

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
};

export async function sendEmail(params: SendEmailParams) {
  const resend = getResendClient();
  const from = params.from ?? requireFromEmail();

  return resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    replyTo: params.replyTo,
    attachments: params.attachments
  });
}

// Generate a reply-to address for an email that encodes the email ID
export function getReplyToAddress(emailId: string): string {
  const domain = process.env.INBOUND_EMAIL_DOMAIN || "replies.skill-tracker.worldskills2026.com";
  return `reply+${emailId}@${domain}`;
}

// Extract email ID from an inbound reply-to address
export function extractEmailIdFromReplyTo(replyToAddress: string): string | null {
  const match = replyToAddress.match(/reply\+([a-zA-Z0-9_-]+)@/);
  return match ? match[1] : null;
}

export type BatchEmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export async function sendBatchEmails(payloads: BatchEmailPayload[]) {
  if (payloads.length === 0) return { successCount: 0, errors: [] };

  const resend = getResendClient();
  const from = getFromEmail();
  const BATCH_LIMIT = 100;
  const errors: Array<{ index: number; error: string }> = [];
  let successCount = 0;

  for (let i = 0; i < payloads.length; i += BATCH_LIMIT) {
    const chunk = payloads.slice(i, i + BATCH_LIMIT);
    const emails = chunk.map((p) => ({
      from,
      to: p.to,
      subject: p.subject,
      text: p.text,
      html: p.html,
      replyTo: p.replyTo,
    }));

    try {
      const { data, error } = await resend.batch.send(emails);
      if (error) {
        chunk.forEach((_, idx) => errors.push({ index: i + idx, error: error.message }));
      } else {
        successCount += data?.data?.length ?? chunk.length;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown batch send error";
      chunk.forEach((_, idx) => errors.push({ index: i + idx, error: message }));
    }
  }

  return { successCount, errors };
}

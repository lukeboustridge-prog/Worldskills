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
    attachments: params.attachments
  });
}

import { sendEmail } from "./resend";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skill-tracker.worldskills2026.com";
const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";

// NOTIF-01: Email to SA when SCM submits batch
interface SendBatchSubmittedNotificationParams {
  to: string;
  scmName: string;
  descriptorCount: number;
}

export async function sendBatchSubmittedNotification({
  to,
  scmName,
  descriptorCount,
}: SendBatchSubmittedNotificationParams) {
  const reviewUrl = `${baseUrl}/hub/descriptors/pending-review`;
  const descriptorWord = descriptorCount === 1 ? "descriptor" : "descriptors";
  const subject = `Descriptor Review Request: ${descriptorCount} ${descriptorWord} pending`;

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
                Descriptors Pending Review
              </h1>
            </div>

            <div style="padding: 28px 24px 32px;">

              <p style="margin-top: 0; margin-bottom: 24px; font-size: 16px; color: #334155; line-height: 1.5;">
                <strong>${scmName}</strong> has submitted <strong>${descriptorCount} ${descriptorWord}</strong> for your review.
              </p>

              <div style="text-align: center;">
                <a href="${reviewUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
                  Review Descriptors
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

  const text = `Descriptors Pending Review

${scmName} has submitted ${descriptorCount} ${descriptorWord} for your review.

Review descriptors: ${reviewUrl}

Sent via Worldskills Skill Tracker`;

  await sendEmail({
    to,
    subject,
    html,
    text,
  });
}

// NOTIF-02 and NOTIF-03: Email to SCM when descriptor approved (with optional modification flag)
interface SendDescriptorApprovedNotificationParams {
  to: string;
  criterionName: string;
  saName: string;
  wasModified: boolean;
}

export async function sendDescriptorApprovedNotification({
  to,
  criterionName,
  saName,
  wasModified,
}: SendDescriptorApprovedNotificationParams) {
  const viewUrl = `${baseUrl}/hub/descriptors/my-descriptors`;
  const subject = wasModified
    ? `Descriptor Approved with Changes: ${criterionName}`
    : `Descriptor Approved: ${criterionName}`;

  const modificationNote = wasModified
    ? `
      <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #a16207; text-transform: uppercase; letter-spacing: 0.5px;">Note</p>
        <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.6;">The wording was modified during approval. Please review the final version.</p>
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
                Descriptor Approved
              </h1>
            </div>

            <div style="padding: 28px 24px 32px;">

              <p style="margin-top: 0; margin-bottom: 24px; font-size: 16px; color: #334155; line-height: 1.5;">
                Your descriptor <strong>${criterionName}</strong> has been approved by <strong>${saName}</strong>.
              </p>

              ${modificationNote}

              <div style="text-align: center;">
                <a href="${viewUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
                  View My Descriptors
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

  const modificationTextNote = wasModified
    ? "\n\nNote: The wording was modified during approval. Please review the final version."
    : "";

  const text = `Descriptor Approved

Your descriptor '${criterionName}' has been approved by ${saName}.${modificationTextNote}

View my descriptors: ${viewUrl}

Sent via Worldskills Skill Tracker`;

  await sendEmail({
    to,
    subject,
    html,
    text,
  });
}

// NOTIF-04: Email to SCM when descriptor returned with comments
interface SendDescriptorReturnedNotificationParams {
  to: string;
  criterionName: string;
  saName: string;
  comment: string;
}

export async function sendDescriptorReturnedNotification({
  to,
  criterionName,
  saName,
  comment,
}: SendDescriptorReturnedNotificationParams) {
  const viewUrl = `${baseUrl}/hub/descriptors/my-descriptors`;
  const subject = `Descriptor Returned: ${criterionName}`;

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
                Descriptor Returned
              </h1>
            </div>

            <div style="padding: 28px 24px 32px;">

              <p style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #334155; line-height: 1.5;">
                <strong>${saName}</strong> has returned your descriptor <strong>${criterionName}</strong> with feedback.
              </p>

              <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #a16207; text-transform: uppercase; letter-spacing: 0.5px;">Feedback</p>
                <p style="margin: 0; font-size: 14px; color: #78350f; white-space: pre-wrap; line-height: 1.6;">${comment}</p>
              </div>

              <div style="text-align: center;">
                <a href="${viewUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
                  Review Feedback
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

  const text = `Descriptor Returned

${saName} has returned your descriptor '${criterionName}' with feedback.

Feedback: ${comment}

Review feedback: ${viewUrl}

Sent via Worldskills Skill Tracker`;

  await sendEmail({
    to,
    subject,
    html,
    text,
  });
}

// NOTIF-05: Email to SA when SCM resubmits descriptors
interface SendDescriptorsResubmittedNotificationParams {
  to: string;
  scmName: string;
  descriptorCount: number;
}

export async function sendDescriptorsResubmittedNotification({
  to,
  scmName,
  descriptorCount,
}: SendDescriptorsResubmittedNotificationParams) {
  const reviewUrl = `${baseUrl}/hub/descriptors/pending-review`;
  const descriptorWord = descriptorCount === 1 ? "descriptor" : "descriptors";
  const subject = `Revised Descriptors Resubmitted: ${descriptorCount} ${descriptorWord}`;

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
                Revised Descriptors Resubmitted
              </h1>
            </div>

            <div style="padding: 28px 24px 32px;">

              <p style="margin-top: 0; margin-bottom: 24px; font-size: 16px; color: #334155; line-height: 1.5;">
                <strong>${scmName}</strong> has resubmitted <strong>${descriptorCount} revised ${descriptorWord}</strong> for your review.
              </p>

              <div style="text-align: center;">
                <a href="${reviewUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px;">
                  Review Descriptors
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

  const text = `Revised Descriptors Resubmitted

${scmName} has resubmitted ${descriptorCount} revised ${descriptorWord} for your review.

Review descriptors: ${reviewUrl}

Sent via Worldskills Skill Tracker`;

  await sendEmail({
    to,
    subject,
    html,
    text,
  });
}

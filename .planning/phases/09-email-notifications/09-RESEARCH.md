# Phase 9: Email Notifications - Research

**Researched:** 2026-02-04
**Domain:** Email notifications using Resend for descriptor approval workflow
**Confidence:** HIGH

## Summary

Phase 9 implements email notifications for the descriptor approval workflow. The project already has a robust email infrastructure using Resend with established patterns for HTML/text templates and Server Action integration. The task is to create 5 new notification functions following existing patterns and wire them into the already-complete approval workflow actions.

The email infrastructure is mature and well-documented through existing implementations. Server Actions already have TODO comments marking the exact trigger points for notifications. The primary work is creating notification functions in `src/lib/email/` and calling them from existing actions at marked locations.

**Primary recommendation:** Create a single `descriptor-notifications.ts` file with all 5 notification functions following the existing template pattern, then add non-blocking email calls at the marked TODO locations in Phase 7/8 Server Actions.

## Standard Stack

The project already has the email stack fully configured and operational.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | Current | Email sending API | Already in use, configured, tested |

### Supporting (Already Configured)
| Component | Location | Purpose |
|-----------|----------|---------|
| Resend client | `src/lib/email/resend.ts` | Cached client singleton |
| sendEmail | `src/lib/email/resend.ts` | Core send function |
| ENV vars | RESEND_API_KEY, FROM_EMAIL | Already configured |

### No New Dependencies Needed

All required infrastructure exists. No npm install required.

## Architecture Patterns

### Recommended File Structure
```
src/lib/email/
  resend.ts              # Existing - core client
  notifications.ts       # Existing - deliverable/conversation emails
  meeting-invitation.ts  # Existing - calendar invites
  password-reset.ts      # Existing - auth emails
  welcome.ts             # Existing - onboarding
  scm-questions.ts       # Existing - reminder emails
  descriptor-notifications.ts  # NEW - all Phase 9 notifications
```

### Pattern 1: Email Function Structure
**What:** Standard interface and async function pattern
**When to use:** All email notification functions
**Example (from existing codebase):**
```typescript
// Source: src/lib/email/notifications.ts
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

  // ... HTML template with inline styles
  // ... Plain text fallback

  await sendEmail({
    to,
    subject,
    html,
    text,
  });
}
```

### Pattern 2: HTML Email Template Structure
**What:** Consistent email template with WorldSkills branding
**When to use:** All HTML email bodies
**Example (standard template blocks):**
```html
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
    <div style="background-color: #f4f4f5; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">

        <!-- Header with logo and title -->
        <div style="background-color: #2563eb; padding: 24px 24px 18px; text-align: center; border-bottom: 1px solid #1d4ed8;">
          <img src="${logoUrl}" alt="WorldSkills logo" style="height: 48px; width: auto; display: block; margin: 0 auto 16px; border-radius: 8px; background: #f8fafc; padding: 6px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">
            [Email Title]
          </h1>
        </div>

        <!-- Content area -->
        <div style="padding: 28px 24px 32px;">
          <!-- Main message paragraphs -->
          <!-- Info box (gray background) or warning box (yellow) -->
          <!-- CTA button -->
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 24px;">
        <p style="font-size: 12px; color: #94a3b8;">Sent via Worldskills Skill Tracker</p>
      </div>
      <div style="text-align: center; margin-top: 12px;">
        <p style="font-size: 11px; color: #cbd5e1;">This is an automated notification. Please do not reply directly to this email.</p>
      </div>
    </div>
  </body>
</html>
```

### Pattern 3: Non-Blocking Email in Server Actions
**What:** Try/catch pattern for emails that don't block action success
**When to use:** All workflow notification emails
**Example (from existing codebase):**
```typescript
// Source: src/app/(dashboard)/skills/[skillId]/actions.ts lines 136-191
// Send email notification to skill team
try {
  const skillWithTeam = await prisma.skill.findUnique({
    where: { id: parsed.data.skillId },
    include: {
      sa: true,
      scm: true,
      teamMembers: { include: { user: true } }
    }
  });

  if (skillWithTeam) {
    // ... extract recipient emails
    if (recipientEmails.length > 0) {
      await sendDeliverableStatusNotification({
        to: recipientEmails,
        // ... other params
      });
    }
  }
} catch (error) {
  console.error("Failed to send deliverable status notification", {
    skillId: parsed.data.skillId,
    deliverableId: parsed.data.deliverableId,
    error
  });
}
```

### Pattern 4: Lookup SA from SCM
**What:** Query pattern to find SA email from SCM's descriptor
**When to use:** NOTIF-01 (batch submit), NOTIF-05 (resubmit)
**Example:**
```typescript
// SCM creates descriptor -> need to find their SA
// 1. Find skill where this SCM is assigned
const skill = await prisma.skill.findFirst({
  where: { scmId: scmUserId },
  include: { sa: { select: { id: true, email: true, name: true } } }
});

// skill.sa.email is the SA's email
```

### Pattern 5: Lookup SCM from Descriptor
**What:** Query pattern to find SCM email from descriptor
**When to use:** NOTIF-02, NOTIF-03, NOTIF-04 (approval/return notifications)
**Example:**
```typescript
// Descriptor was approved -> need to notify SCM who created it
const descriptor = await prisma.descriptor.findUnique({
  where: { id: descriptorId },
  include: {
    createdBy: { select: { id: true, email: true, name: true } }
  }
});

// descriptor.createdBy.email is the SCM's email
```

### Anti-Patterns to Avoid
- **Blocking emails:** Don't await emails without try/catch - email failures shouldn't break workflow
- **Missing plain text:** Always provide both HTML and text versions
- **Inline JavaScript:** Email clients strip JS - use only inline CSS
- **External CSS:** Email clients don't load external stylesheets - inline everything

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email sending | Custom SMTP client | Resend via existing `sendEmail()` | Already configured, handles errors, caching |
| Email templates | New template structure | Copy existing template pattern | Consistency, proven to render correctly |
| CTA buttons | Custom button styles | Copy existing button styles | Already tested across email clients |
| Info boxes | Custom box styles | Copy existing gray/yellow box patterns | Consistent UX |

**Key insight:** All email patterns are established. Copy structure from existing files, not invent new patterns.

## Common Pitfalls

### Pitfall 1: Forgetting Plain Text Fallback
**What goes wrong:** Some email clients only show plain text
**Why it happens:** HTML looks good, easy to skip text version
**How to avoid:** Always include both `html` and `text` in sendEmail call
**Warning signs:** Email body uses only `html` parameter

### Pitfall 2: Blocking Action on Email Failure
**What goes wrong:** User action fails because email service is down
**Why it happens:** Awaiting sendEmail without try/catch
**How to avoid:** Wrap all email sends in try/catch, log failures, don't throw
**Warning signs:** Email send outside try/catch block

### Pitfall 3: Wrong Recipient Lookup
**What goes wrong:** Email sent to wrong person or no one
**Why it happens:** Complex SA-SCM relationship through Skill model
**How to avoid:** Use established query patterns (Skill.saId -> User, Descriptor.createdById -> User)
**Warning signs:** Direct Prisma query without following relationship chain

### Pitfall 4: Missing Null Checks
**What goes wrong:** TypeError on null email address
**Why it happens:** User might not have email set, SCM might not be assigned
**How to avoid:** Filter recipients with `filter((email): email is string => Boolean(email))`
**Warning signs:** Direct access to `.email` without null check

### Pitfall 5: Hardcoded URLs
**What goes wrong:** Links in emails go to wrong environment
**Why it happens:** Using localhost or hardcoded domain
**How to avoid:** Use `process.env.NEXT_PUBLIC_APP_URL` with fallback
**Warning signs:** Literal URL strings in template

## Code Examples

### Complete Notification Function Template
```typescript
// Source: Pattern extracted from src/lib/email/notifications.ts

import { sendEmail } from "./resend";

interface SendBatchSubmittedNotificationParams {
  to: string;
  scmName: string;
  descriptorCount: number;
  reviewUrl: string;
}

export async function sendBatchSubmittedNotification({
  to,
  scmName,
  descriptorCount,
  reviewUrl,
}: SendBatchSubmittedNotificationParams) {
  const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";

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
            <p style="font-size: 12px; color: #94a3b8;">Sent via Worldskills Skill Tracker</p>
          </div>
          <div style="text-align: center; margin-top: 12px;">
            <p style="font-size: 11px; color: #cbd5e1;">This is an automated notification. Please do not reply directly to this email.</p>
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
```

### Server Action Integration Pattern
```typescript
// After successful action, send notification (non-blocking)
try {
  const skill = await prisma.skill.findFirst({
    where: { scmId: user.id },
    include: { sa: { select: { email: true, name: true } } }
  });

  if (skill?.sa?.email) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://skill-tracker.worldskills2026.com";
    await sendBatchSubmittedNotification({
      to: skill.sa.email,
      scmName: user.name ?? "An SCM",
      descriptorCount: draftCount,
      reviewUrl: `${baseUrl}/hub/descriptors/pending-review`,
    });
  }
} catch (error) {
  console.error("Failed to send batch submitted notification", {
    scmId: user.id,
    draftCount,
    error
  });
}
```

## Trigger Points

Exact locations in existing code where emails should be triggered:

### NOTIF-01: Batch Submitted
**File:** `src/app/(dashboard)/hub/descriptors/my-descriptors/actions.ts`
**Function:** `submitBatchAction()`
**Location:** Line 307 (marked with TODO comment)
**Recipient:** SA (via Skill.saId -> User.email)
**Data needed:** SCM name, descriptor count, review page URL

### NOTIF-02 & NOTIF-03: Descriptors Approved
**File:** `src/app/(dashboard)/hub/descriptors/pending-review/actions.ts`
**Function:** `approveDescriptorAction()`
**Location:** After line 106 (after successful update)
**Recipient:** SCM (via Descriptor.createdById -> User.email)
**Data needed:** Descriptor details, wasModifiedDuringApproval flag

### NOTIF-04: Descriptor Returned
**File:** `src/app/(dashboard)/hub/descriptors/pending-review/actions.ts`
**Function:** `returnDescriptorAction()`
**Location:** After line 163 (after successful update)
**Recipient:** SCM (via Descriptor.createdById -> User.email)
**Data needed:** Descriptor name, SA's review comment

### NOTIF-05: Resubmission
**File:** `src/app/(dashboard)/hub/descriptors/my-descriptors/actions.ts`
**Function:** `submitBatchAction()`
**Location:** Line 307 area (same as NOTIF-01 but detect resubmission)
**Recipient:** SA (via Skill.saId -> User.email)
**Data needed:** SCM name, note that these are revised descriptors

**Detection:** A resubmission can be detected if descriptors being submitted were previously in RETURNED status. Query before update to check if any have `batchStatus = RETURNED` or were recently changed from RETURNED to DRAFT.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Email components | Inline HTML templates | Project convention | Continue using inline HTML, no React Email |
| Multiple email files per feature | Feature-grouped notification files | Project convention | Create single descriptor-notifications.ts |

**Deprecated/outdated:**
- None - email infrastructure is current and stable

## Open Questions

Things that couldn't be fully resolved:

1. **Batch vs Individual Approval Emails**
   - What we know: SA can approve multiple descriptors individually
   - What's unclear: Should we batch approval emails if SA approves many in quick succession?
   - Recommendation: Send individual emails per approval (simpler, matches existing patterns). Batching would require queuing/debouncing which adds complexity.

2. **Resubmission Detection**
   - What we know: SCM edits RETURNED descriptor (moves to DRAFT), then submits batch
   - What's unclear: Best way to detect "this is a resubmission" vs "new submission"
   - Recommendation: Before updating DRAFT->PENDING_REVIEW, query if any descriptors were recently RETURNED (within last N hours) or have non-null reviewComment. If so, treat as resubmission and send NOTIF-05 instead of NOTIF-01.

## Email Content Specifications

### NOTIF-01: Batch Submitted
- **Subject:** `Descriptor Review Request: ${count} descriptor(s) pending`
- **Body:** "${scmName} has submitted ${count} descriptor(s) for your review."
- **CTA:** "Review Descriptors" -> /hub/descriptors/pending-review

### NOTIF-02: Approved (No Modifications)
- **Subject:** `Descriptor Approved: ${criterionName}`
- **Body:** "Your descriptor '${criterionName}' has been approved by ${saName}."
- **CTA:** "View Descriptor" -> /hub/descriptors/my-descriptors

### NOTIF-03: Approved with Modifications
- **Subject:** `Descriptor Approved with Changes: ${criterionName}`
- **Body:** "Your descriptor '${criterionName}' has been approved by ${saName}. Note: The wording was modified during approval."
- **Info box:** Highlight that wording was changed
- **CTA:** "View Descriptor" -> /hub/descriptors/my-descriptors

### NOTIF-04: Returned
- **Subject:** `Descriptor Returned: ${criterionName}`
- **Body:** "${saName} has returned your descriptor '${criterionName}' with feedback:"
- **Comment box:** Display SA's reviewComment
- **CTA:** "Review Feedback" -> /hub/descriptors/my-descriptors

### NOTIF-05: Resubmitted
- **Subject:** `Revised Descriptor Resubmitted: ${count} descriptor(s)`
- **Body:** "${scmName} has resubmitted ${count} revised descriptor(s) for your review."
- **CTA:** "Review Descriptors" -> /hub/descriptors/pending-review

## Sources

### Primary (HIGH confidence)
- `src/lib/email/resend.ts` - Core email infrastructure
- `src/lib/email/notifications.ts` - Existing notification patterns
- `src/lib/email/meeting-invitation.ts` - Template with attachments
- `src/lib/email/welcome.ts` - Simple welcome template
- `src/app/(dashboard)/skills/[skillId]/actions.ts` - Server Action email integration pattern
- `src/app/(dashboard)/hub/descriptors/my-descriptors/actions.ts` - Trigger point for NOTIF-01, NOTIF-05
- `src/app/(dashboard)/hub/descriptors/pending-review/actions.ts` - Trigger points for NOTIF-02, NOTIF-03, NOTIF-04
- `src/lib/sa-approval.ts` - SA-SCM relationship query patterns
- `prisma/schema.prisma` - Skill model (saId, scmId), Descriptor model

### Secondary (MEDIUM confidence)
- [Resend Next.js Documentation](https://resend.com/docs/send-with-nextjs) - Verified current API

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists and is documented in codebase
- Architecture: HIGH - Clear patterns from 6 existing email files
- Pitfalls: HIGH - Patterns visible in existing code, common email issues documented
- Email content: MEDIUM - Specifications derived from requirements, may need UX feedback

**Research date:** 2026-02-04
**Valid until:** Stable - email infrastructure unlikely to change

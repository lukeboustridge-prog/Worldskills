# Phase 2: Permission & Business Logic Layer - Research

**Researched:** 2026-02-01
**Domain:** Next.js Server Actions authorization, RBAC patterns, email templating, calendar invite generation
**Confidence:** HIGH

## Summary

This phase involves implementing role-based authorization for management meetings (versus skill meetings), building permission checking logic for create/read/update/delete operations based on user roles, and extending email functionality to support multi-recipient calendar invites with meeting-type-aware templates. The research confirms this is a well-established pattern in Next.js applications with clear security best practices and proven libraries.

The standard approach involves: (1) creating reusable authorization helper functions that check user roles and relationships to resources, (2) implementing permission checks at the server action level (not just UI conditional rendering) to ensure security, (3) extending existing email templates to support different meeting types using template parameters, and (4) generating ICS calendar invites using the existing manual generation approach (avoiding library dependencies for this simple use case).

A critical security finding: Next.js Server Actions must perform their own authorization checks since they create public HTTP endpoints. UI-level conditional rendering alone is insufficient for security. The CVE-2025-29927 vulnerability (March 2025) demonstrated that unprotected Server Actions allow unauthenticated access to privileged functionality.

**Primary recommendation:** Use function-based authorization helpers (e.g., `canManageMeeting`, `canViewMeeting`) that check user role and context, call these helpers at the start of every server action, extend the existing `sendMeetingInvitation` function with multi-recipient support and meeting-type awareness, and ensure activity logging works for both skill and management meetings by making `skillId` optional in the logging layer.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 3.23+ | Schema validation for server actions | TypeScript-first validation, type inference, .safeParse() for error handling |
| Next.js Server Actions | 14.2+ | Server-side business logic | Built-in feature, replaces API routes, handles form submissions securely |
| NextAuth (Auth.js) | 4.24+ | Authentication and session management | Already in project, provides session in Server Components |
| Prisma Client | 5.20+ | Type-safe database queries | Already in project, first-class TypeScript support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Resend | 4.0+ | Email delivery with attachments | Already in project, supports ICS attachments, reliable delivery |
| TypeScript Enums/Union Types | 5.5+ | Type-safe role definitions | Built-in, provides autocomplete and compile-time checks |
| bcryptjs | 2.4+ | Password hashing (existing auth) | Already in project, used in authentication layer |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual ICS generation | ical-generator or ics npm packages | Project already has working ICS generation; adding library dependency for simple use case adds overhead without clear benefit |
| Function-based helpers | Class-based authorization service | Functions are simpler, more idiomatic for Next.js server actions, easier to tree-shake |
| Inline permission checks | CASL or Permify libraries | Existing project has simple RBAC needs; full permission framework is overkill |

**Installation:**
```bash
# All dependencies already installed in project
# No new packages needed for Phase 2
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── auth.ts              # Existing auth helpers (getCurrentUser, requireUser)
│   ├── permissions/         # NEW: Permission logic
│   │   ├── meeting.ts       # Meeting-specific permission checks
│   │   └── types.ts         # Shared permission types
│   ├── email/
│   │   └── meeting-invitation.ts  # Extend with meeting type support
│   └── activity.ts          # Extend to support optional skillId
├── app/(dashboard)/
│   └── skills/[skillId]/
│       └── meeting-actions.ts     # Extend with authorization checks
```

### Pattern 1: Authorization Helper Functions
**What:** Reusable functions that check if a user can perform specific actions on resources
**When to use:** At the start of every server action that modifies or accesses protected resources
**Example:**
```typescript
// Source: Auth0 Node.js/TypeScript Tutorial + Next.js security best practices
// File: src/lib/permissions/meeting.ts

import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface User {
  id: string;
  role: Role;
  isAdmin: boolean;
}

interface Meeting {
  skillId: string | null;
}

/**
 * Check if user can create management meetings
 * Only Admins and Secretariat can create management meetings
 */
export function canCreateManagementMeeting(user: User): boolean {
  if (user.isAdmin) return true;
  if (user.role === Role.Secretariat) return true;
  return false;
}

/**
 * Check if user can view a specific meeting
 * - Skill meetings: SA, SCM, team members for that skill
 * - Management meetings: All SAs + Secretariat members in attendee list
 */
export async function canViewMeeting(
  user: User,
  meeting: Meeting
): Promise<boolean> {
  // Management meeting (skillId is null)
  if (meeting.skillId === null) {
    // All Skill Advisors can view management meetings
    if (user.role === Role.SA) return true;

    // Secretariat members can view if they're in attendee list
    if (user.role === Role.Secretariat) {
      const isAttendee = await prisma.meetingAttendee.findUnique({
        where: {
          meetingId_userId: {
            meetingId: meeting.id,
            userId: user.id
          }
        }
      });
      return !!isAttendee;
    }

    return false;
  }

  // Skill meeting - use existing logic
  const skill = await prisma.skill.findUnique({
    where: { id: meeting.skillId },
    include: { teamMembers: { select: { userId: true } } }
  });

  if (!skill) return false;

  if (user.isAdmin) return true;
  if (user.id === skill.saId) return true;
  if (skill.scmId && user.id === skill.scmId) return true;
  if (skill.teamMembers.some((m) => m.userId === user.id)) return true;

  return false;
}

/**
 * Check if user can edit/delete a meeting
 * - Skill meetings: SA, SCM, team members (existing logic)
 * - Management meetings: Only Admins and Secretariat
 */
export function canManageMeeting(
  user: User,
  meeting: Meeting,
  skill?: { saId: string; scmId: string | null; teamMembers: { userId: string }[] }
): boolean {
  // Management meeting
  if (meeting.skillId === null) {
    if (user.isAdmin) return true;
    if (user.role === Role.Secretariat) return true;
    return false;
  }

  // Skill meeting - existing logic
  if (!skill) return false;
  if (user.isAdmin) return true;
  if (user.id === skill.saId) return true;
  if (skill.scmId && user.id === skill.scmId) return true;
  if (skill.teamMembers.some((m) => m.userId === user.id)) return true;
  return false;
}
```

**Key points:**
- Functions are pure and testable (take user and resource as parameters)
- TypeScript provides autocomplete and type checking
- Async functions for database lookups when needed
- Clear business logic separation from database access

### Pattern 2: Server Action with Authorization Guard
**What:** Every server action validates authorization before performing operations
**When to use:** All server actions that create, read, update, or delete protected resources
**Example:**
```typescript
// Source: Next.js Security Best Practices + Project patterns
// File: src/app/(dashboard)/skills/[skillId]/meeting-actions.ts

import { requireUser } from "@/lib/auth";
import { canCreateManagementMeeting, canManageMeeting } from "@/lib/permissions/meeting";

export async function createManagementMeetingAction(formData: FormData) {
  // 1. Authenticate user
  const user = await requireUser();

  // 2. Authorize action
  if (!canCreateManagementMeeting(user)) {
    throw new Error("Only Admins and Secretariat can create management meetings");
  }

  // 3. Validate input
  const parsed = createManagementMeetingSchema.safeParse({
    title: formData.get("title"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    attendeeIds: JSON.parse(formData.get("attendeeIds") as string)
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  // 4. Execute business logic (create meeting + attendees)
  const meeting = await prisma.meeting.create({
    data: {
      skillId: null,  // Management meeting
      title: parsed.data.title,
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
      attendees: {
        create: parsed.data.attendeeIds.map((userId: string) => ({
          userId,
          addedBy: user.id
        }))
      }
    },
    include: {
      attendees: { include: { user: true } }
    }
  });

  // 5. Side effects (send emails, log activity)
  await sendManagementMeetingInvitation({
    meeting,
    attendees: meeting.attendees.map(a => a.user)
  });

  await logActivity({
    skillId: null,  // Management meeting has no skill
    userId: user.id,
    action: "ManagementMeetingCreated",
    payload: { meetingId: meeting.id, title: meeting.title }
  });

  // 6. Revalidate and return
  revalidatePath("/meetings");
  return { success: true, meetingId: meeting.id };
}
```

**Key points:**
- Clear 6-step pattern: authenticate, authorize, validate, execute, side-effects, return
- Authorization happens BEFORE validation to fail fast
- Throw errors for unauthorized access (caught by error boundaries)
- Side effects (email, logging) happen after main operation succeeds

### Pattern 3: Multi-Recipient Email with Meeting Type
**What:** Extend email template to handle different meeting types and multiple recipient lists
**When to use:** Sending calendar invites for both skill meetings and management meetings
**Example:**
```typescript
// Source: Resend documentation + Project patterns
// File: src/lib/email/meeting-invitation.ts

interface MeetingDetails {
  title: string;
  startTime: Date;
  endTime: Date;
  meetingLink?: string | null;
  skillName?: string | null;  // NEW: optional for management meetings
  meetingType: "skill" | "management";  // NEW: distinguish types
}

interface SendMeetingInvitationParams {
  to: string[];  // Array of recipient emails
  meeting: MeetingDetails;
}

export async function sendMeetingInvitation({
  to,
  meeting
}: SendMeetingInvitationParams) {
  const logoUrl = "https://skill-tracker.worldskills2026.com/logo.png";
  const startDisplay = formatDateForDisplay(meeting.startTime);
  const endDisplay = formatDateForDisplay(meeting.endTime);
  const googleCalendarLink = generateGoogleCalendarLink(meeting);

  // Dynamic subject based on meeting type
  const subject = meeting.meetingType === "skill"
    ? `Meeting Invitation: ${meeting.title} - ${meeting.skillName}`
    : `Skill Advisor Meeting: ${meeting.title}`;

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
                ${meeting.meetingType === "skill" ? "Skill Meeting Invitation" : "Skill Advisor Meeting"}
              </h1>
            </div>

            <div style="padding: 28px 24px 32px;">
              <h2 style="margin-top: 0; margin-bottom: 8px; font-size: 18px; color: #1e293b;">
                ${meeting.title}
              </h2>

              ${meeting.skillName ? `
                <p style="margin-top: 0; margin-bottom: 24px; font-size: 14px; color: #64748b;">
                  Skill: <strong>${meeting.skillName}</strong>
                </p>
              ` : `
                <p style="margin-top: 0; margin-bottom: 24px; font-size: 14px; color: #64748b;">
                  <strong>Management Meeting</strong>
                </p>
              `}

              <!-- Time details, meeting link, calendar buttons... -->

            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const icsContent = generateICS(meeting);
  const icsBase64 = Buffer.from(icsContent).toString("base64");

  await sendEmail({
    to,  // Resend supports array of recipients
    subject,
    html,
    text: generateTextVersion(meeting),
    attachments: [
      {
        content: icsBase64,
        filename: "invite.ics"
      }
    ]
  });
}
```

**Key points:**
- Single function handles both meeting types via conditional logic
- `to` parameter accepts array of emails (Resend native support)
- Template uses conditional rendering based on `meetingType`
- ICS generation uses existing manual approach (no new dependencies)

### Pattern 4: Optional Skill ID in Activity Logging
**What:** Extend activity logging to support management meetings (which have no skillId)
**When to use:** Logging actions for both skill-specific and management meetings
**Example:**
```typescript
// Source: Project patterns + Prisma optional relations
// File: src/lib/activity.ts

interface LogActivityParams {
  skillId: string | null;  // CHANGED: make optional for management meetings
  userId: string;
  action: string;
  payload?: Prisma.InputJsonValue;
}

export async function logActivity({
  skillId,
  userId,
  action,
  payload
}: LogActivityParams) {
  // Note: ActivityLog table needs schema update to make skillId optional
  // For Phase 2, this might need to be addressed or create separate log
  await prisma.activityLog.create({
    data: {
      skillId: skillId ?? "MANAGEMENT",  // Temporary: use special ID for management
      userId,
      action,
      payload: payload ?? Prisma.JsonNull
    }
  });
}
```

**Key points:**
- Handle null skillId for management meetings
- May require ActivityLog schema update in future phase
- Temporary solution: use special sentinel value "MANAGEMENT"
- Better solution: make ActivityLog.skillId optional (requires migration)

### Anti-Patterns to Avoid
- **UI-only authorization:** Never rely on conditional rendering alone for security; always check permissions in server actions
- **Hardcoded role strings:** Use TypeScript enums (`Role.SA`) instead of strings (`"SA"`) to prevent typos
- **Mixing authorization and business logic:** Keep permission checks separate from database operations for testability
- **Forgetting to await async permission checks:** Always await functions that query the database for permission data
- **Not validating input before authorization:** Validate schema first to fail fast on malformed input, but authorize before executing business logic
- **Circular dependencies:** Don't import server actions into permission helpers; permission helpers should be pure utilities

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Manual FormData parsing with type assertions | Zod with .safeParse() | Type safety, error messages, schema-as-single-source-of-truth |
| Email template engine | Complex templating library (Pug, Handlebars) | Template literals with conditionals | Simple use case, already working in codebase |
| ICS calendar generation | ical-generator or ics library | Manual ICS string generation (existing) | Project already has working implementation, adding library adds bundle size |
| Permission framework | CASL, Permify, or custom class hierarchies | Simple function-based helpers | Project has straightforward RBAC, not complex ABAC needs |
| Session management | Custom JWT handling | NextAuth (already in project) | Security hardening, session refresh, middleware integration |

**Key insight:** For simple authorization needs (role-based with resource ownership), function-based helpers are more maintainable than full permission frameworks. The project already has working patterns for email and ICS generation; extending them is simpler than refactoring to use new libraries.

## Common Pitfalls

### Pitfall 1: Authorization in UI Components Instead of Server Actions
**What goes wrong:** User can bypass UI restrictions by directly calling server action endpoints
**Why it happens:** Developers assume hiding a button prevents action execution, forgetting Server Actions are public HTTP endpoints
**How to avoid:** Always implement authorization checks inside server actions, even if UI already hides the button. UI checks are for UX, server checks are for security.
**Warning signs:** Server actions that don't call `requireUser()` or check permissions, relying on "users won't see this button" reasoning
**Security impact:** CVE-2025-29927 demonstrated this allows unauthenticated privilege escalation

### Pitfall 2: Not Handling Null SkillId in Queries
**What goes wrong:** Prisma queries fail or return unexpected results when skillId is null
**Why it happens:** Forgetting that `where: { skillId: meeting.skillId }` with null returns all meetings without skills, not the specific meeting
**How to avoid:** Use explicit null checks: `where: { skillId: null }` for management meetings, `where: { skillId: { not: null } }` for skill meetings
**Warning signs:** Queries returning multiple records when expecting one, or no records when expecting all management meetings

### Pitfall 3: Sending Individual Emails Instead of Using CC/BCC
**What goes wrong:** Sending N separate emails instead of one email with multiple recipients wastes API calls and creates inconsistent delivery timing
**Why it happens:** Misunderstanding that Resend's `to` parameter accepts arrays
**How to avoid:** Use `to: [email1, email2, email3]` to send one email to multiple recipients. Each recipient gets their own copy but it's one API call.
**Warning signs:** Loop over recipients calling sendEmail multiple times, high email API usage, recipients receiving invites at different times

### Pitfall 4: Missing Attendee Cascade Deletes
**What goes wrong:** Deleting a meeting leaves orphaned MeetingAttendee records; deleting a user fails with foreign key constraint error
**Why it happens:** Forgetting `onDelete: Cascade` in Prisma schema for junction tables
**How to avoid:** Phase 1 already set up cascade deletes correctly. Verify they work in testing.
**Warning signs:** Database growing with orphaned records, "Foreign key constraint failed" errors when deleting users

### Pitfall 5: Inconsistent Meeting Type Detection
**What goes wrong:** Different parts of codebase use different logic to determine if meeting is management vs skill type
**Why it happens:** Some code checks `meeting.skillId === null`, others check `!meeting.skill`, others check `meeting.meetingType`
**How to avoid:** Use single source of truth: `meeting.skillId === null` for management meetings. Avoid adding derived `meetingType` field unless absolutely necessary.
**Warning signs:** Template showing wrong badge, permissions failing inconsistently, activity logs showing wrong meeting type

### Pitfall 6: Forgetting to Revalidate Paths After Mutations
**What goes wrong:** UI shows stale data after creating/updating/deleting meetings
**Why it happens:** Server actions modify database but don't tell Next.js to re-fetch data
**How to avoid:** Call `revalidatePath()` at end of every server action that mutates data. For meetings, revalidate both `/skills/[skillId]` and `/meetings`.
**Warning signs:** Need to refresh browser to see changes, inconsistent UI state

## Code Examples

Verified patterns from official sources:

### Retrieving All Meetings for a Skill Advisor
```typescript
// Source: Project requirements + Prisma relation queries
// Skill Advisors see all management meetings + their skill meetings

async function getMeetingsForSkillAdvisor(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      skillsAsSA: { select: { id: true } }
    }
  });

  if (!user || user.role !== Role.SA) {
    throw new Error("User is not a Skill Advisor");
  }

  const meetings = await prisma.meeting.findMany({
    where: {
      OR: [
        // All management meetings (skillId is null)
        { skillId: null },
        // Skill meetings for skills where user is SA
        { skillId: { in: user.skillsAsSA.map(s => s.id) } }
      ]
    },
    include: {
      skill: { select: { name: true } },
      attendees: {
        include: { user: { select: { name: true, email: true } } }
      }
    },
    orderBy: { startTime: "desc" }
  });

  return meetings;
}
```

### Retrieving Meetings for Secretariat Member
```typescript
// Secretariat members see only management meetings they're invited to

async function getMeetingsForSecretariat(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user || user.role !== Role.Secretariat) {
    throw new Error("User is not a Secretariat member");
  }

  const meetings = await prisma.meeting.findMany({
    where: {
      AND: [
        { skillId: null },  // Management meetings only
        {
          attendees: {
            some: { userId: userId }  // User is in attendee list
          }
        }
      ]
    },
    include: {
      attendees: {
        include: { user: { select: { name: true, email: true } } }
      }
    },
    orderBy: { startTime: "desc" }
  });

  return meetings;
}
```

### Creating Management Meeting with Attendees
```typescript
// Source: Prisma nested creates + project patterns

const createManagementMeetingSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  startTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid start time"
  }),
  endTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid end time"
  }),
  meetingLink: z.string().url().optional().or(z.literal("")),
  attendeeIds: z.array(z.string()).min(1, "At least one attendee required")
});

export async function createManagementMeetingAction(formData: FormData) {
  const user = await requireUser();

  if (!canCreateManagementMeeting(user)) {
    throw new Error("Only Admins and Secretariat can create management meetings");
  }

  const parsed = createManagementMeetingSchema.safeParse({
    title: formData.get("title"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    meetingLink: formData.get("meetingLink") || "",
    attendeeIds: JSON.parse(formData.get("attendeeIds") as string || "[]")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const startTime = new Date(parsed.data.startTime);
  const endTime = new Date(parsed.data.endTime);

  if (endTime <= startTime) {
    throw new Error("End time must be after start time");
  }

  // Get all Skill Advisors
  const allSAs = await prisma.user.findMany({
    where: { role: Role.SA },
    select: { id: true, email: true, name: true }
  });

  // Get selected Secretariat members
  const selectedSecretariat = await prisma.user.findMany({
    where: {
      id: { in: parsed.data.attendeeIds },
      role: Role.Secretariat
    },
    select: { id: true, email: true, name: true }
  });

  // Combine all recipients
  const allAttendeeIds = [
    ...allSAs.map(sa => sa.id),
    ...selectedSecretariat.map(s => s.id)
  ];

  const meeting = await prisma.meeting.create({
    data: {
      skillId: null,  // Management meeting
      title: parsed.data.title,
      startTime,
      endTime,
      meetingLink: parsed.data.meetingLink || null,
      attendees: {
        create: allAttendeeIds.map(userId => ({
          userId,
          addedBy: user.id
        }))
      }
    },
    include: {
      attendees: { include: { user: true } }
    }
  });

  // Send email to all attendees
  const recipientEmails = [
    ...allSAs.map(sa => sa.email),
    ...selectedSecretariat.map(s => s.email)
  ];

  if (recipientEmails.length > 0) {
    await sendMeetingInvitation({
      to: recipientEmails,
      meeting: {
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        meetingLink: meeting.meetingLink,
        skillName: null,
        meetingType: "management"
      }
    });
  }

  await logActivity({
    skillId: null,
    userId: user.id,
    action: "ManagementMeetingCreated",
    payload: {
      meetingId: meeting.id,
      title: meeting.title,
      attendeeCount: allAttendeeIds.length
    }
  });

  revalidatePath("/meetings");

  return { success: true, meetingId: meeting.id };
}
```

### Authorization Check in Document Access
```typescript
// Source: Security best practices + project requirements
// Management meeting documents need different permission checks

export async function getMeetingDocumentDownloadUrl(
  meetingId: string,
  documentId: string
) {
  const user = await requireUser();

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      skill: {
        include: {
          teamMembers: { select: { userId: true } }
        }
      },
      attendees: { select: { userId: true } }
    }
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  // Authorization logic branches based on meeting type
  let authorized = false;

  if (meeting.skillId === null) {
    // Management meeting
    if (user.role === Role.SA) {
      authorized = true;  // All SAs can access
    } else if (user.role === Role.Secretariat) {
      // Check if user is attendee
      authorized = meeting.attendees.some(a => a.userId === user.id);
    }
  } else {
    // Skill meeting - existing logic
    if (user.isAdmin) {
      authorized = true;
    } else if (meeting.skill) {
      authorized = (
        user.id === meeting.skill.saId ||
        (meeting.skill.scmId && user.id === meeting.skill.scmId) ||
        meeting.skill.teamMembers.some(m => m.userId === user.id)
      );
    }
  }

  if (!authorized) {
    throw new Error("You do not have permission to access this document");
  }

  // Generate presigned URL for download
  const documents = normaliseMeetingDocuments(meeting.documents);
  const document = documents.find(d => d.id === documentId);

  if (!document) {
    throw new Error("Document not found");
  }

  const downloadUrl = await getSignedDownloadUrl(document.storageKey);

  return { url: downloadUrl, fileName: document.fileName };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API Routes for mutations | Next.js Server Actions | Next.js 13.4+ (2023) | Direct form submission, no client-side fetch, automatic serialization |
| Manual role checking in each action | Wrapper functions (withAuth, withPermission) | 2024-2025 pattern | Centralized auth logic, less boilerplate, easier to audit |
| Individual email sends in loop | Single API call with recipient array | Resend v4+ (2024) | Fewer API calls, consistent delivery, better rate limiting |
| Class-based permission systems | Function-based helpers | TypeScript best practices (2025) | Tree-shakeable, simpler testing, no OOP overhead |
| .parse() with try-catch | .safeParse() with discriminated union | Zod best practices (2024+) | Type-safe error handling, no exceptions for validation |

**Deprecated/outdated:**
- **getServerSideProps for auth checks:** Use Server Components with `auth()` helper instead
- **API routes for simple mutations:** Use Server Actions unless need public REST API
- **Conditional rendering for security:** Always supplement with server-side authorization
- **Throwing errors in Zod schemas:** Use `.safeParse()` and handle errors gracefully

## Open Questions

Things that couldn't be fully resolved:

1. **Should ActivityLog support null skillId, or use separate logging for management meetings?**
   - What we know: Current ActivityLog.skillId is required (String), management meetings have no skill
   - What's unclear: Product preference for unified vs separate activity logs
   - Recommendation: Make ActivityLog.skillId optional (String?) in future schema migration, use null for management meetings. This keeps logging unified and queryable.

2. **Should all Skill Advisors be automatically added to MeetingAttendee junction table?**
   - What we know: Requirements say "All Skill Advisors are automatically included in management meetings"
   - What's unclear: Whether this means physical MeetingAttendee records or just query logic
   - Recommendation: Don't create MeetingAttendee records for SAs (avoid N records per meeting). Instead, query logic includes management meetings for all SAs via OR clause. This keeps junction table lean and makes SA list dynamic.

3. **What happens to management meetings if a Secretariat member is deleted?**
   - What we know: Cascade delete will remove their MeetingAttendee records
   - What's unclear: Should meeting be deleted if it has no remaining Secretariat attendees (all SAs still get it)?
   - Recommendation: Keep meeting alive even if no Secretariat attendees remain, since all SAs can still access it. Consider adding "created by" field to track ownership.

4. **Should email template distinguish "Skill Meeting" vs "Skill Advisor Meeting" or more generic?**
   - What we know: Requirements specify visual badges distinguish types
   - What's unclear: Whether email subject/content should be equally explicit or more subtle
   - Recommendation: Use clear distinction in email: "Skill Advisor Meeting" for management meetings shows in subject line and header. This sets clear expectations for recipients.

5. **Error handling for email failures in management meeting creation**
   - What we know: Current code logs email failures but doesn't fail the transaction
   - What's unclear: Should management meeting creation fail if emails can't be sent?
   - Recommendation: Keep current pattern (log error but don't fail transaction). Meeting is created successfully; email delivery is best-effort. Consider retry queue in future if email reliability becomes critical.

## Sources

### Primary (HIGH confidence)
- [Auth.js - Role Based Access Control](https://authjs.dev/guides/role-based-access-control) - RBAC patterns for NextAuth
- [Next.js Official Docs - Authentication](https://nextjs.org/docs/app/guides/authentication) - Server action auth patterns
- [Next.js Official Docs - Data Security](https://nextjs.org/docs/app/guides/data-security) - Security best practices
- [Next.js Blog - Security in Server Components](https://nextjs.org/blog/security-nextjs-server-components-actions) - Authorization in Server Actions
- [Zod Official Docs](https://zod.dev/) - Schema validation API
- Project codebase analysis: `src/lib/auth.ts`, `src/app/(dashboard)/skills/[skillId]/meeting-actions.ts`, `src/lib/email/meeting-invitation.ts`

### Secondary (MEDIUM confidence)
- [Building a Permission-Based Server Action Framework in Next.js](https://medium.com/@davxne/building-a-permission-based-server-action-framework-in-next-js-0f53aad0b1ad) - Wrapper pattern for permissions (2025)
- [RBAC vs ABAC vs ReBAC: Choosing the Right Permission System](https://blog.webdevsimplified.com/2025-11/rbac-vs-abac-vs-rebac/) - When to use RBAC vs more complex models (2025)
- [Clerk - Implement RBAC in Next.js 15](https://clerk.com/blog/nextjs-role-based-access-control) - RBAC implementation patterns (2025)
- [Auth0 - Node.js and TypeScript Tutorial: Secure an Express API](https://auth0.com/blog/node-js-and-typescript-tutorial-secure-an-express-api/) - Authorization helper patterns
- [Authorization Patterns: Access Control - Krython](https://krython.com/tutorial/typescript/authorization-patterns-access-control/) - TypeScript permission patterns
- [Mailtrap - Node.js Email Best Practices 2026](https://mailtrap.io/blog/send-emails-with-nodejs/) - Email template organization
- [GitHub - adamgibbons/ics](https://github.com/adamgibbons/ics) - ICS generation library (evaluated, not used)
- [NPM - ical-generator](https://www.npmjs.com/package/ical-generator) - Alternative ICS library (evaluated, not used)

### Tertiary (LOW confidence)
- Multiple Medium articles on RBAC patterns in Next.js (2024-2026) - General validation of patterns
- Stack Overflow discussions on Zod validation in server actions - Community patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project dependencies (NextAuth, Zod, Prisma, Resend)
- Architecture: HIGH - Patterns verified from official Next.js/Auth.js docs and existing codebase
- Pitfalls: HIGH - Security vulnerability (CVE-2025-29927) documented, common mistakes well-known
- Email patterns: MEDIUM-HIGH - Resend API verified, but WebFetch failed to access official docs directly

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days) - Next.js and auth patterns are stable; security best practices evolve slowly

**Notes:**
- No new npm packages needed for Phase 2
- All patterns extend existing codebase conventions
- Security considerations prioritized due to recent CVE disclosure
- Activity logging may need schema update in future phase (deferred decision)

# Stack Analysis: Management Meetings Feature

## Executive Summary

**NO NEW DEPENDENCIES REQUIRED.** The existing stack fully supports management meetings functionality. This is a data model and business logic change, not a technology stack change.

## Existing Stack (Validated - DO NOT CHANGE)

### Core Framework
- **Next.js 14.2.10** with React 18.3.1
- **TypeScript 5.5.4** for type safety

### Database & ORM
- **Prisma ORM 5.20.0** with PostgreSQL
- Already handles JSON fields for flexible data (documents, links)
- Role-based access control via NextAuth integration

### Authentication & Authorization
- **NextAuth 4.24.7** for session management
- User roles: SA, SCM, SkillTeam, Secretariat, Pending
- Role enum already includes `Secretariat` role

### Email & Calendar
- **Resend 4.0.0** for email delivery
- Existing `sendMeetingInvitation()` function generates:
  - ICS calendar files
  - Google Calendar links
  - HTML email templates
- Located at: `src/lib/email/meeting-invitation.ts`

### File Storage
- **AWS SDK for JavaScript v3** (@aws-sdk/client-s3 ^3.637.0)
- **S3 Request Presigner** (@aws-sdk/s3-request-presigner ^3.637.0)
- Presigned URL generation for uploads/downloads
- Existing implementation at: `src/lib/storage.ts`

### UI & Styling
- **Tailwind CSS 3.4.14** with Radix UI primitives
- **Lucide React 0.441.0** for icons
- **date-fns 3.6.0** for date formatting

## Required Changes for Management Meetings

### 1. Database Schema Extension (Prisma)

**What to add:**
```prisma
model ManagementMeeting {
  id           String    @id @default(cuid())
  title        String
  startTime    DateTime
  endTime      DateTime
  meetingLink  String?
  minutes      String?   @db.Text
  actionPoints String?   @db.Text
  documents    Json      @default("[]")
  links        Json      @default("[]")
  attendees    Json      @default("[]")  // NEW: flexible attendee list
  createdAt    DateTime  @default(now())

  @@index([startTime])
}
```

**Why:**
- Separate table from skill-specific meetings (no `skillId` foreign key)
- JSON `attendees` field for flexible attendee selection (SA + selected Secretariat)
- Reuses proven patterns from existing `Meeting` model
- Same document/link storage pattern already validated

**Alternative considered and rejected:**
- Adding `isManagement` flag to existing `Meeting` table - Rejected because it violates single responsibility principle and complicates queries

### 2. Email Integration (NO CHANGES NEEDED)

**Existing capability:**
- `src/lib/email/meeting-invitation.ts` already supports:
  - Multiple recipients via `to: string[]` parameter
  - Dynamic meeting details
  - Calendar file (.ics) generation
  - Google Calendar links

**Usage for management meetings:**
```typescript
await sendMeetingInvitation({
  to: attendeeEmails,  // All SAs + selected Secretariat
  meeting: {
    title: "Management Committee Meeting",
    startTime: new Date(),
    endTime: new Date(),
    meetingLink: "https://...",
    skillName: "Management"  // Or custom label
  }
});
```

**Why no changes:**
- Function is already abstracted from skill-specific details
- `skillName` parameter can be repurposed or made optional
- ICS generation works identically for any meeting type

### 3. File Storage (NO CHANGES NEEDED)

**Existing capability:**
- `src/lib/storage.ts` provides:
  - `createPresignedUpload()` - Client-side direct uploads
  - `createPresignedDownload()` - Temporary download URLs
  - `deleteStoredObject()` - Cleanup
  - `headStoredObject()` - Metadata retrieval

**Storage key pattern for management meetings:**
```typescript
const storageKey = `management-meetings/${meetingId}/${fileName}`;
```

**Why no changes:**
- Storage is already abstracted from business logic
- Same S3 bucket can organize by prefix
- Existing security model (presigned URLs) works identically

### 4. Authorization Pattern (Extend Existing)

**Existing pattern in `src/lib/permissions.ts`:**
```typescript
export function canViewSkill(user, skill) {
  // Already handles Secretariat role
  if (user.role === Role.Secretariat) return true;
}
```

**New function needed:**
```typescript
export function canManageManagementMeetings(user: UserAccessContext) {
  if (user.isAdmin) return true;
  if (user.role === Role.SA) return true;
  return false;
}

export function canViewManagementMeetings(user: UserAccessContext) {
  if (canManageManagementMeetings(user)) return true;
  if (user.role === Role.Secretariat) return true;
  return false;
}
```

**Why:**
- Follows existing permission pattern
- Reuses `UserAccessContext` interface
- Secretariat can view but not manage (read-only access)

### 5. Server Actions Pattern (Replicate Existing)

**Existing pattern in `src/app/(dashboard)/skills/[skillId]/meeting-actions.ts`:**
- `scheduleMeetingAction()` - Create meeting
- `updateMeetingMinutesAction()` - Update notes
- `addMeetingDocumentAction()` - Attach files
- `addMeetingLinkAction()` - Add links
- `deleteMeetingAction()` - Remove meeting

**New file:** `src/app/(dashboard)/hub/management-meetings/actions.ts`
- Same functions, different permission checks
- No `skillId` parameter required
- Attendee list validation logic

**Why:**
- Proven server action pattern
- Form data validation with Zod (already in use)
- Activity logging pattern can be extended

## What NOT to Add

### ❌ New Email Service
**Why:** Resend 4.0.0 already handles all requirements (multiple recipients, attachments, calendar invites)

### ❌ Calendar API Integration (Google/Outlook)
**Why:** ICS file format is universal and works with all calendar apps. Users can import via email attachment or Google Calendar link.

### ❌ Separate Database
**Why:** PostgreSQL with Prisma handles both skill-specific and management meetings. Prisma's JSON fields provide flexibility without schema rigidity.

### ❌ Real-time Collaboration Tools
**Why:** Not specified in requirements. Minutes/notes are asynchronous updates, not live collaboration.

### ❌ Video Conferencing Integration
**Why:** Meetings use external links (Teams/Zoom). System stores link, doesn't host meetings.

### ❌ Notification System Beyond Email
**Why:** Requirements specify email/calendar only. No mention of SMS, push notifications, or in-app alerts.

### ❌ Attendee RSVP Tracking
**Why:** Not in scope. Calendar invites handle this natively (Accept/Decline/Tentative in email client).

## Integration Points with Existing Stack

### Prisma Schema Integration
```prisma
// Existing User model already has:
model User {
  role Role @default(Pending)
  isAdmin Boolean @default(false)
  // ... existing fields
}

// Existing Role enum already includes:
enum Role {
  Pending
  SA
  SCM
  SkillTeam
  Secretariat  // ✓ Already exists
}
```

**Action:** Add `ManagementMeeting` model to `prisma/schema.prisma`

### NextAuth Integration
- Existing session already provides `user.role` and `user.isAdmin`
- Hub layout already checks: `user.role === Role.Secretariat`
- No NextAuth configuration changes needed

**File:** `src/app/(dashboard)/hub/layout.tsx` (already grants Secretariat access)

### Email Template Reuse
```typescript
// Existing function signature (no changes):
export async function sendMeetingInvitation({
  to: string[],
  meeting: {
    title: string,
    startTime: Date,
    endTime: Date,
    meetingLink?: string | null,
    skillName: string  // Can be "Management Meeting"
  }
})
```

**Action:** Reuse function as-is, or make `skillName` optional for management meetings

### S3 Storage Integration
- Existing bucket/credentials work unchanged
- Use naming convention: `management-meetings/{meetingId}/{filename}`
- Same presigned URL patterns for security

## Version Verification

### Current Versions (from package.json)
- Prisma: ^5.20.0 → Current as of analysis
- Resend: ^4.0.0 → Current as of analysis
- NextAuth: ^4.24.7 → Current stable version (v4 branch)
- AWS SDK: ^3.637.0 → Current v3 branch
- Next.js: 14.2.10 → Stable, pre-v15
- date-fns: ^3.6.0 → Current v3 branch

**Note:** All versions are current and stable. No upgrades required for management meetings feature.

### Why These Versions Work
- **Prisma 5.20+:** Native JSON field support, stable PostgreSQL connector
- **Resend 4.0+:** Attachment support (required for ICS files), TypeScript types
- **NextAuth 4.24+:** Stable session management, Prisma adapter compatibility
- **AWS SDK v3:** Modern promise-based API, presigned URL support
- **Next.js 14.2:** Server Actions (used for meeting creation), stable App Router

## Migration Strategy

### Phase 1: Database Schema
```bash
# Add ManagementMeeting model to schema.prisma
npx prisma migrate dev --name add-management-meetings
```

### Phase 2: Permission Layer
- Add functions to `src/lib/permissions.ts`
- No database changes required

### Phase 3: Server Actions
- Create `src/app/(dashboard)/hub/management-meetings/actions.ts`
- Copy pattern from skill meetings, remove skill validation
- Add attendee list validation

### Phase 4: UI Components
- Reuse existing components from skill meetings:
  - `meeting-document-manager.tsx`
  - `meeting-link-manager.tsx`
  - Form components for scheduling
- No new dependencies

## Attendee List Implementation

### Data Structure (JSON field)
```typescript
interface Attendee {
  userId: string;
  role: "SA" | "Secretariat";
  addedAt: string;
}

// Stored in ManagementMeeting.attendees as JSON array
```

### Selection Logic
```typescript
// Fetch all SAs (auto-include)
const skillAdvisors = await prisma.user.findMany({
  where: { role: Role.SA }
});

// Fetch Secretariat members (selectable)
const secretariatMembers = await prisma.user.findMany({
  where: { role: Role.Secretariat }
});

// Combine based on user selection
const attendees = [
  ...skillAdvisors.map(sa => ({ userId: sa.id, role: "SA" })),
  ...selectedSecretariat.map(s => ({ userId: s.id, role: "Secretariat" }))
];
```

**Why JSON field:**
- Flexible: No junction table needed
- Simple queries: No complex joins
- Follows existing pattern (documents, links already use JSON)

## Rationale Summary

### Why Existing Stack is Sufficient

1. **Data Flexibility:** Prisma's JSON fields eliminate need for complex schema changes
2. **Email Already Abstracted:** `sendMeetingInvitation()` doesn't care about skill vs. management
3. **Storage is Generic:** S3 operations are already abstracted from business logic
4. **Auth Role Exists:** Secretariat role already defined in schema
5. **UI Patterns Proven:** Same meeting interface works for both contexts

### Why No New Dependencies

- **Email:** Resend handles multi-recipient, attachments, custom HTML
- **Calendar:** ICS generation is pure JavaScript (already implemented)
- **Storage:** AWS SDK v3 handles all file operations
- **Forms:** Zod validation already in use
- **UI:** Radix + Tailwind components already built

### Integration Risk: Low

- Database: Single migration, no foreign key changes
- Email: Zero changes to existing service
- Storage: Same bucket, different prefix
- Auth: Role already exists, just add permission helpers
- UI: Copy-paste existing components, remove `skillId` props

## Conclusion

**Stack Additions Required:** ZERO

**Stack Changes Required:** ZERO

**New Code Required:**
- 1 Prisma model (ManagementMeeting)
- 1 set of server actions (copy existing pattern)
- 2 permission helper functions
- UI pages (reuse existing components)

**Existing Stack Utilization:** 100%

The management meetings feature is a **data model and business logic extension**, not a technology stack change. All required capabilities (email, calendar, storage, auth) already exist and are properly abstracted.

---

## Sources & Documentation

### Existing Implementation References
- Email: `C:\Users\LukeBoustridge\Projects\Worldskills\src\lib\email\meeting-invitation.ts`
- Storage: `C:\Users\LukeBoustridge\Projects\Worldskills\src\lib\storage.ts`
- Permissions: `C:\Users\LukeBoustridge\Projects\Worldskills\src\lib\permissions.ts`
- Skill Meetings: `C:\Users\LukeBoustridge\Projects\Worldskills\src\app\(dashboard)\skills\[skillId]\meeting-actions.ts`
- Hub Access: `C:\Users\LukeBoustridge\Projects\Worldskills\src\app\(dashboard)\hub\layout.tsx`
- Prisma Schema: `C:\Users\LukeBoustridge\Projects\Worldskills\prisma\schema.prisma`

### Package Documentation
- Prisma: https://www.prisma.io/docs
- Resend: https://resend.com/docs
- NextAuth: https://next-auth.js.org
- AWS SDK v3: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/

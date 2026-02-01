# Management Meeting Pitfalls

**Research Type:** Project Research — Pitfalls dimension for management meetings
**Date:** 2026-02-01
**Context:** Adding management/coordination meetings to existing skill-based meeting system

----

## Executive Summary

Adding optional foreign keys to production systems creates cascading failure points across database, type system, UI rendering, and business logic layers. The Meeting-Skill relationship is deeply embedded in validation, authorization, email generation, activity logging, and UI rendering. Making `skillId` optional requires coordinated changes across 6+ files and 3 distinct layers (database, API, UI).

**Critical Risk**: NULL pointer exceptions in production during CPW when management meetings are rendered without proper null checks.

**Top 3 Pitfalls**:
1. Null reference errors in UI when accessing `meeting.skill.name` (Phase 2)
2. TypeScript types not updated to reflect optional relations (Phase 1)
3. Validation schemas still requiring skillId (Phase 1)

----

## Pitfall Categories

### 1. Database & Schema Layer

#### Pitfall 1.1: Foreign Key Constraint Violations During Migration
**What Breaks**: Making `skillId` optional in Prisma schema without proper migration strategy

**Warning Signs**:
- Migration fails on production database
- Existing queries return NULL for skill relations
- Prisma generate produces type errors

**Why It Happens**:
```prisma
// Current (required)
model Meeting {
  skillId String
  skill Skill @relation(fields: [skillId], references: [id])
}

// After (optional) - breaks existing queries
model Meeting {
  skillId String?
  skill Skill? @relation(fields: [skillId], references: [id])
}
```

**Prevention Strategy**:
1. Create migration that adds `ALTER TABLE "Meeting" ALTER COLUMN "skillId" DROP NOT NULL;`
2. Test migration on staging database with production data clone
3. Verify all existing meetings still have skillId populated
4. Add database constraint check: `CHECK (skillId IS NOT NULL OR <management_meeting_flag>)`
5. Run migration during low-traffic window (not during CPW peak hours)

**Which Phase**: Phase 1 (Foundation) - Must be first change

**Affected Files**:
- `prisma/schema.prisma` (Meeting model)
- `prisma/migrations/*.sql` (new migration file)

---

#### Pitfall 1.2: Missing Cascade Delete Protection
**What Breaks**: When a Skill is deleted, associated meetings have no cascade behavior defined

**Warning Signs**:
- Orphaned meetings in database when skills deleted
- Foreign key constraint errors when trying to delete skills with meetings
- Inconsistent data state

**Current State**:
```prisma
// Missing onDelete behavior
skill Skill @relation(fields: [skillId], references: [id])
```

**Prevention Strategy**:
1. Add explicit cascade behavior: `@relation(fields: [skillId], references: [id], onDelete: SetNull)`
2. Update skill deletion logic to handle meetings:
   - Option A: Prevent skill deletion if meetings exist
   - Option B: Convert skill meetings to management meetings on skill deletion
3. Add database validation tests for deletion scenarios

**Which Phase**: Phase 1 (Foundation)

**Affected Files**:
- `prisma/schema.prisma`
- `src/app/(dashboard)/skills/actions.ts` (deleteSkill function)

---

#### Pitfall 1.3: Index Performance Degradation
**What Breaks**: Existing `@@index([skillId])` becomes less effective with NULL values

**Warning Signs**:
- Slow queries when filtering meetings by skillId
- Query planner choosing table scans over index
- Database monitoring shows increased query times

**Prevention Strategy**:
1. Add partial index: `CREATE INDEX idx_meeting_skill ON "Meeting"(skillId) WHERE skillId IS NOT NULL;`
2. Add separate index for management meetings: `CREATE INDEX idx_meeting_management ON "Meeting"(id) WHERE skillId IS NULL;`
3. Monitor query performance before/after deployment
4. Consider adding composite index: `@@index([skillId, startTime])` for calendar queries

**Which Phase**: Phase 1 (Foundation)

**Affected Files**:
- `prisma/schema.prisma`
- New migration file for partial indexes

---

### 2. Type System & Validation Layer

#### Pitfall 2.1: TypeScript Types Not Reflecting Optional Relations
**What Breaks**: Generated Prisma types show `skill: Skill` when it should be `skill: Skill | null`

**Warning Signs**:
- TypeScript compiler doesn't catch null access errors
- Runtime errors in production: `Cannot read property 'name' of null`
- Type inference shows wrong types in IDE

**Code That Breaks**:
```typescript
// Currently works, will break silently
const meetings = await prisma.meeting.findMany({
  include: { skill: { select: { name: true } } }
});

meetings.forEach(m => {
  console.log(m.skill.name); // Runtime error if skillId is null
});
```

**Prevention Strategy**:
1. Update all Meeting queries to handle optional skill:
   ```typescript
   include: {
     skill: {
       select: { name: true }
     }
   }
   // Access as: meeting.skill?.name ?? 'Management Meeting'
   ```
2. Add type guards:
   ```typescript
   function isSkillMeeting(meeting: Meeting & { skill: Skill | null }): meeting is Meeting & { skill: Skill } {
     return meeting.skillId !== null;
   }
   ```
3. Enable strict null checks in tsconfig.json if not already enabled
4. Run `tsc --noEmit` to catch all type errors before runtime

**Which Phase**: Phase 1 (Foundation) - Must happen before UI changes

**Affected Files**:
- All files importing Prisma types (10+ files)
- Type definitions that reference Meeting model

---

#### Pitfall 2.2: Validation Schemas Still Requiring skillId
**What Breaks**: Zod schemas reject management meeting creation because skillId is required

**Warning Signs**:
- Form validation errors when creating management meetings
- API returns 400 errors with "skillId is required"
- Can't create management meetings through UI

**Current Code**:
```typescript
// src/app/(dashboard)/skills/[skillId]/meeting-actions.ts
const scheduleMeetingSchema = z.object({
  skillId: z.string().min(1), // ← This breaks management meetings
  title: z.string().min(2),
  // ... other fields
});
```

**Prevention Strategy**:
1. Update schema to make skillId optional:
   ```typescript
   skillId: z.string().min(1).optional(),
   ```
2. Add custom validation:
   ```typescript
   .refine(data => data.skillId || data.isManagementMeeting, {
     message: "Either skillId or management meeting flag required"
   })
   ```
3. Create separate schemas for skill vs management meetings
4. Add schema validation tests covering both meeting types

**Which Phase**: Phase 1 (Foundation)

**Affected Files**:
- `src/app/(dashboard)/skills/[skillId]/meeting-actions.ts` (scheduleMeetingSchema)
- New file: `src/app/(dashboard)/meetings/actions.ts` (management meeting actions)

---

#### Pitfall 2.3: Discriminated Union Types Not Implemented
**What Breaks**: No type-safe way to distinguish skill meetings from management meetings

**Warning Signs**:
- Repeated null checks throughout codebase
- Type narrowing not working correctly
- Confusion about which meeting type is being handled

**Prevention Strategy**:
1. Implement discriminated union type:
   ```typescript
   type SkillMeeting = Meeting & {
     skillId: string;
     skill: Skill;
     meetingType: 'skill';
   };

   type ManagementMeeting = Meeting & {
     skillId: null;
     skill: null;
     meetingType: 'management';
   };

   type AnyMeeting = SkillMeeting | ManagementMeeting;
   ```
2. Add type guards for runtime checking
3. Use discriminated unions in function signatures
4. Document type patterns in CONVENTIONS.md

**Which Phase**: Phase 1 (Foundation)

**Affected Files**:
- New file: `src/types/meeting.ts`
- All files that process meetings

---

### 3. Authorization & Business Logic Layer

#### Pitfall 3.1: Authorization Checks Breaking Without skillId
**What Breaks**: `ensureSkill()` and `canScheduleMeeting()` assume skillId always exists

**Warning Signs**:
- Authorization errors when viewing management meetings
- Users can't create management meetings (403 Forbidden)
- Null pointer errors in permission checks

**Current Code**:
```typescript
// src/app/(dashboard)/skills/[skillId]/meeting-actions.ts
const skill = await ensureSkill(parsed.data.skillId); // ← Breaks if skillId is undefined

function canScheduleMeeting(
  user: { id: string; role: Role; isAdmin: boolean },
  skill: { saId: string; scmId: string | null; teamMembers: { userId: string }[] }
): boolean {
  // All checks assume skill exists
  if (user.id === skill.saId) return true;
  // ...
}
```

**Prevention Strategy**:
1. Split authorization logic:
   ```typescript
   function canScheduleSkillMeeting(user, skill) { /* existing logic */ }
   function canScheduleManagementMeeting(user) {
     return user.isAdmin || user.role === Role.Secretariat;
   }
   ```
2. Create wrapper function:
   ```typescript
   async function canScheduleMeeting(user, skillId?) {
     if (!skillId) return canScheduleManagementMeeting(user);
     const skill = await ensureSkill(skillId);
     return canScheduleSkillMeeting(user, skill);
   }
   ```
3. Add permission tests for both meeting types
4. Document permission matrix in security docs

**Which Phase**: Phase 2 (Core Implementation)

**Affected Files**:
- `src/app/(dashboard)/skills/[skillId]/meeting-actions.ts` (authorization functions)
- New file: `src/lib/permissions/meetings.ts`

---

#### Pitfall 3.2: Activity Logging Assumes skillId Exists
**What Breaks**: All `logActivity()` calls require skillId parameter

**Warning Signs**:
- Activity logs missing for management meetings
- Database errors when trying to log management meeting activities
- Audit trail incomplete

**Current Code**:
```typescript
await logActivity({
  skillId: skill.id, // ← No skill for management meetings
  userId: user.id,
  action: "MeetingCreated",
  payload: { meetingId: meeting.id, title: meeting.title }
});
```

**Current Schema**:
```prisma
model ActivityLog {
  skillId String  // ← Required field
  // ...
  skill Skill @relation(fields: [skillId], references: [id])
}
```

**Prevention Strategy**:
1. **Option A** (Recommended): Make ActivityLog.skillId optional
   - Pros: Consistent with Meeting model changes, supports cross-skill activities
   - Cons: Requires schema migration, affects existing activity queries

2. **Option B**: Use sentinel value for management meetings
   - Create a "Management" pseudo-skill
   - Pros: No schema changes, backward compatible
   - Cons: Confusing data model, harder to query

3. **Option C**: Skip activity logging for management meetings
   - Pros: No changes needed
   - Cons: Loss of audit trail, compliance issues

4. Implementation steps for Option A:
   ```typescript
   // Make skillId optional
   await logActivity({
     skillId: skill?.id ?? null,
     userId: user.id,
     action: "MeetingCreated",
     payload: {
       meetingId: meeting.id,
       title: meeting.title,
       meetingType: skillId ? 'skill' : 'management'
     }
   });
   ```

**Which Phase**: Phase 2 (Core Implementation)

**Affected Files**:
- `prisma/schema.prisma` (ActivityLog model)
- `src/lib/activity.ts` (logActivity function)
- `src/app/(dashboard)/skills/[skillId]/meeting-actions.ts` (all logActivity calls)

---

#### Pitfall 3.3: Validation Logic Assumes Skill Context
**What Breaks**: Meeting validation checks skillId relationship integrity

**Warning Signs**:
- Can't update meeting details
- Meeting CRUD operations fail validation
- Error messages mention missing skill

**Code That Breaks**:
```typescript
const meeting = await prisma.meeting.findUnique({
  where: { id: parsed.data.meetingId }
});

if (!meeting || meeting.skillId !== skill.id) {
  throw new Error("Meeting not found");
}
```

**Prevention Strategy**:
1. Update validation to handle both meeting types:
   ```typescript
   if (!meeting) {
     throw new Error("Meeting not found");
   }

   // For skill meetings, verify ownership
   if (meeting.skillId && meeting.skillId !== skill?.id) {
     throw new Error("Meeting belongs to different skill");
   }

   // For management meetings, verify admin/secretariat access
   if (!meeting.skillId && !canAccessManagementMeeting(user)) {
     throw new Error("Unauthorized");
   }
   ```
2. Create validation helper functions
3. Add comprehensive test coverage for both paths

**Which Phase**: Phase 2 (Core Implementation)

**Affected Files**:
- `src/app/(dashboard)/skills/[skillId]/meeting-actions.ts` (all meeting CRUD operations)

---

### 4. Email & Calendar Integration Layer

#### Pitfall 4.1: Email Templates Require skillName
**What Breaks**: `sendMeetingInvitation()` expects `meeting.skillName` property

**Warning Signs**:
- Email sending fails for management meetings
- Error: "skillName is required"
- No calendar invites generated for management meetings

**Current Code**:
```typescript
// src/lib/email/meeting-invitation.ts
interface MeetingDetails {
  title: string;
  startTime: Date;
  endTime: Date;
  meetingLink?: string | null;
  skillName: string; // ← Required field
}

const subject = `Meeting Invitation: ${meeting.title} - ${meeting.skillName}`;
const description = `Skill: ${meeting.skillName}\\n\\nJoin meeting: ${meeting.meetingLink}`;
```

**Prevention Strategy**:
1. Make skillName optional in interface:
   ```typescript
   interface MeetingDetails {
     skillName?: string | null;
     meetingType: 'skill' | 'management';
   }
   ```
2. Update email template logic:
   ```typescript
   const subject = meeting.skillName
     ? `Meeting Invitation: ${meeting.title} - ${meeting.skillName}`
     : `Management Meeting: ${meeting.title}`;

   const description = meeting.skillName
     ? `Skill: ${meeting.skillName}\\n\\nJoin: ${meeting.meetingLink}`
     : `Skill Advisor Meeting\\n\\nJoin: ${meeting.meetingLink}`;
   ```
3. Update HTML email template to conditionally show skill name
4. Test both email variations before deployment
5. Update Google Calendar and ICS generation functions similarly

**Which Phase**: Phase 2 (Core Implementation) - Must work before management meetings go live

**Affected Files**:
- `src/lib/email/meeting-invitation.ts` (MeetingDetails interface, template logic)
- Email HTML template sections

---

#### Pitfall 4.2: Calendar Event Details Break Formatting
**What Breaks**: Google Calendar and ICS file generation assume skill context

**Warning Signs**:
- Calendar invites show "undefined" for skill name
- ICS files fail to download
- Malformed calendar events

**Current Code**:
```typescript
const details = meeting.meetingLink
  ? `Skill: ${meeting.skillName}\nJoin: ${meeting.meetingLink}`
  : `Skill: ${meeting.skillName}`;
```

**Prevention Strategy**:
1. Create separate calendar generation functions:
   ```typescript
   function generateCalendarDetails(meeting: AnyMeeting) {
     const baseDetails = meeting.meetingLink
       ? `Join: ${meeting.meetingLink}`
       : '';

     if (isSkillMeeting(meeting)) {
       return `Skill: ${meeting.skill.name}\n${baseDetails}`;
     } else {
       return `Skill Advisor Meeting\n${baseDetails}`;
     }
   }
   ```
2. Update both Google Calendar and ICS generators
3. Test calendar event creation on multiple platforms (Google, Outlook, Apple)
4. Verify timezone handling remains correct

**Which Phase**: Phase 2 (Core Implementation)

**Affected Files**:
- `src/lib/email/meeting-invitation.ts` (generateGoogleCalendarLink, generateICSFile functions)

---

#### Pitfall 4.3: Recipient List Generation Breaks
**What Breaks**: Email recipients calculated from skill team members

**Warning Signs**:
- No emails sent for management meetings
- TypeError: Cannot read property 'sa' of null
- Missing meeting invitations

**Current Code**:
```typescript
// src/app/(dashboard)/skills/[skillId]/meeting-actions.ts
const recipientEmails: string[] = [];

if (skill.sa.email) recipientEmails.push(skill.sa.email);
if (skill.scm?.email) recipientEmails.push(skill.scm.email);

const teamMemberUsers = await prisma.user.findMany({
  where: { id: { in: skill.teamMembers.map((m) => m.userId) } },
  select: { email: true }
});
```

**Prevention Strategy**:
1. Split recipient logic by meeting type:
   ```typescript
   async function getSkillMeetingRecipients(skill) {
     const recipients = [];
     if (skill.sa.email) recipients.push(skill.sa.email);
     if (skill.scm?.email) recipients.push(skill.scm.email);
     // ... team members
     return recipients;
   }

   async function getManagementMeetingRecipients() {
     // All Skill Advisors
     const skillAdvisors = await prisma.user.findMany({
       where: { role: Role.SA },
       select: { email: true }
     });
     return skillAdvisors.map(sa => sa.email).filter(Boolean);
   }
   ```
2. Add attendee selection for Secretariat (per requirements)
3. Validate email list before sending
4. Add logging for email delivery

**Which Phase**: Phase 2 (Core Implementation)

**Affected Files**:
- `src/app/(dashboard)/skills/[skillId]/meeting-actions.ts` (scheduleMeeting action)
- New file: `src/lib/email/meeting-recipients.ts`

---

### 5. UI Rendering Layer

#### Pitfall 5.1: NULL Reference Errors in Meeting Lists
**What Breaks**: Direct access to `meeting.skill.name` in JSX

**Warning Signs**:
- White screen of death on meetings page
- React error: "Cannot read property 'name' of null"
- TypeScript error: Object is possibly 'null'

**Code That Breaks**:
```typescript
// src/app/(dashboard)/hub/meetings/page.tsx
<p className="text-sm text-muted-foreground">
  {meeting.skill.name}  {/* ← Crashes if skill is null */}
</p>
```

**Prevention Strategy**:
1. Add null checks with optional chaining:
   ```typescript
   <p className="text-sm text-muted-foreground">
     {meeting.skill?.name ?? 'Management Meeting'}
   </p>
   ```
2. Create Meeting display component:
   ```typescript
   function MeetingSkillBadge({ meeting }: { meeting: AnyMeeting }) {
     if (!meeting.skill) {
       return <Badge variant="secondary">Skill Advisor Meeting</Badge>;
     }
     return <Badge variant="outline">{meeting.skill.name}</Badge>;
   }
   ```
3. Add visual distinction per requirements:
   ```typescript
   <Badge variant={meeting.skillId ? "outline" : "secondary"}>
     {meeting.skillId ? meeting.skill.name : "Skill Advisor Meeting"}
   </Badge>
   ```
4. Test component with both meeting types
5. Add Storybook stories for visual regression testing

**Which Phase**: Phase 3 (UI Integration) - Critical for user-facing functionality

**Affected Files**:
- `src/app/(dashboard)/hub/meetings/page.tsx` (meeting list rendering)
- `src/app/(dashboard)/skills/[skillId]/meeting-list.tsx` (skill-specific meeting list)
- New component: `src/components/meetings/meeting-badge.tsx`

---

#### Pitfall 5.2: Skill-Specific Meeting Routes Break
**What Breaks**: Meeting detail pages at `/skills/[skillId]/...` can't load management meetings

**Warning Signs**:
- 404 errors when clicking management meeting links
- Routing errors in console
- Can't access meeting details for management meetings

**Current Structure**:
```
/skills/[skillId]/page.tsx  ← All meeting UI is here
```

**Prevention Strategy**:
1. Create new route for management meetings:
   ```
   /meetings/[meetingId]/page.tsx  ← New route for all meetings
   ```
2. Update link generation:
   ```typescript
   function getMeetingUrl(meeting: AnyMeeting) {
     return meeting.skillId
       ? `/skills/${meeting.skillId}#meetings`
       : `/meetings/${meeting.id}`;
   }
   ```
3. Share meeting detail components between routes
4. Add breadcrumb navigation showing context
5. Update all meeting links throughout application

**Which Phase**: Phase 3 (UI Integration)

**Affected Files**:
- New file: `src/app/(dashboard)/meetings/[meetingId]/page.tsx`
- `src/app/(dashboard)/hub/meetings/page.tsx` (link generation)
- Navigation components

---

#### Pitfall 5.3: Meeting Forms Can't Handle Missing Skill Context
**What Breaks**: Create/edit meeting forms assume skillId prop exists

**Warning Signs**:
- Can't open create management meeting dialog
- Form validation errors about missing skillId
- TypeScript errors in form components

**Prevention Strategy**:
1. Create separate forms or make skillId optional:
   ```typescript
   interface MeetingFormProps {
     skillId?: string;  // Optional
     onSuccess: () => void;
   }
   ```
2. Conditionally render skill-specific fields
3. Update form submission to handle both types
4. Add form validation for management meetings
5. Create separate entry points:
   ```typescript
   <CreateSkillMeetingButton skillId={skillId} />
   <CreateManagementMeetingButton />  // Admin/Secretariat only
   ```

**Which Phase**: Phase 3 (UI Integration)

**Affected Files**:
- Meeting form components (create/edit dialogs)
- Button components for meeting creation
- Form validation schemas

---

#### Pitfall 5.4: Filtering and Sorting Logic Breaks
**What Breaks**: Meeting list filters assume all meetings have skills

**Warning Signs**:
- Can't filter meetings by skill
- Sort by skill name crashes
- Search functionality returns errors

**Current Code**:
```typescript
const meetings = await prisma.meeting.findMany({
  where: { skillId: { in: skillIds } },  // ← Excludes management meetings
  orderBy: { startTime: "asc" },
  include: { skill: { select: { name: true } } }
});
```

**Prevention Strategy**:
1. Update query to include both meeting types:
   ```typescript
   const meetings = await prisma.meeting.findMany({
     where: {
       OR: [
         { skillId: { in: skillIds } },  // Skill meetings
         { skillId: null }  // Management meetings (if user is SA)
       ]
     },
     include: { skill: { select: { name: true } } }
   });
   ```
2. Update filtering UI to handle both types:
   ```typescript
   <Select>
     <SelectItem value="all">All Meetings</SelectItem>
     <SelectItem value="skill">Skill Meetings</SelectItem>
     <SelectItem value="management">Management Meetings</SelectItem>
     {skills.map(skill => (
       <SelectItem value={skill.id}>{skill.name}</SelectItem>
     ))}
   </Select>
   ```
3. Fix sorting to handle null skill names
4. Update search to include management meeting indicator

**Which Phase**: Phase 3 (UI Integration)

**Affected Files**:
- `src/app/(dashboard)/hub/meetings/page.tsx` (query and filtering logic)

---

### 6. Visibility & Access Control

#### Pitfall 6.1: Visibility Rules Not Enforced at Query Level
**What Breaks**: Database queries don't respect "all SAs see management meetings" requirement

**Warning Signs**:
- Users see meetings they shouldn't have access to
- Missing meetings that should be visible
- Inconsistent meeting lists across different views

**Prevention Strategy**:
1. Implement visibility rules in database queries:
   ```typescript
   async function getVisibleMeetings(user: User) {
     if (user.isAdmin || user.role === Role.Secretariat) {
       // See all meetings
       return prisma.meeting.findMany({ include: { skill: true } });
     }

     if (user.role === Role.SA) {
       // See skill meetings for their skills + all management meetings
       const userSkills = await getUserSkills(user.id);
       return prisma.meeting.findMany({
         where: {
           OR: [
             { skillId: { in: userSkills.map(s => s.id) } },
             { skillId: null }  // Management meetings
           ]
         }
       });
     }

     // SCM and SkillTeam see only their skill meetings
     const userSkills = await getUserSkills(user.id);
     return prisma.meeting.findMany({
       where: { skillId: { in: userSkills.map(s => s.id) } }
     });
   }
   ```
2. Create visibility helper functions
3. Apply consistently across all meeting queries
4. Add authorization tests for each role
5. Document visibility matrix

**Which Phase**: Phase 2 (Core Implementation) - Security critical

**Affected Files**:
- New file: `src/lib/permissions/meeting-visibility.ts`
- `src/app/(dashboard)/hub/meetings/page.tsx`
- All pages that query meetings

---

#### Pitfall 6.2: Meeting Actions Available to Wrong Users
**What Breaks**: Edit/delete buttons shown to users who shouldn't have access

**Warning Signs**:
- SCMs can edit management meetings
- Skill Advisors can't edit their own skill meetings
- Authorization errors when clicking action buttons

**Prevention Strategy**:
1. Create permission check functions:
   ```typescript
   function canEditMeeting(user: User, meeting: AnyMeeting): boolean {
     // Admins can edit all
     if (user.isAdmin) return true;

     // Secretariat can edit management meetings
     if (!meeting.skillId && user.role === Role.Secretariat) {
       return true;
     }

     // SA/SCM can edit their skill meetings
     if (meeting.skillId) {
       return isSkillManager(user, meeting.skillId);
     }

     return false;
   }
   ```
2. Apply to UI conditionally:
   ```typescript
   {canEditMeeting(user, meeting) && (
     <Button onClick={() => editMeeting(meeting)}>Edit</Button>
   )}
   ```
3. Mirror checks on server-side actions
4. Add permission tests

**Which Phase**: Phase 3 (UI Integration)

**Affected Files**:
- New file: `src/lib/permissions/meeting-actions.ts`
- Meeting list and detail components
- Server actions

---

### 7. Data Migration & Deployment

#### Pitfall 7.1: Deploying During CPW Peak Usage
**What Breaks**: Schema changes cause downtime during critical event

**Warning Signs**:
- Database connection errors during migration
- Users can't access meeting features
- Data loss or corruption

**Prevention Strategy**:
1. **DO NOT** deploy during CPW active hours
2. Schedule deployment for off-hours or between CPW days
3. Create deployment checklist:
   - [ ] Backup production database
   - [ ] Test migration on staging with prod data clone
   - [ ] Notify users of maintenance window
   - [ ] Prepare rollback plan
   - [ ] Monitor error logs during deployment
   - [ ] Verify meeting creation/viewing works
   - [ ] Test email/calendar integration
4. Use blue-green deployment if possible
5. Have rollback migration ready:
   ```sql
   ALTER TABLE "Meeting" ALTER COLUMN "skillId" SET NOT NULL;
   ```

**Which Phase**: Phase 4 (Deployment) - Timing critical

---

#### Pitfall 7.2: Existing Data Not Validated After Migration
**What Breaks**: Existing meetings might have data inconsistencies

**Warning Signs**:
- Some meetings missing skill relations
- Orphaned meetings in database
- Inconsistent meeting counts

**Prevention Strategy**:
1. Add post-migration validation script:
   ```typescript
   async function validateMeetingData() {
     // Check: All non-management meetings have valid skillId
     const invalidMeetings = await prisma.meeting.findMany({
       where: {
         AND: [
           { skillId: { not: null } },
           { skill: null }  // FK broken
         ]
       }
     });

     if (invalidMeetings.length > 0) {
       throw new Error(`Found ${invalidMeetings.length} invalid meetings`);
     }

     // Check: All management meetings have skillId = null
     // Check: Meeting counts match expected
   }
   ```
2. Run validation immediately after migration
3. Create data repair script if needed
4. Document validation results

**Which Phase**: Phase 4 (Deployment)

---

#### Pitfall 7.3: No Rollback Plan for Feature
**What Breaks**: Can't easily revert if major issues found in production

**Warning Signs**:
- Feature causes cascading failures
- Performance degradation
- User confusion about new meeting types

**Prevention Strategy**:
1. Create feature flag for management meetings:
   ```typescript
   const ENABLE_MANAGEMENT_MEETINGS = process.env.ENABLE_MANAGEMENT_MEETINGS === 'true';
   ```
2. Make UI changes conditional:
   ```typescript
   {ENABLE_MANAGEMENT_MEETINGS && (
     <CreateManagementMeetingButton />
   )}
   ```
3. Keep existing skill meeting code path unchanged
4. Document rollback procedure:
   - Disable feature flag
   - Roll back database migration
   - Redeploy previous version
5. Test rollback procedure before deployment

**Which Phase**: Phase 4 (Deployment)

---

## Cross-Cutting Concerns

### Testing Gaps
**What Breaks**: Insufficient test coverage for null skill scenarios

**Prevention Strategy**:
1. Add test cases for both meeting types in all test suites
2. Test matrix:
   - Meeting creation (skill vs management)
   - Meeting viewing (different user roles)
   - Meeting editing (permission scenarios)
   - Meeting deletion (cascade behavior)
   - Email sending (both templates)
   - Calendar generation (both formats)
3. Add integration tests for complete workflows
4. Test error handling for null skill cases

**Which Phase**: All phases - Add tests as features developed

---

### Performance Impact
**What Breaks**: Additional null checks and conditional logic slow down queries

**Prevention Strategy**:
1. Benchmark query performance before/after changes
2. Monitor meeting list page load times
3. Use database query explain plans
4. Consider caching for meeting lists
5. Add database indexes strategically
6. Profile email generation performance

**Which Phase**: Phase 2-3 (Core Implementation & UI Integration)

---

### Documentation Gaps
**What Breaks**: Developers don't understand new meeting types or when to use them

**Prevention Strategy**:
1. Update ARCHITECTURE.md with meeting type explanation
2. Document permission matrix in security docs
3. Add code comments explaining optional skill logic
4. Create examples in CONVENTIONS.md
5. Update API documentation
6. Add inline comments for complex conditional logic

**Which Phase**: All phases - Document as you build

---

## Implementation Sequence

To avoid pitfalls, implement in this order:

### Phase 1: Foundation (Database & Types)
1. Update Prisma schema (skillId optional, cascade behavior)
2. Create and test migration
3. Update TypeScript types
4. Update validation schemas
5. Add type guards and helper functions

**Critical**: Must be complete before any business logic changes

---

### Phase 2: Core Implementation (Business Logic)
1. Split authorization functions
2. Update activity logging
3. Implement visibility rules
4. Update email/calendar generation
5. Create management meeting actions

**Critical**: All null checks must be in place

---

### Phase 3: UI Integration
1. Update meeting list components with null checks
2. Add visual badges for meeting types
3. Create management meeting routes
4. Update forms and dialogs
5. Add filtering and sorting support

**Critical**: Test thoroughly before deployment

---

### Phase 4: Deployment
1. Deploy to staging
2. Run validation scripts
3. Test all user flows
4. Schedule production deployment
5. Monitor errors post-deployment

---

## Quick Reference: Files Requiring Changes

| File Path | Changes Needed | Risk Level | Phase |
|-----------|---------------|------------|-------|
| `prisma/schema.prisma` | Make skillId optional, add cascade | HIGH | 1 |
| `src/app/(dashboard)/skills/[skillId]/meeting-actions.ts` | Update schemas, auth, validation | HIGH | 1-2 |
| `src/lib/email/meeting-invitation.ts` | Make skillName optional | HIGH | 2 |
| `src/app/(dashboard)/hub/meetings/page.tsx` | Add null checks, badges | HIGH | 3 |
| `src/app/(dashboard)/skills/[skillId]/meeting-list.tsx` | Add null checks | MEDIUM | 3 |
| `src/lib/activity.ts` | Support optional skillId | MEDIUM | 2 |
| `prisma/migrations/*.sql` | Migration scripts | HIGH | 1 |
| New: `src/app/(dashboard)/meetings/[meetingId]/page.tsx` | Management meeting details | MEDIUM | 3 |
| New: `src/lib/permissions/meetings.ts` | Permission helpers | MEDIUM | 2 |
| New: `src/types/meeting.ts` | Type definitions | LOW | 1 |

---

## Success Criteria

Feature is successfully deployed when:

- [x] All existing skill meetings continue to work without changes
- [x] Management meetings can be created by Admin/Secretariat
- [x] All Skill Advisors see management meetings in their meeting list
- [x] Visual badges distinguish meeting types
- [x] Email invitations work for both meeting types
- [x] Calendar invites generate correctly for both types
- [x] No null reference errors in production logs
- [x] Database migration completed without data loss
- [x] All user roles see correct meetings per permission matrix
- [x] Activity logging works for both meeting types

---

**Last Updated:** 2026-02-01
**Next Review:** After Phase 1 completion

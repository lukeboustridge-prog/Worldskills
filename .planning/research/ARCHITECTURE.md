# Architecture Research: Management Meetings Integration

**Research Date:** 2026-02-01
**Milestone:** Adding management meetings to existing Next.js/Prisma application
**Focus:** Integration patterns for optional skill relationships and selective attendance

## Executive Summary

Management meetings (not tied to skills) can integrate cleanly into the existing meeting architecture with minimal disruption. The current system has a **required** `skillId` foreign key, which needs to become **optional**. The key architectural pattern is to introduce a new `MeetingAttendee` junction table for selective attendance while maintaining backward compatibility with skill-based meetings.

**Key Integration Points:**
1. Database schema: Make `skillId` optional, add `MeetingAttendee` table
2. Access control: Extend permissions.ts patterns for management meetings
3. Email service: Reuse existing meeting invitation system with attendee list
4. UI components: Extend existing meeting components with conditional rendering
5. API routes: Modify meeting-actions.ts to handle both meeting types

**Build Order:**
1. Database migration (schema changes)
2. Permission layer updates
3. Backend actions/API updates
4. UI component modifications
5. Navigation/routing additions

---

## Current Architecture Analysis

### Existing Meeting System

**Database Schema (Current):**
```prisma
model Meeting {
  id           String    @id @default(cuid())
  skillId      String    // REQUIRED - needs to become optional
  title        String
  startTime    DateTime
  endTime      DateTime
  meetingLink  String?
  minutes      String?   @db.Text
  actionPoints String?   @db.Text
  documents    Json      @default("[]")
  links        Json      @default("[]")
  createdAt    DateTime  @default(now())

  skill Skill @relation(fields: [skillId], references: [id])

  @@index([skillId])
  @@index([startTime])
}
```

**Access Control Pattern:**
- Location: `src\app\(dashboard)\skills\[skillId]\meeting-actions.ts`
- Current: `canScheduleMeeting()` checks if user is SA, SCM, or SkillTeam member for the skill
- Permission check: `canManageSkill()` from `src\lib\permissions.ts`
- Email recipients: Hardcoded to skill SA and SCM

**Email Service:**
- Location: `src\lib\email\meeting-invitation.ts`
- Sends to array of email addresses with calendar invite (.ics attachment)
- Includes skill name in meeting context
- Already flexible enough to handle variable recipient lists

**UI Components:**
- `src\app\(dashboard)\skills\[skillId]\meeting-list.tsx` - Client component for skill meetings
- `src\app\(dashboard)\hub\meetings\page.tsx` - Hub view showing all skill meetings
- Components filter meetings by `skillId` membership

**API Routes:**
- `src\app\api\meetings\[meetingId]\documents\upload\route.ts` - Document uploads
- All routes validate meeting belongs to skill via `meeting.skillId`

**Data Flow:**
1. User schedules meeting via form in skill workspace
2. `scheduleMeetingAction()` creates meeting with required `skillId`
3. Email sent to skill SA and SCM automatically
4. Meeting appears in hub filtered by user's skill memberships
5. Documents stored at `meetings/{skillId}/{meetingId}/{file}`

---

## Proposed Integration Architecture

### Database Schema Changes

**Modified Meeting Model:**
```prisma
model Meeting {
  id           String    @id @default(cuid())
  skillId      String?   // MADE OPTIONAL
  title        String
  startTime    DateTime
  endTime      DateTime
  meetingLink  String?
  minutes      String?   @db.Text
  actionPoints String?   @db.Text
  documents    Json      @default("[]")
  links        Json      @default("[]")
  createdAt    DateTime  @default(now())

  skill     Skill?           @relation(fields: [skillId], references: [id])
  attendees MeetingAttendee[]

  @@index([skillId])
  @@index([startTime])
}
```

**New MeetingAttendee Model:**
```prisma
model MeetingAttendee {
  id        String   @id @default(cuid())
  meetingId String
  userId    String
  createdAt DateTime @default(now())

  meeting Meeting @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([meetingId, userId])
  @@index([meetingId])
  @@index([userId])
}
```

**User Model Extension:**
```prisma
model User {
  // ... existing fields
  meetingAttendances MeetingAttendee[]
}
```

**Migration Strategy:**
1. Add `attendees` relation to Meeting model
2. Create MeetingAttendee table
3. Make `skillId` nullable
4. Backfill: For existing skill meetings, optionally create MeetingAttendee records for SA/SCM
5. Update skill relation to optional

---

### Access Control Integration

**New Permission Patterns:**

Location: `src\lib\permissions.ts` (extend existing)

```typescript
export function canScheduleManagementMeeting(user: UserAccessContext): boolean {
  // Only admins and secretariat can schedule management meetings
  return user.isAdmin || user.role === Role.Secretariat;
}

export function canViewMeeting(
  user: UserAccessContext,
  meeting: {
    skillId: string | null;
    skill?: SkillAccessContext;
    attendeeUserIds?: string[];
  }
): boolean {
  // Skill meetings: existing skill permission check
  if (meeting.skillId && meeting.skill) {
    return canViewSkill(user, meeting.skill);
  }

  // Management meetings: check if user is attendee
  if (meeting.attendeeUserIds) {
    return meeting.attendeeUserIds.includes(user.id);
  }

  // Admin and secretariat can view all meetings
  return user.isAdmin || user.role === Role.Secretariat;
}

export function canManageMeeting(
  user: UserAccessContext,
  meeting: {
    skillId: string | null;
    skill?: SkillAccessContext;
    attendeeUserIds?: string[];
  }
): boolean {
  // Skill meetings: existing skill permission check
  if (meeting.skillId && meeting.skill) {
    return canManageSkill(user, meeting.skill);
  }

  // Management meetings: admin/secretariat only
  return user.isAdmin || user.role === Role.Secretariat;
}
```

**Integration Points:**
- Extends existing `canManageSkill()` and `canViewSkill()` patterns
- Maintains backward compatibility with skill meetings
- Clear separation of concerns: skill-based vs attendee-based access

---

### Backend Actions/API Changes

**Modified Meeting Actions:**

Location: `src\app\(dashboard)\skills\[skillId]\meeting-actions.ts` → **Move to context-agnostic location**

New location suggestion: `src\lib\meetings\actions.ts` (to handle both skill and management meetings)

**New Action Schema:**
```typescript
const scheduleMeetingSchema = z.object({
  skillId: z.string().min(1).optional(), // MADE OPTIONAL
  title: z.string().min(2),
  startTime: z.string(),
  endTime: z.string(),
  meetingLink: z.string().url().optional().or(z.literal("")),
  attendeeUserIds: z.array(z.string()).optional(), // NEW: for management meetings
  initialLinks: z.string().optional(),
  initialDocuments: z.string().optional(),
});
```

**Modified scheduleMeetingAction():**
```typescript
export async function scheduleMeetingAction(formData: FormData) {
  const user = await requireUser();
  const parsed = scheduleMeetingSchema.safeParse({ /* ... */ });

  // Validate permissions based on meeting type
  if (parsed.data.skillId) {
    // Skill meeting: existing permission check
    const skill = await ensureSkill(parsed.data.skillId);
    if (!canScheduleMeeting(user, skill)) {
      throw new Error("No permission for skill meeting");
    }
  } else {
    // Management meeting: new permission check
    if (!canScheduleManagementMeeting(user)) {
      throw new Error("No permission for management meeting");
    }
  }

  // Create meeting
  const meeting = await prisma.meeting.create({
    data: {
      skillId: parsed.data.skillId ?? null,
      title: parsed.data.title,
      startTime,
      endTime,
      meetingLink: parsed.data.meetingLink || null,
      documents: serialiseMeetingDocuments(initialDocuments),
      links: serialiseMeetingLinks(initialLinks),
    },
  });

  // Create attendee records for management meetings
  if (!parsed.data.skillId && parsed.data.attendeeUserIds?.length) {
    await prisma.meetingAttendee.createMany({
      data: parsed.data.attendeeUserIds.map(userId => ({
        meetingId: meeting.id,
        userId,
      })),
    });
  }

  // Send invitations
  const recipientEmails = await getRecipientEmails(meeting.id);
  if (recipientEmails.length > 0) {
    await sendMeetingInvitation({
      to: recipientEmails,
      meeting: {
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        meetingLink: meeting.meetingLink,
        skillName: skill?.name ?? "Management Meeting",
      },
    });
  }

  revalidatePath('/hub/meetings');
  return { success: true, meetingId: meeting.id };
}

async function getRecipientEmails(meetingId: string): Promise<string[]> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      skill: { include: { sa: true, scm: true } },
      attendees: { include: { user: true } },
    },
  });

  if (!meeting) return [];

  const emails: string[] = [];

  // Skill meeting: SA and SCM
  if (meeting.skill) {
    if (meeting.skill.sa?.email) emails.push(meeting.skill.sa.email);
    if (meeting.skill.scm?.email) emails.push(meeting.skill.scm.email);
  }

  // Management meeting: all attendees
  if (meeting.attendees) {
    meeting.attendees.forEach(attendee => {
      if (attendee.user.email) emails.push(attendee.user.email);
    });
  }

  return [...new Set(emails)]; // Deduplicate
}
```

**API Route Changes:**

Location: `src\app\api\meetings\[meetingId]\documents\upload\route.ts`

Changes needed:
- Handle `skillId` being null
- Storage key pattern: `meetings/management/{meetingId}/{file}` vs `meetings/{skillId}/{meetingId}/{file}`
- Permission check: Use new `canManageMeeting()` helper

---

### UI Component Integration

**Hub Meetings Page Enhancement:**

Location: `src\app\(dashboard)\hub\meetings\page.tsx`

Changes needed:
```typescript
// Query both skill meetings and management meetings user attends
const skills = await prisma.skill.findMany({ /* existing */ });
const skillIds = skills.map(s => s.id);

const skillMeetings = await prisma.meeting.findMany({
  where: { skillId: { in: skillIds } },
  include: { skill: { select: { name: true } } },
});

const managementMeetings = await prisma.meeting.findMany({
  where: {
    skillId: null,
    attendees: { some: { userId: user.id } },
  },
  include: { attendees: { include: { user: true } } },
});

const allMeetings = [...skillMeetings, ...managementMeetings];
```

**Meeting List Component:**

Location: `src\app\(dashboard)\skills\[skillId]\meeting-list.tsx` → **Extract to shared component**

New location: `src\components\meetings\meeting-list.tsx`

Changes:
- Add optional `skillId` prop (null for management meetings)
- Conditionally render skill name badge
- Show attendee list for management meetings
- Adapt permission checks to meeting type

**Schedule Meeting Form:**

Extract from skill-specific component to shared form:
- New location: `src\components\meetings\schedule-meeting-form.tsx`
- Props: `skillId?: string`, `onSuccess?: () => void`
- Conditionally render:
  - Skill selector (for management meetings, hidden)
  - Attendee picker (for management meetings, shown)

**Attendee Picker Component:**

New component: `src\components\meetings\attendee-picker.tsx`
- Multi-select user picker
- Filter by role (e.g., only SA, Secretariat, Admin)
- Show selected attendees with badges

---

### Navigation and Routing

**Current Navigation:**

Hub navigation (`src\components\hub\hub-nav.tsx`):
- Meetings link: `/hub/meetings` (shows skill meetings)

**New Navigation Structure:**

Add management meetings to dashboard navigation for Secretariat/Admin:

Location: `src\app\(dashboard)\layout.tsx`

```typescript
const navItems: { href: string; label: string }[] = [];

// ... existing items

if (user.isAdmin || user.role === Role.Secretariat) {
  navItems.push({ href: "/dashboard", label: "Dashboard" });
  navItems.push({ href: "/management-meetings", label: "Management Meetings" }); // NEW
}
```

**New Page Routes:**

1. Management meetings list: `src\app\(dashboard)\management-meetings\page.tsx`
2. Individual management meeting: `src\app\(dashboard)\management-meetings\[meetingId]\page.tsx` (optional, could reuse hub detail view)

**Hub Meetings Page:**

Keep existing at `/hub/meetings` - shows skill meetings + management meetings user attends

**Unified vs Separate Views:**

Recommendation: **Unified view** in `/hub/meetings` for all users, **separate management page** for admins/secretariat to create management meetings.

---

## Data Flow Changes

### Current Flow (Skill Meetings)
1. SA/SCM navigates to skill workspace
2. Clicks "Schedule Meeting" in meeting-list.tsx
3. Form appears with skill context pre-filled
4. Submits → `scheduleMeetingAction(skillId)` creates meeting
5. Email sent to skill SA + SCM
6. Meeting appears in hub filtered by skill membership

### New Flow (Management Meetings)
1. Admin/Secretariat navigates to `/management-meetings`
2. Clicks "Schedule Meeting"
3. Form appears with attendee picker
4. Selects attendees (SA, Secretariat, etc.)
5. Submits → `scheduleMeetingAction(attendeeUserIds)` creates meeting
6. Creates `MeetingAttendee` records
7. Email sent to all attendees
8. Meeting appears in hub for all attendees

### Unified Hub View Flow
1. User navigates to `/hub/meetings`
2. Query fetches:
   - Skill meetings (via skill membership)
   - Management meetings (via MeetingAttendee)
3. Display combined list with type badges
4. Click meeting → show details (same component, conditional fields)

---

## Integration Points Summary

### 1. Database Layer
- **What:** Prisma schema changes
- **Impact:** Migration required, affects all meeting queries
- **Dependencies:** None (foundational change)
- **Build order:** First

### 2. Permission Layer
- **What:** New permission helpers in `src\lib\permissions.ts`
- **Impact:** Used by all meeting actions and API routes
- **Dependencies:** Database schema
- **Build order:** Second

### 3. Backend Actions
- **What:** Modify `meeting-actions.ts`, move to shared location
- **Impact:** All meeting creation/update flows
- **Dependencies:** Database schema, permission layer
- **Build order:** Third

### 4. API Routes
- **What:** Update document upload route, add attendee endpoints
- **Impact:** Document storage paths, permission checks
- **Dependencies:** Backend actions
- **Build order:** Fourth (parallel with UI)

### 5. UI Components
- **What:** Extract shared meeting components, add attendee picker
- **Impact:** Skill workspace, hub meetings page
- **Dependencies:** Backend actions (API contracts)
- **Build order:** Fourth (parallel with API)

### 6. Navigation
- **What:** Add management meetings link to dashboard nav
- **Impact:** Layout, routing
- **Dependencies:** UI components
- **Build order:** Fifth (final)

---

## New vs Modified Components

### New Components

1. **Database:**
   - `MeetingAttendee` model
   - `User.meetingAttendances` relation

2. **Permissions:**
   - `canScheduleManagementMeeting()`
   - `canViewMeeting()`
   - `canManageMeeting()`

3. **UI:**
   - `src\components\meetings\attendee-picker.tsx`
   - `src\app\(dashboard)\management-meetings\page.tsx`

4. **Actions:**
   - `addMeetingAttendeeAction()`
   - `removeMeetingAttendeeAction()`

### Modified Components

1. **Database:**
   - `Meeting.skillId` → optional
   - `Meeting.skill` → optional relation
   - Add `Meeting.attendees` relation

2. **Permissions:**
   - Existing `canManageSkill()` logic called conditionally

3. **Backend:**
   - `scheduleMeetingAction()` - handle optional skillId + attendees
   - `updateMeetingMinutesAction()` - use new permission check
   - `deleteMeetingAction()` - use new permission check

4. **API:**
   - `src\app\api\meetings\[meetingId]\documents\upload\route.ts` - storage path logic

5. **UI:**
   - `src\app\(dashboard)\hub\meetings\page.tsx` - query management meetings
   - `src\app\(dashboard)\skills\[skillId]\meeting-list.tsx` → extract to `src\components\meetings\meeting-list.tsx`
   - Schedule meeting form → extract to shared component

6. **Email:**
   - `sendMeetingInvitation()` - already flexible, just pass attendee emails

7. **Navigation:**
   - `src\app\(dashboard)\layout.tsx` - add management meetings link

---

## Build Order & Phasing

### Phase 1: Database Foundation
**Goal:** Enable optional skill meetings in schema

Tasks:
1. Create migration adding `MeetingAttendee` table
2. Add `User.meetingAttendances` relation
3. Make `Meeting.skillId` nullable
4. Make `Meeting.skill` optional relation
5. Run migration on dev database
6. Verify no breaking changes to existing skill meetings

**Dependencies:** None
**Risk:** Low (backward compatible, existing meetings unaffected)

### Phase 2: Permission Layer
**Goal:** Access control for both meeting types

Tasks:
1. Add `canScheduleManagementMeeting()` to `src\lib\permissions.ts`
2. Add `canViewMeeting()` with skill/attendee logic
3. Add `canManageMeeting()` with skill/attendee logic
4. Write unit tests for permission functions

**Dependencies:** Phase 1 (schema)
**Risk:** Low (pure functions, testable)

### Phase 3: Backend Actions & API
**Goal:** Support creating/managing both meeting types

Tasks:
1. Move `meeting-actions.ts` to `src\lib\meetings\actions.ts`
2. Update `scheduleMeetingAction()` to handle optional skillId
3. Add attendee creation logic
4. Update permission checks in all actions
5. Modify document upload API route for null skillId
6. Add `getRecipientEmails()` helper
7. Test with both meeting types

**Dependencies:** Phase 2 (permissions)
**Risk:** Medium (requires careful testing of both paths)

### Phase 4: UI Components
**Goal:** User interface for management meetings

Tasks:
1. Extract `meeting-list.tsx` to shared component
2. Create `attendee-picker.tsx` component
3. Extract schedule meeting form to shared component
4. Update hub meetings page to query both types
5. Add conditional rendering for meeting type
6. Test form submissions

**Dependencies:** Phase 3 (backend)
**Risk:** Medium (UI state management, form validation)

### Phase 5: Navigation & Polish
**Goal:** Complete user journey

Tasks:
1. Add `/management-meetings` page
2. Add navigation link for admin/secretariat
3. Update hub meetings to show unified view
4. Add meeting type badges in UI
5. Test end-to-end flow
6. Update user documentation

**Dependencies:** Phase 4 (UI)
**Risk:** Low (cosmetic, no logic changes)

---

## Risk Assessment

### Low Risk
- Database schema changes (backward compatible)
- Permission helpers (pure functions)
- Email service (already flexible)
- Navigation additions (additive)

### Medium Risk
- Backend action refactoring (move files, change logic)
- UI component extraction (breaking changes in imports)
- Document storage paths (need migration plan for existing files)

### High Risk
- None identified

### Mitigation Strategies
1. **Backward Compatibility:** Existing skill meetings continue to work unchanged
2. **Incremental Testing:** Test each phase independently
3. **Feature Flag:** Consider adding `enableManagementMeetings` flag for gradual rollout
4. **Data Migration:** No data migration needed (new feature, no existing management meetings)

---

## Technical Decisions

### Decision 1: Optional skillId vs Meeting Type Enum

**Options:**
- A) Make `skillId` optional (chosen)
- B) Add `type` enum field (`SKILL | MANAGEMENT`)

**Rationale:**
- Optional `skillId` is simpler and more extensible
- Type can be inferred: `meeting.skillId ? 'SKILL' : 'MANAGEMENT'`
- Avoids redundant data (skillId + type both set)

### Decision 2: Attendee Storage

**Options:**
- A) Junction table `MeetingAttendee` (chosen)
- B) JSON array in `Meeting.attendeeIds`

**Rationale:**
- Junction table enables proper relations and cascading deletes
- Easier to query "meetings for user" via relation
- Consistent with existing `SkillMember` pattern
- Better for future features (RSVP status, attendance tracking)

### Decision 3: Permission Model

**Options:**
- A) Extend existing `canManageSkill()` (chosen)
- B) Create separate permission system for meetings

**Rationale:**
- Reuses existing patterns for consistency
- Skill meetings retain original access control
- Management meetings get admin/secretariat-only control
- Clear separation via null check

### Decision 4: Email Recipients

**Options:**
- A) Always send to all attendees (chosen)
- B) Let creator select who receives invite

**Rationale:**
- Simplicity: all attendees should be notified
- Consistent with skill meeting behavior (auto-notify SA/SCM)
- Can add "opt-out" feature later if needed

---

## Open Questions for Product Owner

1. **Attendee Selection Constraints:**
   - Should management meetings be restricted to certain roles only?
   - Or can any user be invited?
   - Recommendation: Start with admin/secretariat/SA only

2. **Visibility:**
   - Should management meetings be visible to all admins, or only attendees?
   - Current proposal: Only attendees + admins can view
   - Recommendation: Attendees-only unless admin flag set

3. **Skill Meeting Backward Compatibility:**
   - Should we backfill `MeetingAttendee` records for existing skill meetings?
   - Or leave them as skill-based only?
   - Recommendation: Leave existing meetings as-is (skill-based)

4. **Document Storage Migration:**
   - Existing path: `meetings/{skillId}/{meetingId}/{file}`
   - Management path: `meetings/management/{meetingId}/{file}`
   - Is this acceptable or should we use meeting type consistently?
   - Recommendation: Use meeting type prefix for clarity

5. **Calendar Integration:**
   - Should management meetings sync to a shared calendar?
   - Or remain email-only invitations?
   - Recommendation: Keep existing .ics attachment approach

---

## Success Criteria

**Architecture Integration:**
- [x] Database schema supports optional skill relationships
- [x] Permission layer handles both meeting types
- [x] Backend actions work for skill and management meetings
- [x] Email service adapts to attendee lists

**Backward Compatibility:**
- [x] Existing skill meetings continue to function
- [x] No breaking changes to skill workspace
- [x] Skill meeting permissions unchanged

**New Functionality:**
- [x] Admin/Secretariat can create management meetings
- [x] Attendees can be selected per meeting
- [x] Invitations sent to selected attendees
- [x] Management meetings appear in user's hub

**Build Order:**
- [x] Dependencies clearly mapped
- [x] Phases are logically sequenced
- [x] Each phase has clear entry/exit criteria

---

## Conclusion

Management meetings integrate cleanly into the existing architecture with minimal friction. The key pattern—making `skillId` optional and introducing `MeetingAttendee`—preserves backward compatibility while enabling selective attendance. The existing permission, email, and UI patterns extend naturally to support both meeting types.

**Recommended Next Steps:**
1. Review this architecture with stakeholders
2. Create database migration (Phase 1)
3. Implement permission helpers (Phase 2)
4. Build backend actions in parallel with UI components (Phases 3-4)
5. Add navigation and polish (Phase 5)

**Estimated Effort:**
- Phase 1: 2 hours (migration + testing)
- Phase 2: 3 hours (permission helpers + tests)
- Phase 3: 6 hours (backend refactor + API updates)
- Phase 4: 8 hours (UI components + forms)
- Phase 5: 3 hours (navigation + documentation)
- **Total: ~22 hours** (roughly 3 days)

---

*Architecture research completed: 2026-02-01*

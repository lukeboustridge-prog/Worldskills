# Project Research Summary

**Project:** Management Meetings Feature
**Domain:** Collaboration/Meeting Management Extension
**Researched:** 2026-02-01
**Confidence:** HIGH

## Executive Summary

The management meetings feature is a **data model extension**, not a technology stack change. The existing Next.js/Prisma architecture fully supports the requirements with zero new dependencies. The core technical change is making the `Meeting.skillId` foreign key optional and introducing a `MeetingAttendee` junction table for selective attendance.

This is a low-risk, well-understood pattern. The primary challenge is maintaining backward compatibility across database, permission, email, and UI layers while introducing optional skill relationships. The existing skill meeting infrastructure (email/calendar invitations, document storage, UI components) is already abstracted and reusable.

The critical risk is NULL reference errors in production when rendering management meetings without proper null checks. This is mitigated by a phased build order: database foundation first, then permission/business logic updates, then UI integration with comprehensive null handling. Total implementation effort is estimated at 22-34 hours across four distinct phases.

## Key Findings

### Recommended Stack

**NO NEW DEPENDENCIES REQUIRED.** The existing stack (Next.js 14.2.10, Prisma 5.20.0, NextAuth 4.24.7, Resend 4.0.0, AWS SDK v3) handles all requirements. All capabilities needed for management meetings—email, calendar invites, file storage, role-based authorization—are already implemented and properly abstracted from business logic.

**Core technologies (existing):**
- **Prisma ORM 5.20.0**: JSON fields for flexible data (attendees, documents), native support for optional foreign keys
- **Resend 4.0.0**: Multi-recipient email, ICS calendar file generation, already supports variable recipient lists
- **AWS SDK v3**: Presigned URL generation for document uploads/downloads, S3 storage abstracted via `src\lib\storage.ts`
- **NextAuth 4.24.7**: Role-based access control, Secretariat role already exists in schema
- **date-fns 3.6.0**: Date formatting for calendar generation

**Required changes:**
- Database: Add `MeetingAttendee` model, make `Meeting.skillId` nullable
- Permissions: Extend `src\lib\permissions.ts` with management meeting helpers
- Email: Make `skillName` optional in `sendMeetingInvitation()` interface
- UI: Add null checks for `meeting.skill` access, visual badges for meeting type distinction

### Expected Features

**Must have (table stakes):**
- **Non-entity meeting creation** — meetings not tied to a specific skill (LOW complexity)
- **Role-based universal visibility** — all SAs see all management meetings (MEDIUM complexity)
- **Selective attendance lists** — per-meeting selection of Secretariat members (MEDIUM complexity)
- **Permission model** — only Admin/Secretariat can create/edit management meetings (LOW complexity)
- **Visual distinction via badges** — clear UI indicators for meeting types (LOW complexity)
- **Unified meetings interface** — single page showing both skill and management meetings (MEDIUM complexity)
- **Email/calendar functionality** — reuse existing invitation infrastructure with attendee lists (MEDIUM complexity)

**Defer (v2+):**
- Smart attendee suggestions (HIGH complexity, limited value at current scale)
- Meeting series/recurring meetings (VERY HIGH complexity, explicitly scoped out)
- Meeting templates (MEDIUM complexity, consider after user feedback)
- Attendance tracking (HIGH complexity, explicitly scoped out)

**Anti-features (deliberately excluded):**
- In-app video conferencing (use external tools)
- Meeting agenda builder (free-form text sufficient)
- Multi-skill association (adds complexity without clear value)
- Meeting approval workflow (unnecessary friction)
- Automatic timezone conversion (all users in same location during CPW)
- CIS integration (future milestone per PROJECT.md)

### Architecture Approach

Management meetings integrate cleanly into existing architecture by making `skillId` optional and introducing `MeetingAttendee` for selective participation. This preserves backward compatibility while enabling role-based visibility distinct from entity-based access.

**Major components:**
1. **Database layer** — Optional `Meeting.skillId`, new `MeetingAttendee` junction table with cascade deletes
2. **Permission layer** — Extend existing patterns: skill-based (canManageSkill) vs role-based (canScheduleManagementMeeting)
3. **Email service** — Reuse `sendMeetingInvitation()` with conditional skillName, recipient list generation based on meeting type
4. **UI components** — Extract shared meeting components, add attendee picker, conditional rendering for meeting types
5. **Storage** — Use existing S3 infrastructure with different path prefix: `meetings/management/{meetingId}/` vs `meetings/{skillId}/{meetingId}/`
6. **Navigation** — Add `/management-meetings` page for Admin/Secretariat, extend `/hub/meetings` to query both types

**Integration pattern:** Conditional logic based on null check (`meeting.skillId ? skill_logic : management_logic`) throughout all layers.

### Critical Pitfalls

1. **NULL reference errors in UI** — Direct access to `meeting.skill.name` crashes when rendering management meetings. Prevention: Use optional chaining (`meeting.skill?.name ?? 'Management Meeting'`) and create `MeetingSkillBadge` component with type guards. Affects Phase 3 (UI Integration).

2. **TypeScript types not updated** — Generated Prisma types show `skill: Skill` instead of `skill: Skill | null`, causing silent runtime failures. Prevention: Run `npx prisma generate` after schema changes, enable strict null checks, add type guards (`isSkillMeeting()`), run `tsc --noEmit` before deployment. Affects Phase 1 (Foundation).

3. **Validation schemas still requiring skillId** — Zod schemas reject management meeting creation. Prevention: Update `scheduleMeetingSchema` to make skillId optional (`z.string().min(1).optional()`), add custom validation for meeting type distinction. Affects Phase 1 (Foundation).

4. **Authorization checks breaking** — `ensureSkill()` and `canScheduleMeeting()` assume skillId exists. Prevention: Split authorization into `canScheduleSkillMeeting()` and `canScheduleManagementMeeting()`, add wrapper that routes based on skillId presence. Affects Phase 2 (Core Implementation).

5. **Email templates require skillName** — `sendMeetingInvitation()` expects `meeting.skillName` property. Prevention: Make skillName optional in interface, update templates to conditionally show skill context vs "Management Meeting" label. Affects Phase 2 (Core Implementation).

6. **Visibility rules not enforced at query level** — Database queries don't respect "all SAs see management meetings" requirement. Prevention: Implement `getVisibleMeetings(user)` helper that builds correct WHERE clause based on role (SAs get skill meetings + management meetings via OR clause). Affects Phase 2 (Core Implementation).

## Implications for Roadmap

Based on research, suggested phase structure follows dependency order: database foundation, business logic updates, UI integration, deployment.

### Phase 1: Database Foundation & Type System
**Rationale:** All subsequent changes depend on schema supporting optional skillId. This must be complete and validated before business logic changes to prevent cascading type errors.

**Delivers:**
- Prisma schema with optional `Meeting.skillId` and `Meeting.skill` relation
- New `MeetingAttendee` junction table with User relation
- Database migration tested on staging with production data clone
- Updated TypeScript types reflecting optional relations
- Type guards (`isSkillMeeting()`, `isManagementMeeting()`)
- Updated Zod validation schemas

**Addresses:**
- Non-entity meeting creation (table stakes #1)
- Selective attendance lists foundation (table stakes #3)

**Avoids:**
- Pitfall 1.1: Foreign key constraint violations during migration
- Pitfall 1.2: Missing cascade delete protection
- Pitfall 2.1: TypeScript types not reflecting optional relations
- Pitfall 2.2: Validation schemas still requiring skillId

**Estimated effort:** 4-6 hours

---

### Phase 2: Permission & Business Logic Layer
**Rationale:** Business logic (authorization, email generation, activity logging) must handle both meeting types before UI can safely call these functions.

**Delivers:**
- Permission helpers: `canScheduleManagementMeeting()`, `canViewMeeting()`, `canManageMeeting()`
- Updated `scheduleMeetingAction()` handling optional skillId + attendee creation
- Email service updates: optional skillName, recipient list generation by meeting type
- Visibility query helper: `getVisibleMeetings(user)` with role-based filtering
- Activity logging support for optional skillId
- Calendar generation (Google links, ICS files) with conditional skill context

**Addresses:**
- Permission model (table stakes #4)
- Role-based universal visibility (table stakes #2)
- Email/calendar functionality (table stakes #7)

**Avoids:**
- Pitfall 3.1: Authorization checks breaking without skillId
- Pitfall 3.2: Activity logging assumes skillId exists
- Pitfall 4.1: Email templates require skillName
- Pitfall 4.3: Recipient list generation breaks
- Pitfall 6.1: Visibility rules not enforced at query level

**Estimated effort:** 10-11 hours

---

### Phase 3: UI Integration & Components
**Rationale:** With backend ready, UI can safely render both meeting types. Comprehensive null checks prevent production crashes.

**Delivers:**
- Meeting list components with null checks (`meeting.skill?.name`)
- `MeetingSkillBadge` component for visual distinction
- Attendee picker component for Secretariat selection
- Updated hub meetings page querying both skill + management meetings
- Create management meeting form/dialog for Admin/Secretariat
- `/management-meetings` page route
- Filtering and sorting logic supporting both meeting types
- Navigation link addition for Admin/Secretariat roles

**Addresses:**
- Visual distinction via badges (table stakes #5)
- Unified meetings interface (table stakes #6)
- Selective attendance lists (table stakes #3 completion)

**Avoids:**
- Pitfall 5.1: NULL reference errors in meeting lists
- Pitfall 5.2: Skill-specific meeting routes break
- Pitfall 5.3: Meeting forms can't handle missing skill context
- Pitfall 5.4: Filtering and sorting logic breaks
- Pitfall 6.2: Meeting actions available to wrong users

**Estimated effort:** 8-12 hours

---

### Phase 4: Deployment & Validation
**Rationale:** Critical event context (CPW) requires careful deployment timing and validation to avoid downtime during peak usage.

**Delivers:**
- Staging deployment with production data clone testing
- Post-migration validation script checking data consistency
- Feature flag (`ENABLE_MANAGEMENT_MEETINGS`) for gradual rollout
- Rollback plan and procedure documentation
- User notification of new feature
- Production deployment during off-hours (NOT during CPW active hours)
- Error monitoring and validation

**Avoids:**
- Pitfall 7.1: Deploying during CPW peak usage
- Pitfall 7.2: Existing data not validated after migration
- Pitfall 7.3: No rollback plan for feature

**Estimated effort:** 3-5 hours

---

### Phase Ordering Rationale

**Why database first:** Optional foreign keys affect generated TypeScript types, validation schemas, and every query. Any business logic written before schema changes would immediately break upon migration.

**Why permissions before UI:** UI components call authorization helpers (`canEditMeeting()`). If UI renders before permissions updated, buttons appear for wrong users or clicks trigger authorization errors.

**Why separate deployment phase:** CPW environment requires zero-downtime deployments. Schema migrations during active competition hours risk data loss or user lockout. Feature flag enables safe rollout with instant rollback.

**Dependency chain:** Database → TypeScript types → Validation schemas → Business logic → Email service → UI components → Deployment. Each depends on previous layer being complete.

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Database schema changes are well-documented in Prisma docs, optional foreign keys are standard SQL
- **Phase 2:** Permission patterns already established in codebase (`src\lib\permissions.ts`), extending existing model
- **Phase 3:** UI component patterns already exist for skill meetings, reuse with conditional logic
- **Phase 4:** Deployment procedures documented in operations guides

**No phases need deeper research during planning.** All patterns are established, existing infrastructure is reusable, and integration points are well-understood. The feature is a straightforward extension of existing capabilities.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All required capabilities already implemented and validated in production. Zero new dependencies. Source: existing codebase analysis. |
| Features | HIGH | Requirements clear from PROJECT.md, industry patterns well-established (Google Calendar, Slack, Teams). Table stakes vs differentiators categorized. Source: FEATURES.md research. |
| Architecture | HIGH | Integration pattern proven (optional foreign keys), existing abstractions support both meeting types. Build order logically sequenced. Source: ARCHITECTURE.md analysis. |
| Pitfalls | HIGH | Critical pitfalls identified through codebase analysis, all have prevention strategies. Phasing avoids cascading failures. Source: PITFALLS.md research. |

**Overall confidence:** HIGH

### Gaps to Address

**No significant gaps identified.** Research is comprehensive across all dimensions:

- **Stack:** Existing codebase provides complete picture of capabilities
- **Features:** Industry patterns for meeting management are well-established
- **Architecture:** Current implementation details are accessible
- **Pitfalls:** Codebase analysis reveals all integration points requiring changes

**Minor validation during implementation:**
- Confirm Secretariat role enum value in production database matches schema
- Verify S3 bucket permissions allow `management-meetings/` prefix
- Test email delivery to large recipient lists (all SAs) doesn't hit rate limits
- Validate partial index performance on PostgreSQL version in production

These are verification steps, not research gaps. All patterns and approaches are validated.

## Sources

### Primary (HIGH confidence)
- **Existing codebase** — `C:\Users\LukeBoustridge\Projects\Worldskills\src\*` (architecture patterns, existing implementations)
- **Prisma schema** — `prisma/schema.prisma` (Meeting model, Role enum, User relations)
- **Email infrastructure** — `src\lib\email\meeting-invitation.ts` (calendar generation, multi-recipient support)
- **Permission patterns** — `src\lib\permissions.ts` (canManageSkill, role-based access control)
- **Storage abstraction** — `src\lib\storage.ts` (S3 presigned URLs, file operations)
- **PROJECT.md** — `.planning/PROJECT.md` (requirements, out-of-scope features)
- **Prisma documentation** — https://www.prisma.io/docs (optional foreign keys, JSON fields, cascade behavior)
- **NextAuth documentation** — https://next-auth.js.org (role-based access, session management)

### Secondary (MEDIUM confidence)
- **Industry patterns** — Google Calendar, Slack, Microsoft Teams, Asana (meeting management UX patterns)
- **Resend documentation** — https://resend.com/docs (attachment support, multi-recipient)
- **AWS SDK v3 documentation** — https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/ (presigned URL generation)

### Tertiary (LOW confidence)
- None — all research based on primary sources (existing code) and official documentation

---
*Research completed: 2026-02-01*
*Ready for roadmap: yes*

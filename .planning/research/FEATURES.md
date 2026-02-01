# Management Meeting Features Research

**Research Type:** Project Research — Features dimension for management meetings
**Date:** 2026-02-01
**Context:** Adding management/coordination meetings to existing WorldSkills Competition Management System

---

## Executive Summary

Management meetings in team collaboration systems require different access patterns than entity-bound meetings. Key distinctions:

- **Visibility scope**: Role-based (all SAs) vs entity-based (skill team)
- **Selective attendance**: Dynamic participant lists vs fixed team membership
- **Visual distinction**: Clear UI differentiation to prevent confusion
- **Permission model**: Creation restricted to coordinators (Secretariat/Admin) vs team managers (SA/SCM)

**Recommendation**: Extend existing Meeting model with optional `skillId` and add `attendees` relation for selective participation, leveraging existing email/calendar infrastructure.

---

## Table Stakes Features

### 1. Non-Entity Meeting Creation
**What**: Meetings not tied to a specific skill
**Why**: Coordination meetings span multiple skills or address organizational topics
**Complexity**: LOW - Make `skillId` optional in existing Meeting model
**Dependencies**: Existing Meeting model, database migration

**Expected Behavior**:
- Admin and Secretariat can create meetings without selecting a skill
- System validates either `skillId` is null (management meeting) or exists (skill meeting)
- Same rich fields as skill meetings: title, time, meetingLink, minutes, actionPoints, documents, links

**Industry Pattern**: Slack channels (workspace-level vs channel-level), Microsoft Teams (org-wide vs team meetings), Asana (portfolio vs project meetings)

---

### 2. Role-Based Universal Visibility
**What**: All users with specific role(s) see all management meetings
**Why**: Coordination requires all Skill Advisors to be informed
**Complexity**: MEDIUM - Query logic changes for meeting list
**Dependencies**: Existing role system (Role.SA)

**Expected Behavior**:
- All SAs see all management meetings in their meetings list
- Skill-specific meetings still filtered by team membership
- Combined view shows both types without confusion
- No permission checks needed for viewing management meetings as SA

**Industry Pattern**: Confluence space permissions, GitHub org-level discussions, Monday.com board sharing by role

---

### 3. Selective Attendance Lists
**What**: Per-meeting selection of which Secretariat members attend
**Why**: Not all administrative staff need to attend every coordination meeting
**Complexity**: MEDIUM - New many-to-many relation for meeting attendees
**Dependencies**: User model, Meeting model

**Expected Behavior**:
- When creating management meeting, Admin/Secretariat can select attendees from User table
- Selected Secretariat members receive calendar invites (reuse existing email infrastructure)
- Attendees see meeting in their meetings list
- Non-attendee Secretariat don't see meetings they weren't invited to
- SAs always see all management meetings regardless of attendee list

**Industry Pattern**: Google Calendar event attendees, Outlook meeting invitations, Calendly selective invitations

---

### 4. Permission Model for Management Meetings
**What**: Only Admin and Secretariat can create/edit management meetings
**Why**: Organizational coordination controlled by administrative roles
**Complexity**: LOW - Extend existing permission checks
**Dependencies**: getCurrentUser(), role checks

**Expected Behavior**:
- SAs can view all management meetings but cannot create/edit them
- SAs can create/edit their own skill meetings (existing behavior preserved)
- Secretariat can create/edit management meetings
- Admin has full control over all meetings (existing behavior)
- Clear UI: "Schedule Management Meeting" button only visible to Secretariat/Admin

**Industry Pattern**: Workspace admin privileges (Slack, Teams), org-level meeting scheduling (Google Workspace), board admin controls (Trello)

---

### 5. Visual Distinction via Badges
**What**: Clear UI indicators differentiating meeting types
**Why**: Prevent confusion when both types appear in same list
**Complexity**: LOW - Add Badge components with conditional rendering
**Dependencies**: Existing Badge component, meeting.skillId check

**Expected Behavior**:
- Skill meetings show badge: "Skill Meeting" or skill name
- Management meetings show badge: "Skill Advisor Meeting" or "Management"
- Color coding: skill meetings use one color scheme, management another
- Hub meetings page displays both types with clear visual separation
- Badge appears in meeting cards, countdown components, and detail views

**Industry Pattern**: Gmail labels, Slack message tags, Asana project tags, Notion database properties

---

### 6. Unified Meetings Interface
**What**: Single meetings page showing both skill and management meetings
**Why**: Reduce cognitive load, all meetings in one place
**Complexity**: MEDIUM - Extend query logic to union two meeting types
**Dependencies**: Hub meetings page, meeting list components

**Expected Behavior**:
- `/hub/meetings` page shows both upcoming and past meetings for both types
- Meetings sorted chronologically regardless of type
- Filter options: "All", "Skill Meetings", "Management Meetings"
- Next meeting countdown works for both types
- Meeting detail expansion works identically for both types

**Industry Pattern**: Unified inbox (Gmail, Outlook), combined calendar views (Google Calendar), all-tasks views (Todoist, Things)

---

### 7. Preserve Email/Calendar Functionality
**What**: Reuse existing meeting invitation infrastructure
**Why**: Users expect calendar invites, already validated and working
**Complexity**: MEDIUM - Extend recipient list logic for attendees
**Dependencies**: sendMeetingInvitation(), Resend API, ICS generation

**Expected Behavior**:
- Management meetings generate .ics calendar files (existing)
- Email invitations sent to selected attendees + all SAs
- Email templates include meeting type badge/indicator
- Google Calendar links work identically (existing generateGoogleCalendarLink)
- Cancellation/update emails if meeting edited (future enhancement)

**Industry Pattern**: Every collaboration tool with meetings (Teams, Zoom, Webex, Google Meet)

---

## Differentiator Features

### 8. Smart Attendee Suggestions
**What**: Auto-suggest Secretariat members based on meeting patterns
**Why**: Reduce admin overhead, learn from past attendance
**Complexity**: HIGH - Requires attendee history analysis
**Dependencies**: Meeting history, attendee data

**Expected Behavior**:
- When creating management meeting, system suggests Secretariat members
- Suggestions based on: recent attendees, topic keywords, time patterns
- Quick-select buttons: "Usual attendees", "Full secretariat", "Custom"
- Admin can override suggestions freely

**Industry Pattern**: Outlook attendee suggestions, Google Calendar smart scheduling, Calendly team routing

**Risk**: Over-engineering for current scale (small Secretariat team)
**Recommendation**: DEFER until user feedback indicates need

---

### 9. Meeting Series/Recurring Meetings
**What**: Create multiple meetings with recurring schedule
**Why**: Weekly SA coordination meetings, daily CPW standups
**Complexity**: VERY HIGH - Requires series management, update propagation
**Dependencies**: Meeting model restructure, complex update logic

**Expected Behavior**:
- Create series with recurrence rule (daily, weekly, custom)
- Edit single instance vs edit series options
- Attendee changes propagate to future meetings
- Cancellation of single instance vs entire series

**Industry Pattern**: Google Calendar recurring events, Outlook series, Zoom recurring meetings

**Risk**: Adds significant complexity, active requirement explicitly scoped out
**Recommendation**: EXCLUDE from current milestone (per PROJECT.md)

---

### 10. Meeting Templates
**What**: Pre-configured meeting templates for common coordination scenarios
**Why**: Faster meeting creation, consistency across similar meetings
**Complexity**: MEDIUM - Template storage, application logic
**Dependencies**: Meeting model, template data structure

**Expected Behavior**:
- Templates for: "Daily SA Standup", "Weekly Coordination", "CCD Briefing"
- Template includes: default title format, duration, attendee presets
- Admin can create/edit templates
- One-click meeting creation from template

**Industry Pattern**: Zoom meeting templates, Notion templates, email templates

**Risk**: Limited template variety needed for current use cases
**Recommendation**: CONSIDER for future iteration if users request

---

### 11. Attendance Tracking
**What**: Record who actually attended vs who was invited
**Why**: Accountability, meeting effectiveness metrics
**Complexity**: HIGH - Requires check-in mechanism, attendance recording
**Dependencies**: Meeting model extension, UI for check-in

**Expected Behavior**:
- Organizer marks attendees present/absent after meeting
- Attendance percentages in meeting history
- Reports on attendance patterns

**Industry Pattern**: Zoom attendance reports, Teams meeting attendance, Eventbrite check-ins

**Risk**: Explicitly scoped out (per PROJECT.md)
**Recommendation**: EXCLUDE from current milestone

---

## Anti-Features

### 12. In-App Video Conferencing
**What**: Built-in video calling within the application
**Why NOT**: External tools (Teams, Zoom) already used, integration overhead high
**Complexity**: EXTREMELY HIGH - Real-time communication infrastructure

**Rationale for Exclusion**:
- Users already have preferred video tools
- meetingLink field supports any external service
- Building video infrastructure diverts from core value
- Maintenance burden significant

**Industry Context**: Most project management tools (Asana, Monday.com, Jira) integrate rather than build video

---

### 13. Meeting Agenda Builder
**What**: Structured agenda creation with time-boxed sections
**Why NOT**: Minutes/description fields sufficient, adds complexity without clear value
**Complexity**: MEDIUM - Structured data model, agenda UI

**Rationale for Exclusion**:
- Current users use minutes field for agendas
- Free-form text more flexible for varied meeting types
- Structured agendas add cognitive overhead
- Explicitly scoped out (per PROJECT.md)

**Industry Context**: Tools like Fellow.app specialize in this, but general collaboration tools avoid it

---

### 14. Multi-Skill Association
**What**: Single management meeting associated with multiple skills
**Why NOT**: Adds query complexity, unclear UI presentation
**Complexity**: HIGH - Many-to-many skill-meeting relation, permission implications

**Rationale for Exclusion**:
- Management meetings are inherently cross-skill (no skill association)
- Many-to-many relation adds database complexity
- Filtering/display logic becomes ambiguous
- Current design cleaner: null skillId = all skills

**Industry Context**: Most systems use hierarchical rather than many-to-many for meetings

---

### 15. Meeting Approval Workflow
**What**: Management meetings require approval before being scheduled
**Why NOT**: No business need, slows coordination
**Complexity**: HIGH - Approval state machine, notifications

**Rationale for Exclusion**:
- Secretariat/Admin trusted to schedule appropriately
- CPW environment requires rapid scheduling
- Approval adds delay without clear benefit
- No user request for this feature

**Industry Context**: Approval workflows common in enterprise (SAP, Oracle) but rare in collaboration tools

---

### 16. Automatic Timezone Conversion
**What**: Display meeting times in each attendee's local timezone
**Why NOT**: All users in same timezone during CPW, UTC sufficient
**Complexity**: MEDIUM - Timezone storage per user, display logic

**Rationale for Exclusion**:
- Competition in single location (Lyon 2026)
- Current system uses UTC consistently
- Timezone bugs are common and hard to fix
- Users can convert times if needed

**Industry Context**: Global tools (Calendly, Doodle) need this, local-focused tools skip it

---

### 17. Integration with CIS (Competition Information System)
**What**: Sync meetings with external CIS system
**Why NOT**: Explicitly scoped out, integration complexity high
**Complexity**: VERY HIGH - External API integration, sync logic, conflict resolution

**Rationale for Exclusion**:
- Per PROJECT.md: "CIS integration beyond external links — future milestone"
- External links already supported via meetingLink and links fields
- Two-way sync introduces data consistency challenges
- No API documentation available for CIS

**Industry Context**: Integrations are valuable but should be milestone-specific

---

## Feature Dependencies Map

```
Core Infrastructure (Existing)
├── Meeting model (skillId, title, startTime, endTime, meetingLink, minutes, actionPoints, documents, links)
├── sendMeetingInvitation() email infrastructure
├── Role-based access control (Role.SA, Role.Secretariat, Role.Admin)
└── getCurrentUser() authentication

Table Stakes (This Milestone)
├── [1] Non-Entity Creation ──┬──> [6] Unified Interface
├── [2] Role-Based Visibility ─┤
├── [3] Selective Attendance ──┼──> [7] Preserve Email/Calendar
├── [4] Permission Model ──────┤
└── [5] Visual Distinction ────┘

Differentiators (Future Consideration)
├── [8] Smart Attendee Suggestions (depends on [3])
├── [9] Recurring Meetings (HIGH complexity, excluded)
├── [10] Meeting Templates (depends on [1], [3])
└── [11] Attendance Tracking (explicitly excluded)

Anti-Features (Deliberately Excluded)
├── [12] In-App Video (use external tools)
├── [13] Agenda Builder (scope creep)
├── [14] Multi-Skill Association (overcomplicated)
├── [15] Approval Workflow (unnecessary friction)
├── [16] Timezone Conversion (not needed)
└── [17] CIS Integration (future milestone)
```

---

## Implementation Complexity Assessment

| Feature | DB Changes | UI Changes | Logic Changes | Risk Level | Estimated Effort |
|---------|-----------|-----------|---------------|------------|------------------|
| [1] Non-Entity Creation | Optional skillId | Update forms | Validation logic | LOW | 2-4 hours |
| [2] Role-Based Visibility | None | Update queries | Filter logic | MEDIUM | 4-6 hours |
| [3] Selective Attendance | New attendees table | Attendee selector | Many-to-many relation | MEDIUM | 6-8 hours |
| [4] Permission Model | None | Conditional rendering | Permission checks | LOW | 2-3 hours |
| [5] Visual Distinction | None | Badge components | Conditional styling | LOW | 1-2 hours |
| [6] Unified Interface | None | Page layout | Query union | MEDIUM | 4-6 hours |
| [7] Preserve Email/Calendar | None | Email template | Recipient logic | MEDIUM | 4-5 hours |

**Total Estimated Effort**: 23-34 hours (3-4 days of focused development)

---

## Quality Gate Checklist

- [x] Categories clearly defined (table stakes vs differentiators vs anti-features)
- [x] Complexity noted for each feature (LOW/MEDIUM/HIGH/VERY HIGH)
- [x] Dependencies on existing features identified (Meeting model, email infrastructure, roles)
- [x] Industry patterns cited for validation (Google Calendar, Slack, Teams, etc.)
- [x] Rationale provided for anti-features (avoid scope creep)
- [x] Implementation effort estimated
- [x] Risk assessment included (data consistency, complexity, user confusion)

---

## Research Sources

**Existing Codebase Analysis**:
- `prisma/schema.prisma` - Meeting model (skillId, title, startTime, endTime, meetingLink, minutes, actionPoints, documents, links)
- `src/app/(dashboard)/hub/meetings/page.tsx` - Current meeting list implementation
- `src/app/(dashboard)/skills/[skillId]/meeting-list.tsx` - Skill meeting UI patterns
- `src/lib/email/meeting-invitation.ts` - Calendar invite generation (ICS, Google Calendar links)
- `src/lib/permissions.ts` - Role-based access control patterns (canManageSkill, canViewSkill)
- `.planning/PROJECT.md` - Active requirements and out-of-scope features
- `.planning/codebase/ARCHITECTURE.md` - System architecture and design patterns

**Industry Best Practices**:
- Collaboration platforms: Slack, Microsoft Teams, Google Workspace
- Project management: Asana, Monday.com, Jira, Notion
- Scheduling tools: Calendly, Doodle, Outlook, Google Calendar
- Meeting-specific: Zoom, Fellow.app, Loom

---

## Recommendations for Requirements Phase

1. **Prioritize Table Stakes (1-7)**: All seven are essential for MVP, implement in order of dependencies
2. **Skip Differentiators for Now**: Features 8-11 add complexity without validated user need
3. **Document Anti-Features**: Explicitly communicate what won't be built to manage expectations
4. **Leverage Existing Infrastructure**: Reuse email/calendar system, permission model, UI components
5. **Visual Distinction Critical**: Badge system prevents user confusion when both meeting types coexist
6. **Test Selective Attendance**: Most complex feature (#3), needs thorough testing with email delivery
7. **Database Migration Strategy**: Make skillId nullable, add MeetingAttendee junction table, ensure backward compatibility

---

**Research completed**: 2026-02-01
**Next phase**: Requirements definition using this feature analysis

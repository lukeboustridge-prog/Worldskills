# WorldSkills Competition Management System

## What This Is

A web application for managing WorldSkills Competition 2026 skills, supporting Skill Advisors, Competition Managers, and Skill Teams through the competition preparation and execution cycle. The system tracks deliverables, gates, meetings, and provides a knowledge hub for resources.

## Core Value

Enable Skill Advisors and Competition Managers to coordinate effectively during CPW (Competition Preparation Workshop) and throughout the competition cycle.

## Requirements

### Validated

Existing capabilities already built and deployed:

- ✓ User authentication with email/password — existing
- ✓ Role-based access (SA, SCM, SkillTeam, Secretariat, Admin) — existing
- ✓ Skill management (create, assign SA/SCM, sector categorization) — existing
- ✓ Skill team membership (add members to skills) — existing
- ✓ Deliverable tracking with states (NotStarted, Draft, InProgress, Finalised, Uploaded, Validated) — existing
- ✓ Gate management with completion tracking — existing
- ✓ Skill-specific meetings with calendar invites and email notifications — existing
- ✓ Knowledge base with categorized resources (Guidance, Templates, Best Practice, Onboarding, Policy) — existing
- ✓ External link integration (CIS - Competition Information System) — existing
- ✓ Dashboard with skill overview and reports — existing
- ✓ Activity logging for audit trail — existing
- ✓ User invitations with expiration — existing
- ✓ File storage integration (AWS S3) — existing
- ✓ Email service integration (Resend) — existing

### Active

Current milestone - Management Meetings feature:

- [ ] Management meetings not tied to specific skills
- [ ] Management meetings visible to all Skill Advisors
- [ ] Per-meeting attendee selection for Secretariat members
- [ ] Admins and Secretariat can create/edit management meetings
- [ ] Management meetings support all fields (title, time, meeting link, minutes, action points, documents, links)
- [ ] Management meetings generate calendar invites and email notifications (preserve existing functionality)
- [ ] Visual badges distinguish "Skill Meeting" vs "Skill Advisor Meeting"
- [ ] Meetings page shows both skill meetings and management meetings together
- [ ] Skill Advisors see all management meetings + their skill team meetings
- [ ] Secretariat members see management meetings they're invited to

### Out of Scope

Features explicitly excluded from current milestone:

- Meeting attendance tracking — not needed yet, may add in future
- In-app notifications/alerts — email is sufficient for now
- Recurring meeting templates — each meeting created individually
- Meeting agenda builder — keep it simple, use description/minutes fields
- Video conferencing integration — external meeting links are sufficient
- Test Project management — future milestone
- Marking Scheme workflows — future milestone
- Issue/Dispute tracking — future milestone
- CIS integration beyond external links — future milestone

## Context

**WorldSkills Competition 2026:**
- CPW (Competition Preparation Workshop) is happening now
- Skill Advisors need coordination meetings separate from skill team meetings
- Competitions Committee Delegates (CCDs) attend daily Skill Management meetings
- System must support dynamic changes and rapid deployment during CPW

**Current System:**
- Next.js 14 full-stack application with React 18
- PostgreSQL database with Prisma ORM
- NextAuth for authentication (JWT sessions)
- Role-based access control with 5 roles: Pending, SA, SCM, SkillTeam, Secretariat
- Deployed and actively used during CPW
- Meetings already have email/calendar functionality via Resend

**User Roles:**
- **SA (Skill Advisor)**: Oversees skill competitions, supports test projects and marking schemes
- **SCM (Skill Competition Manager)**: Manages day-to-day skill operations
- **SkillTeam**: Team members assigned to specific skills
- **Secretariat**: Administrative support, can create management meetings
- **Admin**: Full system access

## Constraints

- **Tech stack**: Must use existing Next.js/Prisma/PostgreSQL stack — already deployed
- **Database migrations**: Must be backward compatible — production database in use
- **Existing meetings**: Cannot break skill meeting functionality — users depend on it
- **Email infrastructure**: Must preserve existing Resend email integration — no new email setup
- **Deployment**: Changes deployed incrementally during CPW — must be production-ready immediately

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Management meetings as separate entity vs skill meetings | Need coordination meetings not tied to specific skills, different visibility rules | — Pending |
| Per-meeting attendee selection for Secretariat | Not all Secretariat need to attend every meeting, flexibility required | — Pending |
| Same meetings interface for both types | Reduce complexity, SAs see all their meetings in one place | — Pending |
| Preserve all existing meeting functionality | Email/calendar invites already working, users expect this | — Pending |

---
*Last updated: 2026-02-01 after initialization*

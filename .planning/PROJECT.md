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

## Current Milestone: v1.0 Descriptor Library & Marking Scheme Support

**Goal:** Enable SCMs to create high-quality judgment marking schemes using a curated library of proven descriptors extracted from WSC2024 marking schemes.

**Target features:**
- Analyze 58 WSC2024 marking schemes to extract excellent descriptor examples
- Build searchable descriptor library with categorization (skill area, criterion type, performance level)
- Create marking scheme builder interface for SCMs
- Enable search, filter, and insert descriptors into marking schemes
- Support exporting marking schemes to Excel/PDF

### Active

Current milestone requirements:

- [ ] Analyze all WSC2024 marking schemes and extract descriptor patterns
- [ ] Identify excellent descriptor examples (clear, measurable, differentiated)
- [ ] Identify poor descriptor anti-patterns
- [ ] Find common criterion types across skills
- [ ] Database schema for descriptor library with metadata (skill, criterion, tags)
- [ ] Full-text search across descriptors
- [ ] Filter descriptors by skill area, criterion type, performance level
- [ ] Tag-based organization for flexible categorization
- [ ] SCM can browse descriptor library
- [ ] SCM can search descriptors by keyword
- [ ] SCM can view descriptor with full context (skill, criterion, performance levels)
- [ ] SCM can copy descriptor to clipboard
- [ ] SCM can create marking schemes in the system
- [ ] SCM can search and insert descriptors directly into marking scheme forms
- [ ] Export marking schemes to Excel format
- [ ] Export marking schemes to PDF format

### Out of Scope

Features explicitly excluded from current milestone:

- AI-generated descriptors — focus on curated library from proven examples
- Automated marking scheme validation — manual review sufficient for v1.0
- Collaborative editing of marking schemes — single-author workflow sufficient
- Version history for marking schemes — defer to future milestone
- Descriptor rating/voting system — admin-curated library sufficient
- Multi-language descriptor support — English only for v1.0
- Test Project management workflows — future milestone
- Issue/Dispute tracking — future milestone
- Full CIS integration — future milestone
- Management meetings (phases 3-4) — deferred, focus on descriptor library

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
*Last updated: 2026-02-01 after v1.0 milestone start*

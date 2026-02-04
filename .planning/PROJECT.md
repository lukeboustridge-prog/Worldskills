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
- ✓ Descriptor library with 228 curated descriptors linked to WSOS sections — v1.0
- ✓ Full-text search across descriptors with relevance ranking — v1.0
- ✓ Filter descriptors by skill area, criterion type, performance level — v1.0
- ✓ Admin CRUD for descriptor management with quality indicators — v1.0
- ✓ Descriptor preview modal with clipboard integration — v1.0
- ✓ Related descriptors via similarity matching — v1.0
- ✓ Descriptor favorites/bookmarks — v1.0

## Current Milestone: v2.0 SCM Descriptor Creation & Approval Workflow

**Goal:** Enable SCMs to contribute new descriptors to the library with SA approval, including WSOS section management and batch review workflow with email notifications.

**Target features:**
- SCMs can create new descriptors linked to WSOS sections
- WSOS section management with duplicate detection
- Batch submission workflow with explicit "Submit for Review" action
- SA approval workflow (approve as-is or modify wording)
- Email notifications for review requests and approvals

### Active

Current milestone requirements:

- [ ] WSOS Section entity with duplicate detection (similarity matching)
- [ ] SCMs can create new WSOS sections if needed (no SA approval required)
- [ ] SCMs can create descriptors linked to WSOS sections
- [ ] New SCM-created descriptors start with NEEDS_REVIEW status
- [ ] Batch workflow: SCM adds multiple descriptors, then submits for review
- [ ] Email notification to SA when SCM submits batch for review
- [ ] SA can view pending descriptors from their skill's SCM
- [ ] SA can approve descriptors (status changes to GOOD)
- [ ] SA can modify descriptor wording before approving
- [ ] Track whether descriptor was modified during approval (flag, not version history)
- [ ] Email notification to SCM when descriptors approved
- [ ] Approval email indicates if wording was modified

### Out of Scope

Features explicitly excluded from current milestone:

- AI-generated descriptors — focus on human-curated library
- Automated marking scheme validation — manual review sufficient
- Collaborative editing of marking schemes — single-author workflow sufficient
- Version history for descriptors — flag modification, don't track full history
- Descriptor rating/voting system — SA approval workflow sufficient
- Multi-language descriptor support — English only
- Test Project management workflows — future milestone
- Issue/Dispute tracking — future milestone
- Full CIS integration — future milestone
- Management meetings — deferred

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
| SCM descriptors route to SCM's assigned skill SA | Clear ownership, SA knows their SCM's work | — Pending |
| WSOS sections don't need SA approval | Reduces friction, duplicate detection prevents proliferation | — Pending |
| Flag modification rather than version history | Simpler implementation, user knows if wording changed | — Pending |
| Explicit batch submission vs auto-submit | SCM controls when to notify SA, can refine before submitting | — Pending |

---
*Last updated: 2026-02-04 after v2.0 milestone start*

# Requirements: WorldSkills Competition Management System

**Defined:** 2026-02-01
**Core Value:** Enable Skill Advisors and Competition Managers to coordinate effectively during CPW and throughout the competition cycle

## v1 Requirements

Requirements for management meetings feature. Each maps to roadmap phases.

### Database & Data Model

- [ ] **DB-01**: Meeting model supports optional skillId (NULL for management meetings)
- [ ] **DB-02**: MeetingAttendee junction table stores per-meeting attendee lists
- [ ] **DB-03**: Migration preserves existing skill meetings without data loss
- [ ] **DB-04**: Database indexes support efficient queries for both meeting types

### Access Control & Permissions

- [ ] **AUTH-01**: All Skill Advisors can view all management meetings
- [ ] **AUTH-02**: Secretariat members can view management meetings they're invited to
- [ ] **AUTH-03**: Only Admins and Secretariat can create management meetings
- [ ] **AUTH-04**: Only Admins and Secretariat can edit management meetings
- [ ] **AUTH-05**: Only Admins and Secretariat can delete management meetings
- [ ] **AUTH-06**: Existing skill meeting permissions remain unchanged

### Meeting Creation & Management

- [ ] **MEET-01**: User can create management meeting with title, time, description
- [ ] **MEET-02**: User can add meeting link to management meeting
- [ ] **MEET-03**: User can select specific Secretariat members as attendees per meeting
- [ ] **MEET-04**: All Skill Advisors are automatically included in management meetings
- [ ] **MEET-05**: User can attach documents to management meetings
- [ ] **MEET-06**: User can add external links to management meetings
- [ ] **MEET-07**: User can add meeting minutes after meeting occurs
- [ ] **MEET-08**: User can add action points to management meetings

### Email & Calendar Integration

- [ ] **EMAIL-01**: Management meetings generate calendar invites (ICS files)
- [ ] **EMAIL-02**: Invites sent to all SAs + selected Secretariat attendees
- [ ] **EMAIL-03**: Calendar invites include meeting link, time, and description
- [ ] **EMAIL-04**: Email templates distinguish management vs skill meetings
- [ ] **EMAIL-05**: Existing skill meeting email functionality unchanged

### User Interface

- [ ] **UI-01**: Badge displays "Skill Meeting" for skill-specific meetings
- [ ] **UI-02**: Badge displays "Skill Advisor Meeting" for management meetings
- [ ] **UI-03**: Meetings hub shows both types in unified interface
- [ ] **UI-04**: SAs see all management meetings + their skill meetings
- [ ] **UI-05**: Secretariat sees management meetings they're invited to
- [ ] **UI-06**: Meeting creation form includes attendee selector for management meetings
- [ ] **UI-07**: Meeting list can be filtered by type (skill vs management)
- [ ] **UI-08**: Management meetings display attendee list

### Data Integrity & Safety

- [ ] **SAFE-01**: NULL skill references handled safely in all UI components
- [ ] **SAFE-02**: Existing skill meetings continue to work without issues
- [ ] **SAFE-03**: Activity logging works for both meeting types
- [ ] **SAFE-04**: Database migration is reversible if needed

## v2 Requirements

Deferred to future milestones:

### Advanced Features
- **ADV-01**: Meeting templates for common scenarios
- **ADV-02**: Smart attendee suggestions based on patterns
- **ADV-03**: Meeting agenda builder with time allocation
- **ADV-04**: Attendance tracking and RSVP management
- **ADV-05**: Meeting recording integration
- **ADV-06**: Automated meeting notes/transcription

### Integration Features
- **INT-01**: Integration with CIS (Competition Information System)
- **INT-02**: Sync with external calendar services (Google Calendar API)
- **INT-03**: Slack/Teams notifications for meetings
- **INT-04**: Mobile app for meeting management

## Out of Scope

Explicitly excluded features with reasoning:

| Feature | Reason |
|---------|--------|
| In-app video conferencing | External tools (Zoom, Teams) are sufficient, high complexity to build |
| Approval workflows for meetings | Unnecessary friction, Admins/Secretariat are trusted |
| Multi-skill meeting association | Overcomplicated, use management meetings for cross-skill topics |
| Automatic timezone conversion | CPW is single-location event, not needed |
| Meeting attendance tracking | Not required per PROJECT.md, may add in v2 |
| Recurring meeting templates | Each meeting created individually for now |
| Real-time collaborative meeting notes | Beyond scope, use minutes field post-meeting |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | ✓ Complete |
| DB-02 | Phase 1 | ✓ Complete |
| DB-03 | Phase 1 | ✓ Complete |
| DB-04 | Phase 1 | ✓ Complete |
| AUTH-01 | Phase 2 | ✓ Complete |
| AUTH-02 | Phase 2 | ✓ Complete |
| AUTH-03 | Phase 2 | ✓ Complete |
| AUTH-04 | Phase 2 | ✓ Complete |
| AUTH-05 | Phase 2 | ✓ Complete |
| AUTH-06 | Phase 2 | ✓ Complete |
| MEET-01 | Phase 2 | ✓ Complete |
| MEET-02 | Phase 2 | ✓ Complete |
| MEET-03 | Phase 2 | ✓ Complete |
| MEET-04 | Phase 2 | ✓ Complete |
| MEET-05 | Phase 2 | ✓ Complete |
| MEET-06 | Phase 2 | ✓ Complete |
| MEET-07 | Phase 2 | ✓ Complete |
| MEET-08 | Phase 2 | ✓ Complete |
| EMAIL-01 | Phase 2 | ✓ Complete |
| EMAIL-02 | Phase 2 | ✓ Complete |
| EMAIL-03 | Phase 2 | ✓ Complete |
| EMAIL-04 | Phase 2 | ✓ Complete |
| EMAIL-05 | Phase 2 | ✓ Complete |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 3 | Pending |
| UI-05 | Phase 3 | Pending |
| UI-06 | Phase 3 | Pending |
| UI-07 | Phase 3 | Pending |
| UI-08 | Phase 3 | Pending |
| SAFE-01 | Phase 4 | Pending |
| SAFE-02 | Phase 4 | Pending |
| SAFE-03 | Phase 2 | ✓ Complete |
| SAFE-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-01 after Phase 2 execution*

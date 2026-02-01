# Codebase Concerns

**Analysis Date:** 2026-02-01

## Security Concerns

**Hardcoded Host Email Default:**
- Issue: Personal email address hardcoded as fallback when HOST_EMAIL env var not set
- Files: `src/lib/auth.ts` (line 9), `src/app/api/register/route.ts` (line 26), `src/app/(dashboard)/instructions/page.tsx` (line 19)
- Impact: If HOST_EMAIL is not explicitly configured in production, all unauthenticated registrations will auto-promote the hardcoded email (luke.boustridge@gmail.com) to Skill Advisor with admin privileges. This allows account takeover.
- Fix approach: Remove hardcoded defaults entirely. Require explicit HOST_EMAIL configuration with validation at startup that fails loudly if missing. Use environment-specific .env files.

**Insufficient Input Validation in JSON Parsing:**
- Issue: `JSON.parse()` called without try-catch on user-provided data
- Files: `src/app/(dashboard)/settings/actions.ts` (line 67)
- Impact: Malformed JSON in form submission could crash the application or expose internal errors to users
- Fix approach: Wrap JSON.parse in try-catch and use Zod validation before parsing

**Unvalidated Role/Permission Assignment:**
- Issue: isAdmin flag set from form data comparison ("on" string) without validation layer
- Files: `src/app/(dashboard)/settings/actions.ts` (lines 672, 776)
- Impact: Role elevation could be bypassed if form field handling changes or browser developer tools allow field manipulation
- Fix approach: Use strict enum validation in Zod schema before assignment. Validate that only authenticated admins can set isAdmin flag.

## Tech Debt

**Hardcoded URLs and Configuration:**
- Issue: Multiple hardcoded URLs and fallbacks for app base URL
- Files: `src/app/(dashboard)/settings/page.tsx` (lines 58-81)
- Impact: Makes deployment across environments error-prone. Default hardcoded URL (vercel.app) is wrong for non-Vercel deployments.
- Fix approach: Move all URL configuration to env vars with proper validation. Use a dedicated config module that validates all URLs at startup.

**Scattered Debug Flags:**
- Issue: Multiple SHOW_*_DEBUG and STORAGE_DEBUG_ENABLED flags throughout component code
- Files: `src/app/(dashboard)/skills/[skillId]/document-evidence-manager.tsx` (lines 49-54), `src/app/(dashboard)/skills/[skillId]/meeting-document-manager.tsx` (lines 52-57)
- Impact: Debug code committed to production. Inconsistent pattern means debug output scattered across UI. Hard to control centrally.
- Fix approach: Create a centralized debug configuration module. Use consistent logger with environment-based levels. Remove debug UI rendering from production components.

**TODO Comments Indicating Incomplete Features:**
- Issue: Feature gaps documented but not addressed
- Files: `src/lib/competitionReports.ts` (line 13) - "TODO: define at competition deliverables and statuses", `src/lib/preCompetitionStatuses.ts` (line 3) - "TODO: Replace with spreadsheet import from Competition Prep Report.xlsx once available"
- Impact: Competition reporting functionality incomplete. Reliance on spreadsheet import that hasn't been automated yet.
- Fix approach: Create GitHub issues for each TODO. Link todos to issues for tracking. Set deadline for completing spreadsheet import automation.

**Large Component Files:**
- Issue: Multiple components over 750 lines of code
- Files: `src/app/(dashboard)/settings/page.tsx` (934 lines), `src/app/(dashboard)/skills/[skillId]/actions.ts` (930 lines), `src/app/(dashboard)/skills/[skillId]/deliverables-table.tsx` (913 lines), `src/server/reports/globalReportPdf.tsx` (845 lines)
- Impact: Hard to test, difficult to understand, increased risk of bugs. Settings page handles role management, template creation, invitations, user imports all in one file.
- Fix approach: Break settings page into smaller, focused components. Extract form handlers into separate modules. Create dedicated components for user management, template management, and imports.

## Test Coverage Gaps

**Critical Auth Paths Untested:**
- Issue: No tests for the host email auto-promotion logic in auth
- Files: `src/lib/auth.ts` (lines 79-86)
- Impact: The most critical security issue (auto-promotion of hardcoded email) is not covered by tests. Changes to this code could introduce vulnerabilities.
- Priority: High - Test immediately

**Settings Actions Lack Comprehensive Tests:**
- Issue: 809 lines of server action code with minimal test coverage
- Files: `src/app/(dashboard)/settings/actions.ts`
- Impact: Role updates, user creation, template management, and invitations are not tested. Could result in data corruption or permission escalation bugs.
- Priority: High - Add tests for all permission checks and role assignments

**Storage Integration Tests Missing:**
- Issue: Limited test coverage for presigned URL generation and S3 operations
- Files: `src/app/api/(node)/storage/presign/route.ts` (373 lines)
- Impact: File upload flow could fail silently or allow invalid files to be uploaded
- Priority: Medium - Add tests for validation and error paths

**Permission System Untested:**
- Issue: `canManageSkill()` and `canViewSkill()` functions have no tests
- Files: `src/lib/permissions.ts`
- Impact: Permission checks are fundamental to security. Any changes could introduce privilege escalation.
- Priority: High - Create dedicated permission test suite

## Fragile Areas

**Configuration Dependency Chain:**
- Issue: Environment variable resolution relies on multiple fallback strategies that could fail silently
- Files: `src/lib/env.ts` (function resolveStorageConfig), `src/app/(dashboard)/settings/page.tsx` (function resolveAppBaseUrl)
- Why fragile: Falling back through multiple env var names makes it unclear which config is actually being used. Multiple fallback URLs means the wrong one could be used without error.
- Safe modification: Add startup validation that logs exactly which env vars were resolved. Fail fast if critical config is missing.
- Test coverage: Only basic env parsing tests exist; fallback chain is not tested

**Role-Based Access Control:**
- Issue: Permission checks scattered across route handlers and server actions
- Files: Multiple files check `user.isAdmin` and `user.role` directly. Permission model mixes Skill-level access with global admin privileges.
- Why fragile: If a new permission requirement is added, it's easy to miss checking it in some route. The mix of global admin + skill-specific SA/SCM roles creates edge cases.
- Safe modification: Centralize all permission checks through `canManageSkill()` and `canViewSkill()` functions. Always check before database operations.
- Test coverage: Permission tests only cover happy path, not edge cases like admin privilege escalation

**Database Transaction Consistency:**
- Issue: Multiple database operations use transactions but error handling is basic
- Files: `src/lib/deliverables.ts`, `src/lib/milestones.ts` (multiple $transaction calls)
- Why fragile: If a transaction fails mid-operation, partial state could exist. No compensating transactions for rollback.
- Safe modification: Wrap all transaction operations in error boundaries. Log transaction failures with full context for debugging. Test transaction failure scenarios.
- Test coverage: Transactions are not tested for failure conditions

**Meeting Document Manager Complexity:**
- Issue: Large component managing file uploads, metadata, and state in a single file
- Files: `src/app/(dashboard)/skills/[skillId]/meeting-document-manager.tsx` (638 lines)
- Why fragile: Upload state management, validation, and UI rendering all mixed together. Debug flags throughout make control flow hard to follow.
- Safe modification: Extract upload logic into custom hook. Separate validation from UI rendering. Remove debug flags before using in production.
- Test coverage: No tests for upload flow or error handling

## Performance Bottlenecks

**N+1 Query Risk in Skill Querying:**
- Issue: Multiple database queries may be made without select/include optimization
- Files: `src/app/(dashboard)/skills/[skillId]/page.tsx`, `src/lib/deliverables.ts`
- Problem: Deliverables and Gates are queried separately for each skill view. If displaying multiple skills, could result in many queries.
- Improvement path: Use Prisma select/include to fetch related data in single query. Cache frequently accessed skill data.

**Storage Health Check Called on Every Page Load:**
- Issue: Storage diagnostics computed on every render of document managers
- Files: `src/app/(dashboard)/skills/[skillId]/document-evidence-manager.tsx` (lines 131-137), `src/app/(dashboard)/skills/[skillId]/meeting-document-manager.tsx` (lines 120-125)
- Cause: Health check is not cached; each render calls getStorageDiagnostics() which validates all env vars
- Improvement path: Cache health check result with TTL. Move health check to layout level. Only revalidate on storage error.

**Large JSON Fields in Database:**
- Issue: evidenceItems stored as JSON field in deliverables, not normalized
- Files: `prisma/schema.prisma` (line 134), `src/lib/deliverables.ts`
- Cause: Evidence stored as array in JSON field instead of separate Evidence table
- Improvement path: Create Evidence table with foreign key to Deliverable. Allows indexing and filtering on evidence properties.

## Scaling Limits

**Fixed File Upload Size Constraints:**
- Issue: Max file size hardcoded and not configurable per environment
- Files: `src/lib/env.ts` (lines 45, 176)
- Current capacity: Default 25MB, configurable via FILE_MAX_MB env var
- Limit: If actual limits need to be smaller per storage provider, code changes required
- Scaling path: Move file limits to database configuration table. Allow per-skill file limits. Add admin UI for limit management.

**Single Hardcoded Host Email:**
- Issue: System designed around single host user (Luke Boustridge)
- Files: Multiple auth and API files reference HOST_EMAIL
- Current capacity: One host account
- Limit: Cannot have multiple administrators or distributed ownership
- Scaling path: Remove host email hardcoding. Support multiple admins through normal role assignment. Add multi-tenant support if needed.

## Dependencies at Risk

**Outdated Next.js Version:**
- Risk: Using Next.js 14.2.10 (from Jan 2025). Major version 15 released in Nov 2024.
- Impact: Security fixes in v15 may not be backported. App Router features may be incomplete.
- Migration plan: Schedule upgrade to Next.js 15.x. Test thoroughly for breaking changes in API routes and middleware.

**Prisma Version Pinning:**
- Risk: Pinned to Prisma 5.20.0 without patch range
- Impact: Bug fixes and security patches not automatically applied
- Migration plan: Use caret range (^5.20.0) to allow patch updates. Monitor Prisma security advisories.

## Missing Critical Features

**No Audit Logging:**
- Problem: User actions (role changes, document uploads, deliverable updates) not logged for accountability
- Blocks: Cannot determine who made changes or when. Compliance/audit trails missing.
- Impact: High - Required for any system managing assessment data

**No Rate Limiting:**
- Problem: API endpoints have no rate limiting
- Blocks: Could be abused for brute force attacks or resource exhaustion
- Files: `src/app/api/(node)/storage/presign/route.ts`, upload endpoints
- Impact: High - Must add rate limiting before production use

**No Backup/Export Mechanism:**
- Problem: No way to export all competition data for backup or migration
- Blocks: Cannot migrate to new system or recover from data loss
- Impact: High - Add scheduled backup export and manual export feature

**No Soft Deletes:**
- Problem: Users and deliverables are hard deleted, losing audit trail
- Blocks: Cannot see what was deleted or restore accidentally deleted data
- Impact: Medium - Add soft delete fields to User and Deliverable models

**No Change History:**
- Problem: No historical record of deliverable status changes or evidence uploads
- Blocks: Cannot see progression or revert to previous state
- Impact: Medium - Add history table tracking all status changes

## Schema Issues

**Foreign Key Missing on Evidence:**
- Issue: evidenceItems stored as JSON array without database relationship
- Files: `prisma/schema.prisma` (Deliverable model, line 134)
- Impact: Cannot query or index evidence. Updating evidence is atomic with deliverable update (can cause race conditions).

**SkillMember Team Membership Optional:**
- Issue: `skill.teamMemberIds` in permission checks is optional and not normalized
- Files: `src/lib/permissions.ts` (line 28), passed but not always populated
- Impact: Skill team member checks could be unreliable if data not fully loaded

**Session Token Expiry Not Configured:**
- Issue: JWT session strategy used without explicit maxAge configuration
- Files: `src/lib/auth.ts` (line 14-15)
- Impact: Sessions could persist indefinitely if NEXTAUTH_SECRET leaked

## Production Readiness Issues

**Debug UI Enabled in Production:**
- Issue: SHOW_STATUS_DEBUG, SHOW_UPLOAD_DEBUG, STORAGE_DEBUG_ENABLED flags render debug info in UI
- Files: `src/app/(dashboard)/skills/[skillId]/document-evidence-manager.tsx` (lines 672-748), `src/app/(dashboard)/skills/[skillId]/meeting-document-manager.tsx`
- Impact: Exposes internal state, API responses, and diagnostics to all users
- Fix approach: Remove debug UI rendering for production. Use server-side logging only.

**No Error Boundary Components:**
- Issue: Server actions throw errors that become user-visible error messages
- Files: Multiple server action files use throw new Error() for both validation and fatal errors
- Impact: Users see raw error messages like "Cannot read property X of undefined"
- Fix approach: Create custom error classes. Use error boundary component. Log errors server-side while returning generic messages to users.

**Missing Environment Validation at Startup:**
- Issue: No startup validation that all required config is present and valid
- Impact: Application could start with incomplete configuration, failing only when features are used
- Fix approach: Create startup script that validates DATABASE_URL, NEXTAUTH_SECRET, storage config, and HOST_EMAIL before allowing app to start.

---

*Concerns audit: 2026-02-01*

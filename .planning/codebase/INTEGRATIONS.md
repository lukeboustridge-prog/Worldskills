# External Integrations

**Analysis Date:** 2026-02-01

## APIs & External Services

**Email Service:**
- Resend - Transactional email delivery
  - SDK/Client: `resend` 4.0.0
  - Auth: `RESEND_API_KEY` env var
  - From address: `FROM_EMAIL` env var
  - Implementation: `src/lib/email/resend.ts` with cached client singleton
  - Used for: Password reset, account setup, meeting invitations, skill conversation notifications

**File Storage:**
- AWS S3 (or S3-compatible services like Cloudflare R2)
  - SDK/Client: `@aws-sdk/client-s3` 3.637.0 and `@aws-sdk/s3-request-presigner` 3.637.0
  - Configuration: Multiple environment variable names supported
    - Primary: `FILE_STORAGE_BUCKET`, `FILE_STORAGE_REGION`, `FILE_STORAGE_ACCESS_KEY_ID`, `FILE_STORAGE_SECRET_ACCESS_KEY`
    - Alternatives: AWS_S3_*, S3_*, STORAGE_*, R2_* prefixes supported
  - Optional: `FILE_STORAGE_ENDPOINT` for non-AWS endpoints, `FILE_STORAGE_FORCE_PATH_STYLE` for path-style URLs
  - TTL: `FILE_DOWNLOAD_TTL_SECONDS` configurable (default 120 seconds)
  - Implementation: `src/lib/storage.ts` with singleton S3Client
  - Used for: Evidence document uploads, presigned download links, file deletion

## Data Storage

**Databases:**
- PostgreSQL (required)
  - Connection: `DATABASE_URL` env var (Neon recommended in documentation)
  - Client: Prisma 5.20.0
  - Schema: `prisma/schema.prisma`
  - Tables: User, Skill, SkillMember, Deliverable, DeliverableEvidence, Message, Gate, Meeting, Resource, ActivityLog, Invitation, PasswordResetToken
  - Migrations: Managed via Prisma migrations (commands in package.json)

**File Storage:**
- AWS S3 or S3-compatible (e.g., Cloudflare R2)
  - Purpose: Store deliverable evidence documents and meeting materials
  - Presigned URLs for secure upload/download
  - Configuration supports endpoint override for compatible services

**Caching:**
- None detected - No Redis or caching layer configured

## Authentication & Identity

**Auth Provider:**
- NextAuth.js 4.24.7 - Custom implementation
  - Provider: Credentials provider (email + password)
  - Strategy: JWT tokens with session callbacks
  - Session storage: JWT-based (stateless)
  - Implementation: `src/lib/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts`

**Authentication Flow:**
- Email/password credentials verified against Prisma database
- Password hashing: bcryptjs 2.4.3
- JWT token populated with user fields: id, email, role, isAdmin
- Session callback updates token on each request by querying database

**Authorization:**
- Role-based access control:
  - Roles: Pending, SA (Skill Advisor), SCM, SkillTeam, Secretariat
  - Admin flag: `isAdmin` boolean
  - Default SA role for `HOST_EMAIL` env var email
- Utility functions: `assertSA()`, `assertAdmin()`, `requireUser()`, `requireAdminUser()`
- Location: `src/lib/auth.ts` and `src/lib/permissions.ts`

**Password Management:**
- Reset flow: `src/lib/email/password-reset.ts` with token-based reset
- Setup flow: Initial password setup via token `src/lib/email/` (setup-account)
- Token storage: `PasswordResetToken` model in database with expiry

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry or error tracking service configured

**Logs:**
- Prisma query logging in development: `src/lib/prisma.ts` logs "query", "error", "warn"
- Default logging: error only in production
- No centralized logging service detected

## CI/CD & Deployment

**Hosting:**
- Platform: Supports Vercel (default for Next.js) or self-hosted Node servers
- Build command: `node scripts/ci-build.js` (custom build script)
- Start command: `next start`
- Dev command: `next dev`

**CI Pipeline:**
- Not detected in codebase - likely handled by hosting platform

**Database Migrations:**
- Handled via Prisma: `prisma migrate deploy` command
- Schema in version control: `prisma/schema.prisma`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (critical)
- `NEXTAUTH_SECRET` - Session encryption key (critical)
- `FILE_STORAGE_BUCKET` - S3 bucket name (critical for file uploads)
- `FILE_STORAGE_REGION` - S3 region (critical for file uploads)
- `FILE_STORAGE_ACCESS_KEY_ID` - S3 credentials (critical)
- `FILE_STORAGE_SECRET_ACCESS_KEY` - S3 credentials (critical)
- `RESEND_API_KEY` - Email service API key (for email features)
- `FROM_EMAIL` - Sender email address (for email features)

**Optional env vars:**
- `NEXTAUTH_URL` - Callback URL for auth (auto-detected in production)
- `HOST_EMAIL` - Default admin email (defaults to luke.boustridge@gmail.com)
- `HOST_NAME` - Admin display name (defaults to Luke Boustridge)
- `FILE_STORAGE_ENDPOINT` - Override S3 endpoint for compatible services
- `FILE_STORAGE_FORCE_PATH_STYLE` - Enable path-style URLs for S3-compatible services
- `FILE_DOWNLOAD_TTL_SECONDS` - Presigned URL expiry duration
- `NODE_ENV` - Environment flag (development/production)
- `NEXT_PUBLIC_APP_URL` - Public app URL for email links

**Secrets location:**
- `.env` file (git-ignored) - Contains all secrets in development
- Environment: Secrets passed via environment at deployment time
- No secret manager detected (Vercel, AWS Secrets Manager, etc. may be used at deployment)

## Webhooks & Callbacks

**Incoming:**
- None detected - No webhook endpoints for external services

**Outgoing:**
- Email notifications sent to users via Resend
  - Password reset emails: `src/lib/email/password-reset.ts`
  - Account setup emails: Auto-sent upon registration
  - Meeting invitations: `src/lib/email/meeting-invitation.ts`
  - Skill conversation notifications: `src/lib/email/notifications.ts`
  - Endpoints: Resend email service handles delivery
- No outbound webhook integrations detected

## Third-Party Services Summary

| Service | Purpose | Criticality | Config |
|---------|---------|------------|--------|
| PostgreSQL | Primary data store | Critical | DATABASE_URL |
| AWS S3 / R2 | File storage | Critical | FILE_STORAGE_* |
| Resend | Email delivery | High | RESEND_API_KEY, FROM_EMAIL |
| NextAuth.js | Authentication | Critical | NEXTAUTH_SECRET |
| Prisma | ORM & migrations | Critical | DATABASE_URL |

---

*Integration audit: 2026-02-01*

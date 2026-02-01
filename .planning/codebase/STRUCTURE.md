# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```
worldskills/
├── src/
│   ├── app/                          # Next.js App Router - pages & API routes
│   │   ├── (auth)/                   # Auth route group
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── forgot-password/
│   │   │   ├── reset-password/
│   │   │   ├── setup-account/
│   │   │   └── [token]/
│   │   ├── (dashboard)/              # Protected dashboard route group
│   │   │   ├── dashboard/            # Main dashboard with metrics
│   │   │   ├── hub/                  # Skills hub listing
│   │   │   ├── hub/kb/               # Knowledge base
│   │   │   ├── hub/meetings/         # Meeting schedules
│   │   │   ├── hub/onboarding/       # Onboarding materials
│   │   │   ├── hub/qc/               # Quality check resources
│   │   │   ├── instructions/         # User guide
│   │   │   ├── reports/              # Report views
│   │   │   ├── skills/               # Skill management
│   │   │   ├── skills/[skillId]/     # Skill workspace detail
│   │   │   ├── settings/             # Admin settings
│   │   │   ├── storage-debug/        # Dev storage tools
│   │   │   └── layout.tsx            # Dashboard layout with nav
│   │   ├── api/                      # API route handlers
│   │   │   ├── auth/                 # Authentication endpoints
│   │   │   ├── deliverables/         # Deliverable CRUD
│   │   │   ├── meetings/             # Meeting management
│   │   │   ├── invitations/          # User invitation flow
│   │   │   ├── reports/              # Report generation
│   │   │   ├── storage/              # S3 storage operations
│   │   │   ├── (node)/               # Node.js-specific APIs
│   │   │   └── _env/                 # Environment/debug endpoints
│   │   ├── awaiting-access/          # Pending user page
│   │   ├── layout.tsx                # Root layout (providers, auth)
│   │   ├── page.tsx                  # Home redirect
│   │   └── globals.css               # Tailwind styles
│   ├── components/                   # Reusable React components
│   │   ├── ui/                       # Base UI primitives (button, card, etc)
│   │   ├── layout/                   # Layout components (nav, header)
│   │   ├── providers/                # Context providers
│   │   ├── dashboard/                # Dashboard-specific components
│   │   ├── hub/                      # Hub-specific components
│   │   ├── reports/                  # Report visualization components
│   │   └── [feature]/                # Feature-specific components
│   ├── lib/                          # Business logic utilities
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   ├── auth.ts                   # NextAuth setup & helpers
│   │   ├── permissions.ts            # Access control functions
│   │   ├── deliverables.ts           # Deliverable calculations
│   │   ├── activity.ts               # Activity logging
│   │   ├── milestones.ts             # Milestone utilities
│   │   ├── resources.ts              # Resource management
│   │   ├── email/                    # Email templates & sending
│   │   │   ├── resend.ts
│   │   │   ├── welcome.ts
│   │   │   ├── password-reset.ts
│   │   │   ├── meeting-invitation.ts
│   │   │   └── notifications.ts
│   │   ├── storage/                  # S3 storage abstractions
│   │   ├── r2.ts                     # Cloudflare R2 config
│   │   ├── preCompetitionDeliverables.ts
│   │   ├── atCompetitionDeliverables.ts
│   │   ├── competitionReports.ts
│   │   ├── deliverableReports.ts
│   │   ├── env.ts                    # Environment variables
│   │   ├── skill-catalog.ts          # Skill seed data
│   │   ├── schema-info.ts            # Database schema utilities
│   │   └── [domain].ts               # Other domain utilities
│   ├── server/                       # Server-side logic
│   │   └── reports/                  # Report data generation
│   │       └── globalReportData.ts
│   ├── types/                        # TypeScript type definitions
│   │   └── next-auth.d.ts            # NextAuth module augmentation
│   └── env.ts                        # Runtime env validation (Zod)
├── prisma/
│   ├── schema.prisma                 # Database schema (Postgres)
│   ├── migrations/                   # Database migrations
│   │   ├── 0001_init
│   │   ├── 0002_add_user_passwords
│   │   ├── ...
│   │   └── 0016_add_skill_team_members
│   └── seed.ts                       # Database seeding script
├── public/                           # Static assets
│   └── logo.png
├── docs/                             # Documentation files
├── scripts/                          # Build and utility scripts
│   └── ci-build.js
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript config
├── tailwind.config.js                # Tailwind CSS config
├── next.config.js                    # Next.js config
└── .env                              # Environment variables (not committed)
```

## Directory Purposes

**src/app/:**
- Purpose: Next.js App Router - all pages and API routes
- Contains: Route groups `(auth)` and `(dashboard)`, API handlers, page components
- Key files: `layout.tsx` for per-segment layouts, `page.tsx` for route rendering, `route.ts` for API handlers

**src/app/(auth)/:**
- Purpose: Public authentication pages and endpoints
- Contains: Login, registration, password reset, account setup flows
- Key files: `page.tsx` in each subdirectory for form rendering

**src/app/(dashboard)/:**
- Purpose: Protected dashboard and workspace pages
- Contains: Dashboard metrics, skills hub, skill detail views, reports, settings
- Key files: `layout.tsx` wraps all dashboard pages with header/nav and permission checks

**src/api/:**
- Purpose: Server-side API endpoints consumed by pages and external services
- Contains: HTTP route handlers that validate input, call business logic, return JSON
- Key files: `route.ts` files matching URL structure (e.g., `/api/register/route.ts`)

**src/components/:**
- Purpose: Reusable React components (client and server)
- Contains: UI primitives (from shadcn/ui), layout wrappers, feature-specific components
- Key files: `ui/*.tsx` for base components, feature directories for grouped components

**src/lib/:**
- Purpose: Business logic, utilities, and domain calculations (shared across pages and API)
- Contains: Database queries wrapped in utility functions, email sending, permission checks, data transformation
- Key files: `prisma.ts` (singleton), `auth.ts` (auth helpers), `permissions.ts` (access control)

**src/server/:**
- Purpose: Server-only utilities that cannot be imported by client components
- Contains: Complex report generation, server-side computations
- Key files: `reports/globalReportData.ts` (aggregates skill metrics for PDF export)

**src/types/:**
- Purpose: TypeScript type definitions, module augmentations
- Contains: NextAuth type extensions, global types
- Key files: `next-auth.d.ts` (adds role/isAdmin to Session interface)

**prisma/:**
- Purpose: Database schema definition and migrations
- Contains: `schema.prisma` defining all tables, enums, relationships
- Key files: `schema.prisma`, individual migration folders for version control

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout, wraps all pages with AuthSessionProvider
- `src/app/page.tsx`: Home redirect (checks auth, sends to dashboard or login)
- `src/app/(dashboard)/layout.tsx`: Dashboard layout with header/nav (protects all dashboard routes)

**Authentication:**
- `src/lib/auth.ts`: NextAuth configuration, `auth()`, `getCurrentUser()`, `requireUser()` helpers
- `src/app/api/auth/[...nextauth]/route.ts`: NextAuth API route
- `src/app/(auth)/login/page.tsx`: Login form (client component)
- `src/app/(auth)/register/page.tsx`: Registration form

**Core Entities:**
- `src/lib/deliverables.ts`: Deliverable calculations, decorations, status logic
- `src/lib/permissions.ts`: `canManageSkill()`, `canViewSkill()` access checks
- `src/lib/activity.ts`: Activity logging to database
- `src/lib/milestones.ts`: Milestone calculations

**API Handlers:**
- `src/app/api/register/route.ts`: User registration POST endpoint
- `src/app/api/auth/forgot-password/route.ts`: Password reset request
- `src/app/api/deliverables/[deliverableId]/documents/commit/route.ts`: Upload handler
- `src/app/api/reports/global/route.ts`: Global report data generation

**Page Components:**
- `src/app/(dashboard)/dashboard/page.tsx`: Main dashboard with metrics (600+ lines, complex queries)
- `src/app/(dashboard)/skills/page.tsx`: Skills list and management
- `src/app/(dashboard)/skills/[skillId]/page.tsx`: Skill workspace detail view
- `src/app/(dashboard)/hub/page.tsx`: Skills hub for non-admin users

**Report Generation:**
- `src/server/reports/globalReportData.ts`: Aggregates skill metrics for export

**Email:**
- `src/lib/email/resend.ts`: Resend email client configuration
- `src/lib/email/welcome.ts`: Welcome email template
- `src/lib/email/password-reset.ts`: Password reset template

## Naming Conventions

**Files:**
- Page files: `page.tsx` (Next.js convention)
- API handlers: `route.ts` (Next.js convention)
- Components: `PascalCase.tsx` (React convention)
- Utilities: `camelCase.ts` (lowercase dash-separated words)
- Styles: `globals.css` (app-level), component-scoped via Tailwind className

**Directories:**
- Route groups: `(groupName)` - parentheses indicate not part of URL
- Slug routes: `[param]` or `[...catchAll]` - brackets for dynamic segments
- Feature directories: lowercase plural or descriptive (e.g., `components/dashboard/`)

**Functions:**
- Mutations: `createX()`, `updateX()`, `deleteX()` (action functions)
- Queries: `getX()`, `fetchX()`, or just `prisma.model.findMany()`
- Helpers: `canX()`, `isX()`, `ensureX()` (utilities)
- Decorators: `decorateX()` (adds computed properties)

**Variables:**
- User/permission vars: `user`, `currentUser`, `isAdmin`, `role`
- Data collections: `skills`, `deliverables`, `messages` (plural)
- Maps: `advisorStatsMap`, `messagesBySkill` (indicate grouping/indexing)
- Booleans: `can*`, `is*` (e.g., `canManageSkill`, `isOverdue`)

**Types:**
- Prisma models: `User`, `Skill`, `Deliverable` (from schema)
- Request/response: Inferred from handler, often use Zod schemas for validation
- Domain interfaces: `SkillAccessContext`, `UserAccessContext`, `SkillReportEntry` (capitalized, -Context or -Entry suffix)

## Where to Add New Code

**New Feature:**
- Primary code: `src/lib/{feature}.ts` (business logic)
- Page: `src/app/(dashboard)/{feature}/page.tsx` (route)
- Components: `src/components/{feature}/*.tsx` (UI)
- Tests: `src/lib/__tests__/{feature}.test.ts` (colocated with lib)
- API: `src/app/api/{feature}/route.ts` (if needs endpoints)

**New Component/Module:**
- Reusable UI: `src/components/ui/{ComponentName}.tsx`
- Feature component: `src/components/{feature}/{ComponentName}.tsx`
- Business logic: `src/lib/{domain}.ts` (colocated with similar utilities)

**Utilities:**
- Shared helpers: `src/lib/{domain}.ts` (group by domain/entity)
- Email templates: `src/lib/email/{templateName}.ts`
- Storage operations: `src/lib/storage/{operation}.ts`

**Tests:**
- Unit tests: `src/lib/__tests__/{module}.test.ts` (same folder as src/lib)
- Route tests: `src/app/api/__tests__/{endpoint}.test.ts`
- Component tests: `src/components/__tests__/{component}.test.ts`

## Special Directories

**src/app/(auth)/:**
- Purpose: Public routes (no layout protection)
- Generated: No (static routes)
- Committed: Yes

**src/app/(dashboard)/:**
- Purpose: Protected routes behind authentication and role checks
- Generated: No
- Committed: Yes
- Note: Layout wraps all routes, applies permission checks

**prisma/migrations/:**
- Purpose: Track schema changes over time
- Generated: Yes (by `prisma migrate dev`)
- Committed: Yes (migration files are version controlled)

**.next/:**
- Purpose: Next.js build output
- Generated: Yes (by build command)
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by pnpm/npm install)
- Committed: No

---

*Structure analysis: 2026-02-01*

# Architecture

**Analysis Date:** 2026-02-01

## Pattern Overview

**Overall:** Next.js 14 full-stack MVC with role-based access control

**Key Characteristics:**
- Server-side rendering with async components (React 18.3)
- API routes for server-side operations and database mutations
- Prisma ORM for PostgreSQL database abstraction
- Role-based authorization (Pending, SA, SCM, SkillTeam, Secretariat, Admin)
- Session-based authentication with NextAuth.js (JWT strategy)
- Separation of concerns: server utilities, API routes, page components, reusable UI components

## Layers

**UI Layer (Components & Pages):**
- Purpose: Render user interfaces and handle client interactions
- Location: `src/app/` (Next.js App Router pages) and `src/components/` (reusable React components)
- Contains: Page components (async), client components, UI primitives (badge, button, card), layout components
- Depends on: `src/lib/auth`, `src/lib/prisma`, API routes
- Used by: End users via HTTP

**API Layer (Route Handlers):**
- Purpose: Handle HTTP requests, validate input, execute server-side business logic
- Location: `src/app/api/`
- Contains: POST/GET route handlers that process requests and return JSON responses
- Depends on: `src/lib/` utilities, `src/server/` business logic, Prisma client
- Used by: UI components via fetch(), external services via webhooks

**Business Logic Layer:**
- Purpose: Encapsulate domain logic, calculations, and data transformations
- Location: `src/lib/` (23 utility modules) and `src/server/reports/` (report generation)
- Contains: Deliverable calculations (`deliverables.ts`), permission checks (`permissions.ts`), authentication (`auth.ts`), activity logging (`activity.ts`), email sending (`lib/email/`)
- Depends on: Prisma client, external services (Resend for email, AWS S3 for storage)
- Used by: API routes, page components

**Data Access Layer:**
- Purpose: Abstract database operations and provide singleton connection management
- Location: `src/lib/prisma.ts`
- Contains: Prisma client singleton with development logging
- Depends on: `@prisma/client`, environment variables
- Used by: All business logic and API routes

**Authentication & Authorization:**
- Purpose: Manage user sessions, verify identity, enforce access control
- Location: `src/lib/auth.ts` (NextAuth setup), `src/lib/permissions.ts` (skill-level access)
- Contains: NextAuth credentials provider, JWT callbacks, role-based access checks
- Depends on: bcryptjs for password hashing, Prisma for user lookup
- Used by: Layout components to protect pages, API routes to check permissions

## Data Flow

**User Authentication Flow:**

1. User submits login form (email + password)
2. `POST /api/auth/[...nextauth]` receives credentials
3. NextAuth `authorize()` callback queries `prisma.user`, compares password hash with bcrypt
4. On success, JWT token created with user metadata (id, email, role, isAdmin)
5. `session()` callback enriches session object with token data
6. Layout component calls `getCurrentUser()` (wraps `getServerSession()`)
7. User context available to all downstream pages and components

**Data Creation/Mutation Flow:**

1. Page component displays form (e.g., skill creation)
2. Form submission calls API route (e.g., `POST /api/deliverables`)
3. API validates input with Zod schema
4. Calls business logic function (e.g., from `lib/deliverables.ts`)
5. Function performs Prisma mutations and activity logging
6. Returns result to API handler
7. API handler returns JSON response to client
8. Component updates local state or revalidates page

**Data Retrieval Flow:**

1. Page component (async, server-side) runs at request time
2. Calls Prisma queries directly or through lib utility functions
3. Data decorated/transformed by business logic (e.g., `decorateDeliverable()`)
4. Component renders with data
5. For role-based views: page checks `getCurrentUser()` and redirects if unauthorized

**Report Generation Flow:**

1. Dashboard page loads and calls `ensureOverdueNotifications()` for each skill
2. Report data aggregated in memory from Prisma query results
3. `src/server/reports/globalReportData.ts` structures data into report interfaces
4. Component renders data with visualizations (charts, progress bars)
5. PDF export uses `@react-pdf/renderer` to generate downloadable reports

**State Management:**

- No centralized state management (Redux, Zustand)
- Session state via NextAuth (JWT stored in httpOnly cookie)
- Per-page component state via React hooks (useState) for UI interactions
- Server state via Prisma in-memory after query
- Activity audit trail stored in `ActivityLog` table for compliance

## Key Abstractions

**User Context:**
- Purpose: Represents authenticated user with role and permissions
- Examples: `getCurrentUser()` in `src/lib/auth.ts`, Session type from `src/types/next-auth.d.ts`
- Pattern: Async function that retrieves user from session; returns null if not authenticated

**Skill Access Context:**
- Purpose: Encapsulates skill ownership and team membership for permission checks
- Examples: `canManageSkill()`, `canViewSkill()` in `src/lib/permissions.ts`
- Pattern: Pure functions that compare user ID against skill SA/SCM/team members

**Decorated Deliverable:**
- Purpose: Enhances database deliverable with calculated fields (due date formatting, overdue status, risk assessment)
- Examples: `decorateDeliverable()` in `src/lib/deliverables.ts`
- Pattern: Function transforms Prisma model to domain model with computed properties

**Report Entry Interfaces:**
- Purpose: Structure aggregated data for reporting and visualization
- Examples: `SkillReportEntry`, `AdvisorPerformanceEntry` in `src/server/reports/globalReportData.ts`
- Pattern: Typed interfaces that shape business domain (skills, advisors, SCMs, sectors)

## Entry Points

**Web Application:**
- Location: `src/app/page.tsx`
- Triggers: User navigates to `/`
- Responsibilities: Redirects authenticated users to `/dashboard`, unauthenticated to `/login`

**Authentication Pages:**
- Location: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, etc.
- Triggers: User navigates to `/login`, `/register`, `/forgot-password`, etc.
- Responsibilities: Render forms, call API endpoints, manage form state

**Dashboard:**
- Location: `src/app/(dashboard)/dashboard/page.tsx`
- Triggers: User navigates to `/dashboard` (protected, requires SA/Secretariat/Admin role)
- Responsibilities: Query all skills, calculate metrics, render overview cards and charts

**Skills Hub:**
- Location: `src/app/(dashboard)/hub/page.tsx`
- Triggers: User navigates to `/hub` (all authenticated roles except Pending)
- Responsibilities: List skills user is involved with, navigate to individual skill workspaces

**Skill Detail Page:**
- Location: `src/app/(dashboard)/skills/[skillId]/page.tsx`
- Triggers: User navigates to `/skills/{skillId}`
- Responsibilities: Render skill workspace with deliverables, gates, messages, meetings

**API Routes:**
- Location: `src/app/api/*/route.ts`
- Triggers: HTTP requests (POST for mutations, GET for data fetch)
- Responsibilities: Validate requests, call business logic, return JSON

## Error Handling

**Strategy:** Try-catch with specific Prisma error codes, validation schemas with Zod

**Patterns:**

- **Validation Errors:** Zod schema parsing fails → return 400 with field-level error message
- **Not Found:** Prisma query returns null → return 404 "Resource not found"
- **Constraint Violations:** Prisma P2002 (unique) → return 409 "Already exists"
- **Database Offline:** Prisma P2021 (missing table) → return 503 "Service temporarily unavailable"
- **Unauthorized:** User without role/permission → throw Error("Action restricted to...") caught by API handler
- **Server Errors:** Unexpected exceptions → log with `console.error()`, return 500 with generic message
- **Development:** Detailed error messages exposed if `NODE_ENV === 'development'`, else generic

## Cross-Cutting Concerns

**Logging:**
- Database: Prisma logs queries/errors in development via `log` configuration in `src/lib/prisma.ts`
- Application: Console.error for exceptions, console.warn for warnings
- Audit: Activity stored in `ActivityLog` table via `logActivity()` for compliance

**Validation:**
- Input: Zod schemas in API routes (`registrationSchema` in `/api/register/route.ts`)
- Domain: Role checks with `assertSA()`, `assertAdmin()` helpers
- Relational: Prisma unique constraints (`@@unique([skillId, key])`)

**Authentication:**
- Strategy: NextAuth.js with JWT (stateless, no server session storage)
- Provider: Credentials (email/password), bcrypt for hashing
- Session enrichment: Role and admin flag from database during login and token refresh
- Host access: Special case for HOST_EMAIL env var auto-promotes to SA + Admin

---

*Architecture analysis: 2026-02-01*

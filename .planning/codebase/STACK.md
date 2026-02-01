# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- TypeScript 5.5.4 - All application code and configuration files

**Secondary:**
- JavaScript - Build tooling and configuration
- SQL - Database queries via Prisma ORM

## Runtime

**Environment:**
- Node.js 20.x - Required runtime (specified in package.json engines)

**Package Manager:**
- pnpm 9.15.0 - Primary package manager
- Lockfile: `pnpm-lock.yaml` - Present

## Frameworks

**Core:**
- Next.js 14.2.10 - Full-stack React framework for routing, SSR, and API routes
- React 18.3.1 - UI library for component rendering

**UI & Styling:**
- Tailwind CSS 3.4.14 - Utility-first CSS framework for styling
- Radix UI 1.x - Component primitives (popover, slots, icons, tabs)
  - `@radix-ui/react-icons` 1.3.1
  - `@radix-ui/react-popover` 1.1.3
  - `@radix-ui/react-slot` 1.0.2
  - `@radix-ui/react-tabs` 1.1.1

**Form Management:**
- React Hook Form 7.53.0 - Form state management and validation
- `@hookform/resolvers` 3.3.4 - Zod and other validation library integrations

**Testing:**
- Vitest 1.6.0 - Unit test runner (Node environment)
- Config: `vitest.config.ts`

**Build/Dev:**
- PostCSS 8.4.47 - CSS processing pipeline
- Autoprefixer 10.4.20 - CSS vendor prefixing
- ESLint 8.57.1 - Code linting (Next.js config)
- tsx 4.17.0 - TypeScript execution for Node scripts

## Key Dependencies

**Critical:**
- `@prisma/client` 5.20.0 - Database ORM and query builder
  - Prisma schema in `prisma/schema.prisma`
  - Code generation for type-safe database access
- `next-auth` 4.24.7 - Authentication and session management
  - Credentials provider for email/password auth
  - JWT strategy for sessions
- `zod` 3.23.8 - Schema validation and parsing
  - Used in environment validation (`src/env.ts`)
  - Used throughout API routes for request validation

**Infrastructure:**
- `@aws-sdk/client-s3` 3.637.0 - AWS S3 client for file storage
- `@aws-sdk/s3-request-presigner` 3.637.0 - Presigned URL generation for S3
- `resend` 4.0.0 - Email service for transactional emails
- `bcryptjs` 2.4.3 - Password hashing for authentication

**Utilities:**
- `date-fns` 3.6.0 - Date manipulation and formatting
- `react-day-picker` 9.1.4 - Date picker component
- `lucide-react` 0.441.0 - SVG icon library
- `papaparse` 5.5.3 - CSV parsing (used for skill imports)
- `class-variance-authority` 0.7.0 - CSS class composition for component variants
- `clsx` 2.1.1 - Conditional className utility
- `tailwind-merge` 2.2.1 - Merge Tailwind classes intelligently
- `@react-pdf/renderer` 3.4.4 - PDF generation from React components

**Type Definitions:**
- `@types/node` 20.16.5
- `@types/react` 18.3.4
- `@types/react-dom` 18.3.0
- `@types/bcryptjs` 2.4.6
- `@types/papaparse` 5.5.2

## Configuration

**Environment:**
- Primary: `.env` file (git-ignored)
- Example: `.env.example` - Template with all required variables
- Runtime validation: `src/env.ts` - Zod schema validates critical variables at startup
  - `DATABASE_URL` - PostgreSQL connection string (required)
  - `NEXTAUTH_SECRET` - Session encryption secret (required)
  - `NEXTAUTH_URL` - App URL for callback (optional, defaults based on environment)
  - `HOST_EMAIL` - Default admin email (optional)
  - `HOST_NAME` - Admin display name (optional)

**Build:**
- `next.config.mjs` - Next.js configuration
  - Server action body size limit: 1MB
- `tailwind.config.ts` - Tailwind CSS configuration
  - Content paths for component scanning
  - Custom color palette and animations
- `postcss.config.mjs` - PostCSS and autoprefixer configuration
- `tsconfig.json` - TypeScript compiler options
  - Target: ES2017
  - Module resolution: bundler
  - Base path aliases: `@/*` → `./src/*`
  - JSX: preserve (Next.js handles transformation)

## Platform Requirements

**Development:**
- Node.js 20.x or compatible
- pnpm 9.15.0+ for package management
- PostgreSQL database (via `DATABASE_URL`)
- AWS S3 or S3-compatible storage bucket credentials
- NEXTAUTH_SECRET for session encryption
- Resend API key for email functionality

**Production:**
- Node.js 20.x runtime
- PostgreSQL database
- AWS S3 bucket for file storage (or compatible S3 endpoint)
- Email service (Resend) for transactional emails
- Deployment platform: Next.js supports Vercel, self-hosted Node servers, containerized deployments

---

*Stack analysis: 2026-02-01*

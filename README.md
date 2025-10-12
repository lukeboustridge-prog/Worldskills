# WorldSkills Skill Advisor Tracker

WorldSkills Skill Advisor Tracker is a full-stack Next.js 14 application that helps Skill Advisors (SA) and Skill Competition Managers (SCM) collaborate on competition deliverables, gates, and communication.

## Features

- 🔐 Email/password authentication with [NextAuth (Auth.js)] and Prisma-backed user accounts.
- 🆕 Self-service account registration with secure password hashing.
- 👥 Role-based permissions for Skill Advisors and Skill Competition Managers.
- 📋 CRUD management for Skills, Deliverables, and Gates backed by Prisma ORM and Neon PostgreSQL.
- 💬 Messaging workspace for each skill with an auditable activity log.
- 📊 Dashboard views tailored to each role with progress summaries.
- 🎨 Responsive UI built with Tailwind CSS and shadcn/ui-inspired components.

## Tech stack

- [Next.js 14](https://nextjs.org/) with the App Router and TypeScript
- [Prisma](https://www.prisma.io/) ORM connected to Neon PostgreSQL
- [NextAuth](https://authjs.dev/) for authentication
- Tailwind CSS and Radix UI primitives for styling
- pnpm for dependency and script management

## Getting started

### Prerequisites

- Node.js 22.x (Vercel now builds this project on the Node 22 runtime)
- pnpm 9.15 (installed via [`corepack`](https://nodejs.org/api/corepack.html) or `npm i -g pnpm`)
- A Neon PostgreSQL database URL

### 1. Clone and install

```bash
pnpm install
```

> The repository ships with a `package.json` that references all required dependencies. Running `pnpm install` will generate the `pnpm-lock.yaml` file locally.

### 2. Configure environment

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL connection string (`?sslmode=require` recommended). |
| `NEXTAUTH_SECRET` | Long random string used to sign NextAuth JWTs. |
| `NEXTAUTH_URL` | Application URL (e.g. `http://localhost:3000` for local dev). |
| `HOST_EMAIL` | Primary Skill Advisor email. This account is treated as the host/admin and always receives the SA role. |
| `HOST_NAME` | Optional. Display name for the host Skill Advisor (defaults to `Luke Boustridge`). |
| `HOST_INITIAL_PASSWORD` | Optional. Plaintext password assigned to the host account during seeding (defaults to `ChangeMe123!`). |

> **Note:** The optional `HOST_INITIAL_PASSWORD` is only used when the seed script creates the host account. Update the password after logging in or rerun the seed with a new value whenever you need to rotate it.

### 3. Generate the Prisma client & run migrations

For local development (this will create the Auth.js tables—`Account`, `Session`, `VerificationToken`—alongside the domain models):

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

When deploying to Vercel, the default build script automatically runs `prisma migrate deploy` after generating the client, so your production database stays in sync with the schema.

### 4. (Optional) Seed sample data

A lightweight seed script creates one SA, one SCM, and all 64 WorldSkills Competition 2026 skills:

- The SA uses the `HOST_EMAIL` value (defaults to `luke.boustridge@gmail.com`) and the name defined by `HOST_NAME`.
- The SA password defaults to `HOST_INITIAL_PASSWORD` (or `ChangeMe123!` when unset).
- Additional Skill Advisor records are provisioned for Dave Summerville, Sue Collins, Sue Lefort, Vesa Iltola, Steve Brooks, Jeff Boulton, and Arwid Wibom so they are available in dropdowns. These placeholder accounts use addresses like `dave.summerville@worldskills-sa.test` and can be updated later with real credentials.
- The SCM remains `scm@example.com` with password `SamplePassword123!` for exploration purposes (every skill is temporarily assigned to this SCM until you reassign it).

```bash
pnpm prisma:seed
```

### 5. Start the development server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to create an account or sign in with an existing one. The address defined by `HOST_EMAIL`
is always granted the Skill Advisor role, and the seed script creates a default SCM user (`scm@example.com` / `SamplePassword123!`) so you can explore the UI locally with all seeded skills.

## Running tests & linting

```bash
pnpm lint
```

(Additional automated tests can be added in future iterations.)

## Deployment

1. Push the repository to GitHub.
2. Create a new Vercel project from the repository.
3. Set the following environment variables in Vercel:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (e.g. `https://your-vercel-app.vercel.app`)
   - `HOST_EMAIL`
   - Optional: `HOST_NAME` (display name for the host Skill Advisor)
   - Optional: `HOST_INITIAL_PASSWORD` (if you want to set the host password during seeding)
4. Trigger a deployment. The build pipeline runs `pnpm build`, which in turn executes `prisma generate`, `prisma migrate deploy`, and `next build` so your Neon database is migrated during the build step.
   - Vercel detects the pinned pnpm version from `package.json`/`packageManager` and runs `pnpm install` on its Node.js 22 runtime, matching the local toolchain without extra Corepack steps.
5. For additional safety you can also run `pnpm prisma:deploy` locally or via CI prior to the first deploy.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Next.js dev server. |
| `pnpm build` | Generate Prisma client and create an optimized production build. |
| `pnpm start` | Start the production server. |
| `pnpm lint` | Run ESLint using Next.js configuration. |
| `pnpm prisma:generate` | Regenerate the Prisma client. |
| `pnpm prisma:migrate` | Apply migrations locally (`prisma migrate dev`). |
| `pnpm prisma:deploy` | Apply migrations in production (`prisma migrate deploy`). |
| `pnpm prisma:seed` | Seed the database with sample users and the WSC 2026 skill list. |

## Project structure

```
src/
  app/
    (auth)/login           # Auth flow
    (dashboard)/*          # Protected dashboard routes
    api/auth/[...nextauth] # NextAuth handler
  components/              # shadcn-inspired UI primitives & layout components
  lib/                     # Auth, Prisma client, utilities
prisma/
  schema.prisma            # Database models
  seed.ts                  # Seed script
```

## Notes

- Deliverable state changes, evidence submissions, gate updates, and chat messages all write to the `ActivityLog` table for auditability.
- Only Skill Advisors can adjust deliverable states or gate statuses. SCMs can add evidence links and messages.
- Uploads are tracked as evidence URLs (file storage integration can be added later).
- A tracked `public/` directory is available for static assets.
- The included `vercel.json` enforces the `.next` build output so Vercel reuses the same pnpm 9.15 toolchain as local development on Node 22.

## License

This project is released under a proprietary “All rights reserved” license. See [LICENSE](./LICENSE) for details.

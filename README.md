# WorldSkills Skill Advisor Tracker

WorldSkills Skill Advisor Tracker is a full-stack Next.js 14 application that helps Skill Advisors (SA) and Skill Competition Managers (SCM) collaborate on competition deliverables, gates, and communication.

## Features

- 🔐 Passwordless authentication with [NextAuth (Auth.js)] using email magic links.
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

- Node.js 18.18 or newer
- pnpm 8+ (installed via [`corepack`](https://nodejs.org/api/corepack.html) or `npm i -g pnpm`)
- A Neon PostgreSQL database URL
- SMTP credentials for sending login links (any provider supported by Nodemailer)

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
| `EMAIL_SERVER` | SMTP connection string used by Nodemailer (e.g. `smtp://user:pass@smtp.example.com:587`). |
| `EMAIL_FROM` | Friendly from address for outgoing magic link emails. |

### 3. Generate the Prisma client & run migrations

For local development:

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

When deploying to Vercel, use `pnpm prisma:deploy` in a build hook so migrations run in production.

### 4. (Optional) Seed sample data

A lightweight seed script creates one SA, one SCM, and an example skill:

```bash
pnpm prisma:seed
```

### 5. Start the development server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to sign in with your configured email. Magic link emails are sent using the SMTP settings above (the link is also logged to the server console when SMTP is absent).

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
   - `EMAIL_SERVER`
   - `EMAIL_FROM`
4. Configure the build command to `pnpm install && pnpm prisma:deploy && pnpm build` (Vercel automatically runs `pnpm install` and `pnpm build`; the Prisma deploy step can be added as a [Project Command Override](https://vercel.com/docs/projects/project-configuration#build-and-development-settings)).
5. Ensure the Neon database has the latest schema by running `pnpm prisma:deploy` locally or via a CI workflow before the first deploy.

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
| `pnpm prisma:seed` | Seed the database with sample users and a skill. |

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
- The included `vercel.json` enforces the correct Next.js build output (`.next`) so Vercel serves the application runtime instead of a static 404.

## License

This project is released under a proprietary “All rights reserved” license. See [LICENSE](./LICENSE) for details.

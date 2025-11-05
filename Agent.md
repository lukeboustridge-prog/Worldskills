# AGENT.md
## Project: WorldSkills App

### Purpose
WorldSkills App is a Node/Next.js web application that supports WorldSkills operations — tracking Skill Advisors, Skill Competitions, and related data.  
It uses a modern TypeScript stack and deploys to Vercel.

---

## Tech Stack
- Framework: Next.js (App Router)
- Language: TypeScript
- Database: Neon (Postgres)
- ORM: Prisma
- Package manager: pnpm
- Deployment: Vercel
- Storage: **Cloudflare R2 (S3-compatible)** — replaces Vercel Blob

---

## Current Objective
Migrate all file storage and upload functionality from **Vercel Blob** to **Cloudflare R2**.

**Key Tasks:**
1. Remove any `@vercel/blob` imports or `put()` usage.
2. Use `@aws-sdk/client-s3` for uploads and downloads.
3. Implement shared R2 client at `lib/r2.ts`:
   ```ts
   import { S3Client } from "@aws-sdk/client-s3";
   export const r2 = new S3Client({
     region: "auto",
     endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
     credentials: {
       accessKeyId: process.env.R2_ACCESS_KEY_ID!,
       secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
     },
   });


Update /app/api/upload/route.ts to use PutObjectCommand.

Environment Variables
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_REGION=auto
DATABASE_URL=
NEXTAUTH_SECRET=

Deployment Notes

Node version: 20.x (defined in package.json)

Remove or fix any invalid "runtime": "nodejs" entries in vercel.json.
Valid runtime format: "nodejs20.x"

Vercel project auto-builds from GitHub main branch.

File Paths of Interest

lib/r2.ts — Cloudflare R2 client

app/api/upload/route.ts — file upload API

prisma/schema.prisma — database model

.env — environment configuration

Output Expectations

When Codex runs:

Detect any old Vercel Blob usage and replace it with Cloudflare R2.

Keep all imports and types consistent with existing TypeScript.

Avoid long logs or verbose explanations — just apply the change.

Example upload response
{
  "key": "1730810929123-roofphoto.jpg",
  "url": "https://<ACCOUNT_ID>.r2.cloudflarestorage.com/worldskills-app-uploads/1730810929123-roofphoto.jpg"
}

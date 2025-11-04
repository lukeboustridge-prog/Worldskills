# Codex Agent Guide – WorldSkills Skill Advisor Tracker

## Purpose
This document defines the operational scope for Codex when assisting with this project.  
The goal is to keep Codex tasks focused, efficient, and low-cost.

---

## Project Overview
- Framework: **Next.js 14 (App Router)**
- Deployment: **Vercel**
- Database: **Neon (PostgreSQL) via Prisma**
- Auth: **NextAuth / session-based**
- Storage: **Vercel Blob** (with optional fallback to S3)
- Environment: **Vercel + local dev**

The app tracks WorldSkills deliverables, gates, and communications between Skill Advisors (SA) and Skill Competition Managers (SCM).

---

## Codex Operating Rules

### 1. Default Scope
Codex edits are limited to:
- The `app/api/(node)/storage/*` API routes.
- The associated upload UI component.
- Environment diagnostics helpers under `lib/storage/`.

Do **not** refactor unrelated files (auth, prisma, UI, or tests) unless specifically requested.

### 2. Runtime Requirements
- All storage routes must run under **Node.js** runtime, not Edge.
- Node runtime is set in `app/api/(node)/layout.ts`:
  ```ts
  export const runtime = 'nodejs';
  export const dynamic = 'force-dynamic';
  export const revalidate = 0;
  ```
- The public API path (`/api/storage/...`) re-exports from `(node)` routes.

### 3. Storage Provider Logic
- Default provider: **vercel-blob**
- Fallback: **S3** if `STORAGE_PROVIDER=s3` or Blob runtime unavailable.
- Environment variables:
  ```
  BLOB_READ_WRITE_TOKEN=<token>
  FILE_STORAGE_BUCKET=<bucket>
  FILE_STORAGE_REGION=<region>
  FILE_STORAGE_ACCESS_KEY_ID=<key>
  FILE_STORAGE_SECRET_ACCESS_KEY=<secret>
  ```
- All presign routes must handle both providers gracefully.

### 4. Prompt Size
Codex jobs must be **small, single-purpose edits**:
- Avoid full repo discovery.
- Focus on specific files.
- Provide diffs, not rebuilds.
- Prefer localised fixes (e.g., “update presign route headers” or “adjust upload size validation”).

### 5. Logging
- Use `console.info` for key operational logs (env, provider, size).
- Never log secrets.
- Logs should prefix with `[storage/... ]`.

### 6. Error Handling
Return structured JSON from routes:
```json
{
  "error": "presign_failed",
  "message": "Human-readable message",
  "provider": "vercel-blob"
}
```

### 7. Testing / Verification
After each change:
1. Check Vercel **Functions** → `/api/storage/presign` → Runtime must be Node.js.
2. Upload a 200–300 KB PDF — confirm:
   ```
   [storage/presign] presign-success { provider: 'vercel-blob' }
   ```
3. If Blob helper unavailable, fallback to S3 provider and report.

---

## Example Lightweight Prompts

### a) Adjust upload size validation
> “Edit `app/api/(node)/storage/presign/route.ts` to set 25 MB limit and log received size.”

### b) Add S3 fallback header support
> “In the presign route, include `requiredHeaders` in JSON response and make the client send them.”

### c) Ensure Node runtime
> “Create `app/api/(node)/layout.ts` exporting runtime = 'nodejs' and update wrappers.”

---

## Version Control
Codex must:
- Commit only the files changed.
- Use clear messages, e.g.  
  `fix(storage): force Node runtime for presign route`.

---

**Maintainer:** Luke Boustridge  
**Last updated:** 2025-11-04

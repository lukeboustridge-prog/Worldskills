# Phase 6: WSOS Section Management - Research

**Researched:** 2026-02-04
**Domain:** Simple CRUD management with PostgreSQL trigram-based duplicate detection
**Confidence:** HIGH

## Summary

This phase implements a straightforward CRUD interface for SCMs to manage WSOS sections - organizational categories for descriptors. The system needs to prevent duplicate section names using pg_trgm similarity matching, following the exact pattern already established for descriptor duplicate detection in this codebase.

The research confirms that all required infrastructure exists: pg_trgm extension is installed, trigram similarity patterns are battle-tested in descriptor management (DESC-012, DESC-023), and the codebase has clear CRUD patterns in ResourceLink and SCMQuestion management. This phase requires creating a new database table, a simple management UI, and reusing existing duplicate detection logic with adjusted similarity thresholds.

**Primary recommendation:** Create WSOSSection model following existing patterns, build SCM-only management interface at /settings/wsos-sections using ResourceLink UI pattern, reuse duplicate detection utilities with 0.3 threshold tuned for short section names.

## Standard Stack

All required technologies are already in the project. No new dependencies needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL pg_trgm | bundled | Trigram similarity matching | Already installed and used for descriptor duplicate detection (DESC-012) |
| Prisma | 5.20.0 | ORM and schema management | Project standard, handles migrations and type generation |
| Next.js 14 | 14.2.10 | Server Actions, routing | Project framework for all CRUD operations |
| React 18 | 18.3.1 | UI components | Project UI library |
| NextAuth | 4.24.7 | Authentication/authorization | Already handles SCM role checking |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.23.8 | Schema validation | Server Action input validation (all actions use this) |
| Radix UI | Various | Accessible UI primitives | Project standard for dialogs, forms, buttons |
| lucide-react | 0.441.0 | Icon library | Project standard for UI icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_trgm | Levenshtein distance | pg_trgm already installed, indexed, and battle-tested in codebase |
| Server Actions | API routes | Server Actions are project standard, simpler, better DX |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
prisma/
├── schema.prisma          # Add WSOSSection model
├── migrations/
    └── XXXX_wsos_sections/ # New migration

src/
├── app/
│   └── (dashboard)/
│       └── settings/
│           └── wsos-sections/
│               ├── page.tsx     # List + Create form (like resources/page.tsx)
│               └── actions.ts   # Server Actions (create, update, delete)
├── lib/
│   └── wsos-sections.ts        # Query utilities (getAllSections, findSimilar)
└── components/
    └── wsos/
        └── duplicate-warning.tsx # Reuse pattern from descriptors/duplicate-warning.tsx
```

### Pattern 1: Prisma Model with Trigram Index
**What:** Database table with GIN trigram index for similarity queries
**When to use:** Always for WSOS sections to enable duplicate detection
**Example:**
```typescript
// prisma/schema.prisma
model WSOSSection {
  id          String   @id @default(cuid())
  name        String   @unique // Unique constraint prevents exact duplicates
  description String?  @db.Text
  createdAt   DateTime @default(now())
  createdBy   String   // User ID who created it
  updatedAt   DateTime @updatedAt

  creator User @relation("WSOSSectionCreator", fields: [createdBy], references: [id])

  @@index([name]) // B-tree for exact lookups
}

// In migration SQL:
// CREATE INDEX wsos_section_name_trgm ON "WSOSSection" USING GIN (name gin_trgm_ops);
```

### Pattern 2: Server Actions with Zod Validation
**What:** Form handlers using Server Actions pattern from ResourceLink
**When to use:** All create/update/delete operations
**Example:**
```typescript
// Source: Existing pattern from src/app/(dashboard)/settings/resources/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSectionSchema = z.object({
  name: z.string().min(3, "Section name must be at least 3 characters"),
  description: z.string().optional(),
});

export async function createWSOSSectionAction(formData: FormData) {
  const user = await requireUser();

  // Check if user is SCM
  if (user.role !== "SCM" && !user.isAdmin) {
    throw new Error("Only SCMs can create WSOS sections");
  }

  const parsed = createSectionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]?.message ?? "Invalid input";
    const params = new URLSearchParams({ error: firstError });
    return redirect(`/settings/wsos-sections?${params.toString()}`);
  }

  try {
    await prisma.wSOSSection.create({
      data: {
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        createdBy: user.id,
      },
    });
  } catch (error) {
    // Handle unique constraint violation
    if ((error as any)?.code === "P2002") {
      const params = new URLSearchParams({ error: "A section with this name already exists" });
      return redirect(`/settings/wsos-sections?${params.toString()}`);
    }
    throw error;
  }

  revalidatePath("/settings/wsos-sections");
  const params = new URLSearchParams({ created: "1" });
  return redirect(`/settings/wsos-sections?${params.toString()}`);
}
```

### Pattern 3: Similarity Detection for Duplicate Warning
**What:** Trigram similarity query using pg_trgm exactly like descriptor duplicate detection
**When to use:** Before creating/editing section to warn user of similar names
**Example:**
```typescript
// Source: Existing pattern from src/lib/duplicate-detection.ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface SimilarSection {
  id: string;
  name: string;
  similarity: number;
}

/**
 * Find WSOS sections with similar names using pg_trgm trigram similarity.
 * Returns sections with similarity > threshold, ordered by similarity DESC.
 *
 * @param name - The section name to compare against
 * @param threshold - Minimum similarity score (0-1), default 0.3
 * @param excludeId - Optional ID to exclude (for edit mode)
 * @param limit - Maximum results to return, default 5
 */
export async function findSimilarWSOSSections(
  name: string,
  threshold = 0.3,
  excludeId?: string,
  limit = 5
): Promise<SimilarSection[]> {
  if (!name || name.length < 3) {
    return [];
  }

  const baseQuery = Prisma.sql`
    SELECT
      id,
      name,
      similarity(name, ${name}) as similarity
    FROM "WSOSSection"
    WHERE
      similarity(name, ${name}) > ${threshold}
  `;

  const fullQuery = excludeId
    ? Prisma.sql`${baseQuery} AND id != ${excludeId} ORDER BY similarity DESC LIMIT ${limit}`
    : Prisma.sql`${baseQuery} ORDER BY similarity DESC LIMIT ${limit}`;

  const similar = await prisma.$queryRaw<SimilarSection[]>(fullQuery);
  return similar;
}
```

### Pattern 4: Single-Page CRUD with Inline Edit
**What:** List + Create form on same page, edit via query param ?edit=ID
**When to use:** Simple entity management (ResourceLink pattern)
**Example:**
```typescript
// Source: Existing pattern from src/app/(dashboard)/settings/resources/page.tsx
export default async function WSOSSectionsPage({
  searchParams,
}: {
  searchParams?: {
    error?: string;
    created?: string;
    edit?: string;
  };
}) {
  const user = await requireUser();

  // Check if user is SCM or Admin
  if (user.role !== "SCM" && !user.isAdmin) {
    redirect("/dashboard");
  }

  const sections = await prisma.wSOSSection.findMany({
    orderBy: { name: "asc" },
    include: {
      creator: { select: { name: true, email: true } },
    },
  });

  const editingId = searchParams?.edit;
  const editingSection = editingId
    ? sections.find((s) => s.id === editingId)
    : null;

  return (
    <div className="space-y-6">
      {/* Success/Error messages */}

      {/* Create/Edit Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            {editingSection ? "Edit Section" : "Create New Section"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={editingSection ? updateAction : createAction}>
            {/* Form fields */}
          </form>
        </CardContent>
      </Card>

      {/* List of Sections */}
      <Card>
        <CardHeader>
          <CardTitle>Existing WSOS Sections</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Section list with Edit/Delete buttons */}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Separate pages for create/edit:** Project uses inline editing via query params, not separate routes
- **Client-side state management:** Use Server Components and Server Actions, not useState/useEffect for CRUD
- **API routes for CRUD:** Project uses Server Actions exclusively, not /api routes
- **Manual SQL without Prisma.sql:** Use Prisma.sql template literals for parameterization and safety

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate detection | Custom string comparison | pg_trgm similarity() function | Already indexed, tested, handles typos/abbreviations |
| Form validation | Manual checks | Zod schemas in Server Actions | Type-safe, consistent error handling, project standard |
| Role checking | if/else logic | requireUser() + role checks | Consistent auth pattern used throughout codebase |
| Similar name warnings | Exact match only | Trigram similarity with 0.3 threshold | Catches "WSOS Section" vs "WSOS Sections", "Database" vs "Data Base" |

**Key insight:** This codebase has battle-tested patterns for exactly this use case. DESC-012 decision documented dual GIN index strategy, DESC-023 set 0.3 threshold. Reuse, don't recreate.

## Common Pitfalls

### Pitfall 1: Wrong Similarity Threshold for Short Names
**What goes wrong:** Using 0.4 threshold (from descriptor duplicate detection) misses similar short section names
**Why it happens:** Trigram similarity is less effective on short strings (< 5 chars). "AI" vs "API" = 0 similarity with trigrams.
**How to avoid:** Use 0.3 threshold (pg_trgm default) for section names, warn user even on moderate similarity
**Warning signs:** User creates "Database Security" when "Database security" already exists

### Pitfall 2: Missing GIN Index in Migration
**What goes wrong:** Similarity queries are slow (sequential scan) without trigram index
**Why it happens:** Prisma doesn't generate GIN trigram indexes automatically - must add to migration SQL
**How to avoid:** After prisma migrate dev, manually add to migration file:
```sql
CREATE INDEX wsos_section_name_trgm ON "WSOSSection" USING GIN (name gin_trgm_ops);
```
**Warning signs:** Query logs show "Seq Scan on WSOSSection" instead of "Index Scan using wsos_section_name_trgm"

### Pitfall 3: Not Checking Role Before CRUD
**What goes wrong:** Any authenticated user can create sections, not just SCMs
**Why it happens:** requireUser() only checks authentication, not role
**How to avoid:** After requireUser(), explicitly check user.role === "SCM" || user.isAdmin
**Warning signs:** Test with non-SCM user account, can still access management page

### Pitfall 4: Forgetting Revalidation After Mutations
**What goes wrong:** Section list doesn't update after create/edit/delete without page refresh
**Why it happens:** Next.js caches Server Component renders
**How to avoid:** Call revalidatePath() after every mutation in Server Actions
**Warning signs:** User creates section, redirected back, but new section doesn't appear in list

### Pitfall 5: Not Trimming Input Before Comparison
**What goes wrong:** " Security" and "Security" treated as different sections
**Why it happens:** Whitespace affects both exact matching and similarity scoring
**How to avoid:** Always .trim() form inputs before create/update and similarity checks
**Warning signs:** Duplicate detection doesn't warn about "  Database  " vs "Database"

## Code Examples

Verified patterns from official sources and existing codebase:

### Creating Migration with Trigram Index
```sql
-- Source: PostgreSQL pg_trgm documentation + existing descriptor indexes
-- In prisma/migrations/XXXX_wsos_sections/migration.sql

-- Create table (generated by Prisma)
CREATE TABLE "WSOSSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WSOSSection_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX "WSOSSection_name_key" ON "WSOSSection"("name");

-- Create B-tree index for exact lookups
CREATE INDEX "WSOSSection_name_idx" ON "WSOSSection"("name");

-- Create GIN trigram index for similarity queries (MANUALLY ADD THIS)
CREATE INDEX wsos_section_name_trgm ON "WSOSSection" USING GIN (name gin_trgm_ops);

-- Foreign key
ALTER TABLE "WSOSSection" ADD CONSTRAINT "WSOSSection_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

### Client-Side Duplicate Check Before Submit
```typescript
// Source: Pattern adapted from descriptor create flow
// In src/app/(dashboard)/settings/wsos-sections/page.tsx

"use client";

import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";

export function CreateSectionForm() {
  const [name, setName] = useState("");
  const [similar, setSimilar] = useState<SimilarSection[]>([]);

  const checkSimilar = useDebouncedCallback(async (value: string) => {
    if (value.length < 3) {
      setSimilar([]);
      return;
    }

    const response = await fetch(
      `/api/wsos-sections/check-similar?name=${encodeURIComponent(value)}`
    );
    const data = await response.json();
    setSimilar(data.similar);
  }, 500);

  return (
    <form>
      <Input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          checkSimilar(e.target.value);
        }}
      />

      {similar.length > 0 && (
        <DuplicateWarning similar={similar} />
      )}

      <Button type="submit">Create Section</Button>
    </form>
  );
}
```

### Query All Sections with Creator Info
```typescript
// Source: Pattern from existing codebase
// In src/lib/wsos-sections.ts

export async function getAllWSOSSections() {
  return prisma.wSOSSection.findMany({
    orderBy: { name: "asc" },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export type WSOSSectionWithCreator = Awaited<ReturnType<typeof getAllWSOSSections>>[number];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Exact string matching | Trigram similarity (pg_trgm) | Descriptor phase (DESC-012) | Catches typos, plurals, abbreviations |
| API routes for CRUD | Server Actions | Next.js 13+ | Simpler, better error handling, progressive enhancement |
| useState for forms | Server Components + FormData | Next.js 13+ | Less client JS, better accessibility |
| Custom auth middleware | NextAuth with requireUser() | Project foundation | Consistent, session-based auth |

**Deprecated/outdated:**
- **Separate /api/wsos-sections routes:** Use Server Actions (createWSOSSectionAction) instead
- **Client-side form libraries:** Project uses native forms with Server Actions, not react-hook-form for simple CRUD

## Open Questions

None. All patterns are established and verified in the existing codebase.

## Sources

### Primary (HIGH confidence)
- PostgreSQL pg_trgm documentation - https://www.postgresql.org/docs/current/pgtrgm.html (similarity function, thresholds, indexes)
- Existing codebase patterns:
  - `src/lib/duplicate-detection.ts` (trigram similarity implementation)
  - `src/app/(dashboard)/settings/resources/` (CRUD UI pattern)
  - `src/app/(dashboard)/settings/descriptors/actions.ts` (Server Actions pattern)
  - `src/lib/auth.ts` (role checking with requireUser)
  - `prisma/schema.prisma` (model patterns, indexes)

### Secondary (MEDIUM confidence)
- [Next.js Server Actions Guide 2026](https://dev.to/marufrahmanlive/nextjs-server-actions-complete-guide-with-examples-for-2026-2do0)
- [Next.js Official Server Actions Documentation](https://nextjs.org/docs/app/getting-started/updating-data)
- [PostgreSQL pg_trgm Best Practices](https://alexklibisz.com/2022/02/18/optimizing-postgres-trigram-search)

### Tertiary (LOW confidence)
None - all critical information verified from primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already in project, versions verified from package.json
- Architecture: HIGH - Patterns verified from existing codebase files (resources, descriptors, SCM questions)
- Pitfalls: HIGH - Based on actual pg_trgm behavior and Next.js 14 Server Actions documentation
- Duplicate detection: HIGH - pg_trgm similarity() is battle-tested in this codebase (DESC-012, DESC-023)

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable technologies, unlikely to change)

## Key Implementation Notes for Planner

1. **No new npm packages needed** - everything already installed
2. **pg_trgm extension confirmed installed** - already used for descriptors
3. **Role check pattern:** `user.role === "SCM" || user.isAdmin` after requireUser()
4. **Similarity threshold:** Use 0.3 (not 0.4 from descriptors) for shorter section names
5. **UI pattern:** Follow ResourceLink page structure exactly (single page, inline edit via ?edit=id)
6. **Migration checklist:** After Prisma generates migration, manually add GIN trigram index to SQL
7. **Revalidation paths:** `/settings/wsos-sections` after all mutations

# Phase 2: Admin Curation - Research

**Researched:** 2026-02-01
**Domain:** Next.js 14 Server Actions CRUD, Zod validation, PostgreSQL duplicate detection, soft delete patterns
**Confidence:** HIGH

## Summary

Phase 2 implements admin curation functionality allowing admins to manually create, edit, delete, and quality-control descriptors in the library. This phase builds on the imported data from Phase 1 and enables manual refinement before public access in later phases.

The standard approach leverages Next.js 14 App Router with Server Actions for CRUD operations, Zod for server-side form validation, PostgreSQL's pg_trgm extension for duplicate detection via trigram similarity matching, and a soft delete pattern with deletedAt timestamps for audit trail preservation. The codebase already follows this pattern (see resources management) with Radix UI primitives and custom form handling.

Research confirms that: (1) Next.js Server Actions with Zod validation provide type-safe form handling without additional libraries like react-hook-form, (2) PostgreSQL's pg_trgm extension offers performant similarity matching (0.3ms with GIN indexes) for duplicate detection, (3) soft delete with nullable deletedAt timestamps is preferred over boolean flags for audit compliance, (4) quality indicators should be stored as enums rather than booleans for future extensibility, and (5) tags as String[] arrays with GIN indexes outperform JSONB for simple tag lists.

**Primary recommendation:** Follow existing resource management patterns (Server Actions + Zod + redirect with query params), add pg_trgm extension for similarity-based duplicate detection, implement soft delete with deletedAt + deletedBy fields, add QualityIndicator enum field to schema, and use native HTML dialog element or add shadcn/ui AlertDialog for delete confirmations.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js Server Actions | 14.2.10 | Form mutations and CRUD | Already in project, built-in to App Router, no client-side state needed |
| Zod | 3.23.8+ | Server-side validation | Already in project, type-safe schemas, integrates with Server Actions |
| Prisma ORM | 5.22.0+ | Database operations | Already in project, type-safe CRUD, migration management |
| PostgreSQL pg_trgm | Extension | Duplicate detection | Native PostgreSQL extension, trigram similarity, GIN index support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Radix UI primitives | 1.x | Accessible UI components | Already in project for popover/tabs/icons |
| shadcn/ui patterns | N/A | Pre-built component patterns | Optional: add AlertDialog for delete confirmations if needed |
| Lucide React | 0.441.0+ | Icons (Pencil, Trash2, Plus) | Already in project, used in existing CRUD UIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server Actions | react-hook-form + API routes | Server Actions are simpler, less client-side code, built-in to Next.js 14 |
| pg_trgm similarity | Levenshtein distance (fuzzystrmatch) | pg_trgm with GIN indexes is faster (0.3ms vs 150ms), better for batch operations |
| String[] for tags | JSONB arrays | JSONB adds storage overhead, String[] has better PostgreSQL statistics for @> operator |
| Enum for quality | Boolean isExcellent | Enum allows future extension (Excellent/Good/Reference/Needs Review) |

**Installation:**
```bash
# Enable pg_trgm extension via Prisma migration
# All other dependencies already in project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── (dashboard)/
│       └── admin/
│           └── descriptors/
│               ├── page.tsx              # List view with search/filter
│               ├── create/
│               │   └── page.tsx          # Create form page
│               ├── [id]/
│               │   ├── edit/
│               │   │   └── page.tsx      # Edit form page
│               │   └── actions.ts        # Server actions (edit/delete)
│               └── actions.ts            # Server actions (create/list)
├── lib/
│   ├── descriptors.ts                    # Query functions
│   └── duplicate-detection.ts            # Similarity search utilities
└── components/
    └── descriptors/
        ├── descriptor-form.tsx           # Shared form component
        ├── descriptor-list.tsx           # Table/list display
        ├── delete-confirmation.tsx       # Delete dialog
        └── duplicate-warning.tsx         # Similar descriptor alert
```

### Pattern 1: Server Action CRUD with Zod Validation
**What:** Next.js Server Actions with Zod schemas for type-safe form validation
**When to use:** All form submissions (create, update, delete)
**Example:**
```typescript
// Source: Existing pattern in src/app/(dashboard)/settings/resources/actions.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const descriptorSchema = z.object({
  code: z.string().min(1, "Code is required"),
  criterionName: z.string().min(3, "Criterion name must be at least 3 characters"),
  excellent: z.string().optional(),
  good: z.string().optional(),
  pass: z.string().optional(),
  belowPass: z.string().optional(),
  skillName: z.string().min(1, "Source skill is required"),
  sector: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  qualityIndicator: z.enum(['EXCELLENT', 'GOOD', 'REFERENCE', 'NEEDS_REVIEW']).optional(),
}).refine(
  (data) => data.excellent || data.good || data.pass || data.belowPass,
  { message: "At least one performance level is required" }
)

export async function createDescriptorAction(formData: FormData) {
  await requireAdminUser()

  const parsedResult = descriptorSchema.safeParse({
    code: formData.get('code'),
    criterionName: formData.get('criterionName'),
    excellent: formData.get('excellent') || undefined,
    good: formData.get('good') || undefined,
    pass: formData.get('pass') || undefined,
    belowPass: formData.get('belowPass') || undefined,
    skillName: formData.get('skillName'),
    sector: formData.get('sector') || undefined,
    category: formData.get('category') || undefined,
    tags: formData.getAll('tags') || [],
    qualityIndicator: formData.get('qualityIndicator') || undefined,
  })

  if (!parsedResult.success) {
    const firstError = parsedResult.error.errors[0]?.message ?? 'Please review the form'
    const params = new URLSearchParams({ error: firstError })
    return redirect(`/admin/descriptors/create?${params.toString()}`)
  }

  const data = parsedResult.data

  try {
    await prisma.descriptor.create({
      data: {
        ...data,
        source: 'Manual',
        version: 1,
      },
    })
  } catch (error) {
    console.error('Failed to create descriptor', error)
    const params = new URLSearchParams({ error: 'Unable to create descriptor' })
    return redirect(`/admin/descriptors/create?${params.toString()}`)
  }

  revalidatePath('/admin/descriptors')
  const params = new URLSearchParams({ created: '1' })
  return redirect(`/admin/descriptors?${params.toString()}`)
}
```

### Pattern 2: Duplicate Detection with pg_trgm
**What:** PostgreSQL trigram similarity matching to find similar descriptors
**When to use:** Before creating/editing descriptors, warn if similar exists
**Example:**
```typescript
// Source: https://dev.to/talemul/fuzzy-string-matching-in-postgresql-with-pgtrgm-trigram-search-tutorial-2hc6
import { prisma } from '@/lib/prisma'

// Enable extension (via Prisma migration):
// CREATE EXTENSION IF NOT EXISTS pg_trgm;

interface SimilarDescriptor {
  id: string
  criterionName: string
  code: string
  skillName: string
  similarity: number
}

export async function findSimilarDescriptors(
  criterionName: string,
  threshold = 0.3
): Promise<SimilarDescriptor[]> {
  // Use raw SQL for similarity function (not exposed in Prisma)
  const similar = await prisma.$queryRaw<SimilarDescriptor[]>`
    SELECT
      id,
      "criterionName",
      code,
      "skillName",
      similarity("criterionName", ${criterionName}) as similarity
    FROM "Descriptor"
    WHERE
      similarity("criterionName", ${criterionName}) > ${threshold}
      AND "deletedAt" IS NULL
    ORDER BY similarity DESC
    LIMIT 5
  `

  return similar
}

// Usage in Server Action:
export async function checkForDuplicates(formData: FormData) {
  const criterionName = formData.get('criterionName') as string
  const similar = await findSimilarDescriptors(criterionName, 0.4)

  return { similar }
}
```

### Pattern 3: Soft Delete with Audit Trail
**What:** Mark records as deleted with timestamp and user tracking, preserve data
**When to use:** Delete operations where audit compliance or restore is needed
**Example:**
```typescript
// Schema addition (Prisma):
model Descriptor {
  // ... existing fields ...

  // Soft delete audit
  deletedAt   DateTime?
  deletedBy   String?    // User ID who deleted

  deletedByUser User? @relation("DeletedDescriptors", fields: [deletedBy], references: [id])
}

model User {
  // ... existing relations ...
  deletedDescriptors Descriptor[] @relation("DeletedDescriptors")
}

// Server Action implementation:
export async function deleteDescriptorAction(formData: FormData) {
  await requireAdminUser()
  const session = await getServerSession()

  const id = formData.get('id') as string

  try {
    await prisma.descriptor.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    })
  } catch (error) {
    // Handle error
  }

  revalidatePath('/admin/descriptors')
  const params = new URLSearchParams({ deleted: '1' })
  return redirect(`/admin/descriptors?${params.toString()}`)
}

// Query excluding soft-deleted:
const activeDescriptors = await prisma.descriptor.findMany({
  where: { deletedAt: null },
})
```

### Pattern 4: Quality Indicator Enum
**What:** Extensible enum for marking descriptor quality levels
**When to use:** Admin curation to distinguish excellent examples from reference-only
**Example:**
```typescript
// Prisma schema:
enum QualityIndicator {
  EXCELLENT        // Exemplary descriptor, showcase quality
  GOOD            // Solid descriptor, ready for use
  REFERENCE       // Use as reference, may need refinement
  NEEDS_REVIEW    // Imported, requires admin review
}

model Descriptor {
  // ... existing fields ...
  qualityIndicator QualityIndicator @default(NEEDS_REVIEW)
}

// Form select:
<select name="qualityIndicator" defaultValue={descriptor?.qualityIndicator ?? 'REFERENCE'}>
  <option value="EXCELLENT">⭐ Excellent Example</option>
  <option value="GOOD">✓ Good Quality</option>
  <option value="REFERENCE">📖 Reference Only</option>
  <option value="NEEDS_REVIEW">⚠️ Needs Review</option>
</select>
```

### Pattern 5: Tag Management with String Arrays
**What:** PostgreSQL native array field for tags with GIN indexing
**When to use:** Multi-tag categorization with filtering (already in schema)
**Example:**
```typescript
// Already in Descriptor schema:
// tags String[] @default([])

// Create GIN index (via migration):
CREATE INDEX "Descriptor_tags_idx" ON "Descriptor" USING GIN (tags);

// Form implementation (multi-input or comma-separated):
<div>
  <label>Tags (comma-separated)</label>
  <input
    name="tags"
    defaultValue={descriptor?.tags.join(', ')}
    placeholder="teamwork, safety, precision"
  />
</div>

// Parse in Server Action:
const tagsInput = formData.get('tags') as string
const tags = tagsInput
  .split(',')
  .map(tag => tag.trim())
  .filter(tag => tag.length > 0)

// Query with array contains:
const descriptors = await prisma.descriptor.findMany({
  where: {
    tags: { has: 'teamwork' },  // Single tag
    // OR
    tags: { hasSome: ['teamwork', 'safety'] },  // Any of these tags
  },
})
```

### Anti-Patterns to Avoid
- **Client-side validation only**: Always validate on server with Zod, even if client validates
- **Boolean for quality**: Use enum instead of `isExcellent: Boolean` for future flexibility
- **Hard delete**: Use soft delete with `deletedAt` for audit compliance and restore capability
- **Exact match duplicate check**: Use pg_trgm similarity (threshold 0.3-0.5) for fuzzy matching
- **JSONB for simple tag arrays**: String[] has better PostgreSQL statistics and simpler queries

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validation functions | Zod schemas | Type inference, better error messages, already in project |
| Duplicate detection | String comparison loops | PostgreSQL pg_trgm extension | 500x faster with GIN indexes (0.3ms vs 150ms), handles typos/variants |
| Soft delete queries | Manual WHERE deletedAt IS NULL | Prisma middleware or views | DRY principle, prevents accidental exposure of deleted data |
| Delete confirmation UI | Custom modal component | Native `<dialog>` or shadcn AlertDialog | Accessibility (focus trap, ESC key), WCAG compliance built-in |
| Tag input UI | Text field split on commas | Existing pattern (sufficient for v1) | Avoid premature optimization, fancy tag UI can come in Phase 4 |

**Key insight:** PostgreSQL extensions (pg_trgm) and native features (array types, GIN indexes) solve many problems better than application-level code. Leverage database capabilities before building custom solutions.

## Common Pitfalls

### Pitfall 1: Skipping Server-Side Validation
**What goes wrong:** Relying on client-side HTML validation (required, pattern) without server validation allows malicious/buggy clients to submit invalid data
**Why it happens:** Developer assumes client validation is sufficient, trusts browser behavior
**How to avoid:** Always use Zod schemas in Server Actions, treat client validation as UX enhancement only
**Warning signs:** Missing `safeParse()` in Server Actions, no error handling for validation failures

### Pitfall 2: Duplicate Detection Too Strict
**What goes wrong:** Using exact string matching for duplicates misses variants like "Teamwork skills" vs "Team work skill"
**Why it happens:** Developer uses simple `WHERE criterionName = ${input}` query
**How to avoid:** Use pg_trgm `similarity()` function with threshold 0.3-0.5, show top 5 similar results for review
**Warning signs:** Users complain about "duplicate" descriptors that are clearly similar but not caught by system

### Pitfall 3: Soft Delete Query Inconsistency
**What goes wrong:** Forgetting `WHERE deletedAt IS NULL` in some queries exposes deleted records to users
**Why it happens:** Copy-pasting queries without adding soft delete filter
**How to avoid:** Create reusable query functions that always filter deleted, or use Prisma middleware to inject filter globally
**Warning signs:** "Deleted" descriptors appearing in search results or counts

### Pitfall 4: Enum Migration Errors
**What goes wrong:** Adding QualityIndicator enum and using new values as defaults in same migration causes PostgreSQL error: "New enum values must be committed before they can be used"
**Why it happens:** PostgreSQL requires enum values to be committed in a transaction before they can be referenced
**How to avoid:** Use two migrations: (1) Add enum type, (2) Add column with default value
**Warning signs:** Migration fails with "unsafe use of new value of enum type"

### Pitfall 5: No Confirmation for Delete
**What goes wrong:** Accidental deletion of descriptors without confirmation, no undo path
**Why it happens:** Delete button directly triggers Server Action without confirmation step
**How to avoid:** Use AlertDialog component or native `<dialog>` with "Are you sure?" confirmation before calling delete action
**Warning signs:** User complaints about accidental deletions, requests for "restore" feature

### Pitfall 6: Tag Array Not Indexed
**What goes wrong:** Querying tags with `WHERE tags @> ARRAY['teamwork']` is slow (full table scan)
**Why it happens:** Forgetting to add GIN index on tags array field
**How to avoid:** Add `@@index([tags])` in Prisma schema or `CREATE INDEX USING GIN` in migration
**Warning signs:** Slow tag filter queries (>100ms on modest dataset)

## Code Examples

Verified patterns from official sources and existing codebase:

### Form Component with Error Display
```typescript
// Pattern based on existing resources/page.tsx
export default async function CreateDescriptorPage({
  searchParams,
}: {
  searchParams?: { error?: string; created?: string }
}) {
  await requireAdminUser()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Create Descriptor</h1>

      {searchParams?.error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{searchParams.error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Descriptor Details</CardTitle>
          <CardDescription>
            Add a new descriptor to the library with performance levels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createDescriptorAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" required placeholder="A1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skillName">Source Skill</Label>
                <Input id="skillName" name="skillName" required placeholder="Welding" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="criterionName">Criterion Name</Label>
              <Input
                id="criterionName"
                name="criterionName"
                required
                placeholder="Quality of weld seam"
              />
            </div>

            {/* Performance levels as textareas */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="excellent">Excellent</Label>
                <Textarea id="excellent" name="excellent" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="good">Good</Label>
                <Textarea id="good" name="good" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass">Pass</Label>
                <Textarea id="pass" name="pass" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="belowPass">Below Pass</Label>
                <Textarea id="belowPass" name="belowPass" rows={3} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                name="tags"
                placeholder="safety, precision, measurement"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualityIndicator">Quality</Label>
              <select
                id="qualityIndicator"
                name="qualityIndicator"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="REFERENCE">Reference Only</option>
                <option value="GOOD">Good Quality</option>
                <option value="EXCELLENT">Excellent Example</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit">Create Descriptor</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/descriptors">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Delete Confirmation with Native Dialog
```typescript
// Client component for delete confirmation
'use client'
import { useState, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteDescriptorAction } from '../actions'

interface DeleteConfirmationProps {
  descriptorId: string
  criterionName: string
}

export function DeleteConfirmation({ descriptorId, criterionName }: DeleteConfirmationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const handleDelete = async () => {
    const formData = new FormData()
    formData.set('id', descriptorId)
    await deleteDescriptorAction(formData)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => dialogRef.current?.showModal()}
        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <dialog
        ref={dialogRef}
        className="rounded-lg p-6 backdrop:bg-black/60"
        onClose={() => dialogRef.current?.close()}
      >
        <h2 className="text-xl font-semibold">Delete Descriptor</h2>
        <p className="mt-2 text-muted-foreground">
          Are you sure you want to delete "{criterionName}"? This action can be undone by restoring from the audit trail.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => dialogRef.current?.close()}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </dialog>
    </>
  )
}
```

### Duplicate Warning Component
```typescript
// Display similar descriptors during create/edit
import { Badge } from '@/components/ui/badge'

interface SimilarDescriptor {
  id: string
  criterionName: string
  code: string
  skillName: string
  similarity: number
}

export function DuplicateWarning({ similar }: { similar: SimilarDescriptor[] }) {
  if (similar.length === 0) return null

  return (
    <div className="rounded-md border border-amber-500 bg-amber-50 p-4 dark:bg-amber-950">
      <h3 className="font-medium text-amber-900 dark:text-amber-100">
        Similar descriptors found
      </h3>
      <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
        These descriptors appear similar. Review to avoid duplicates:
      </p>
      <ul className="mt-3 space-y-2">
        {similar.map((s) => (
          <li key={s.id} className="flex items-start gap-2 text-sm">
            <Badge variant="outline">{s.code}</Badge>
            <div className="flex-1">
              <p className="font-medium">{s.criterionName}</p>
              <p className="text-muted-foreground">
                {s.skillName} • {Math.round(s.similarity * 100)}% similar
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-hook-form + API routes | Server Actions + Zod | Next.js 13+ (App Router) | Simpler code, less client JS, better type safety |
| Boolean isDeleted | Timestamp deletedAt | 2020+ best practices | Audit compliance, know when/who deleted |
| LIKE '%text%' for similarity | pg_trgm with GIN index | PostgreSQL 9.1+ (mature 2023+) | 500x performance improvement, fuzzy matching |
| Boolean quality flags | Enum QualityIndicator | Modern schema design 2024+ | Extensible without schema changes |
| Custom tag inputs | String[] with native input | Prisma 2.0+ array support | Simpler, native PostgreSQL array operations |

**Deprecated/outdated:**
- **react-hook-form for Server Actions**: Unnecessary overhead, Next.js 14 Server Actions handle forms natively with better UX (no hydration delay)
- **Levenshtein for duplicate detection**: Slower than pg_trgm, requires custom implementation or extension
- **Client-side form libraries**: Server Components + Server Actions eliminate need for client state management

## Open Questions

Things that couldn't be fully resolved:

1. **Quality Indicator Taxonomy**
   - What we know: Requirements specify "excellent example" vs "reference only" distinction
   - What's unclear: Whether 4-level enum (EXCELLENT/GOOD/REFERENCE/NEEDS_REVIEW) matches user mental model
   - Recommendation: Start with 2-level (EXCELLENT/REFERENCE), add NEEDS_REVIEW for imports, expand in Phase 4 based on admin feedback

2. **Tag Validation and Standardization**
   - What we know: Tags stored as String[] array, no validation currently
   - What's unclear: Should tags be free-form or validated against allowed list? What prevents tag sprawl?
   - Recommendation: Phase 2 allows free-form tags, Phase 4 adds tag management UI with merge/rename capabilities after observing usage patterns

3. **Restore Deleted Descriptors UI**
   - What we know: Soft delete preserves data with deletedAt timestamp
   - What's unclear: Requirements mention "option to restore" but no UI specified for Phase 2
   - Recommendation: Implement soft delete in Phase 2, defer restore UI to Phase 4 (can restore via database if urgent)

4. **Similarity Threshold for Duplicates**
   - What we know: pg_trgm default threshold is 0.3, searches should use 0.3-0.5 range
   - What's unclear: Optimal threshold for marking scheme descriptors (technical jargon may score lower)
   - Recommendation: Start with 0.4 threshold, make configurable in admin settings if needed, gather feedback in Phase 2 testing

## Sources

### Primary (HIGH confidence)
- [Next.js 14 Server Actions Official Docs](https://nextjs.org/docs/14/app/building-your-application/data-fetching/server-actions-and-mutations) - Server Action patterns, form handling, revalidation
- [Zod Official Documentation](https://zod.dev/) - Schema validation, safeParse API
- [PostgreSQL pg_trgm Documentation](https://www.postgresql.org/docs/current/pgtrgm.html) - Trigram similarity functions, GIN indexing
- Existing codebase patterns:
  - `src/app/(dashboard)/settings/resources/actions.ts` - Server Actions with Zod
  - `src/app/(dashboard)/settings/resources/page.tsx` - Form UI patterns
  - `prisma/schema.prisma` - Database schema conventions
  - `package.json` - Radix UI, Zod, Next.js versions

### Secondary (MEDIUM confidence)
- [Next.js Server Actions Complete Guide 2026](https://dev.to/marufrahmanlive/nextjs-server-actions-complete-guide-with-examples-for-2026-2do0) - Modern patterns, best practices
- [Fuzzy String Matching in PostgreSQL with pg_trgm](https://dev.to/talemul/fuzzy-string-matching-in-postgresql-with-pgtrgm-trigram-search-tutorial-2hc6) - Duplicate detection implementation
- [shadcn/ui AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog) - Delete confirmation patterns
- [Soft Deletes and Audit Trail LinkedIn Article](https://www.linkedin.com/advice/0/how-do-you-use-audit-trail-pattern-track-changes) - Database patterns

### Tertiary (LOW confidence)
- [PostgreSQL Arrays vs JSONB Performance](https://www.alibabacloud.com/blog/store-operations-optimization-search-acceleration-over-postgresql-arrays-json-and-internal-tag-data_595796) - Benchmarks for tag storage (2023 data)
- [Tag Management UX Patterns](https://schof.co/tags-ux-to-implementation/) - UI/UX guidance for tag inputs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, patterns proven in existing code
- Architecture: HIGH - Following existing patterns in resources management (Server Actions + Zod)
- Duplicate detection: HIGH - pg_trgm is official PostgreSQL extension with extensive documentation
- Soft delete: MEDIUM - Pattern is common but not yet used in this codebase
- Quality indicator: MEDIUM - Enum approach is standard but specific values need validation with stakeholders
- Pitfalls: HIGH - Based on official docs and known PostgreSQL enum migration issues

**Research date:** 2026-02-01
**Valid until:** 90 days (stable domain, Next.js 14 mature, PostgreSQL pg_trgm unchanged for years)

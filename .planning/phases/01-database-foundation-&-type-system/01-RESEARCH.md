# Phase 1: Database Foundation & Type System - Research

**Researched:** 2026-02-01
**Domain:** Prisma ORM schema migrations, PostgreSQL nullable foreign keys, TypeScript strict null handling
**Confidence:** HIGH

## Summary

This phase involves making the `Meeting.skillId` field optional in Prisma to support both skill-specific meetings and management meetings, while introducing an explicit junction table (`MeetingAttendee`) for selective per-meeting attendance tracking. The research confirms this is a well-established pattern in Prisma with clear migration paths and strong TypeScript support.

The standard approach involves: (1) updating the schema to make `skillId` nullable using Prisma's optional field syntax (`String?`), (2) creating an explicit many-to-many junction table model for attendees, (3) using Prisma Migrate with the `--create-only` flag to review and customize the generated SQL migration, and (4) leveraging TypeScript's strict null checks to ensure type safety throughout the codebase.

**Primary recommendation:** Use Prisma's native optional relation pattern (`skillId String?`, `skill Skill?`) combined with an explicit junction table model for `MeetingAttendee`. Create the migration with `--create-only` to verify it preserves existing data, then apply it. Follow up with `prisma generate` to update TypeScript types automatically.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma ORM | 5.20.0+ | Database ORM and migration tool | Industry standard for TypeScript/Node.js, type-safe database access, built-in migration system |
| PostgreSQL | Current | Relational database | Project's existing database, excellent NULL handling and foreign key support |
| TypeScript | 5.x (strict mode) | Type safety | Project uses strict null checks, Prisma generates types automatically |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Prisma Migrate | (included) | Schema migration management | All schema changes in development and production |
| @prisma/client | 5.20.0+ | Type-safe database client | Generated after schema changes via `prisma generate` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Explicit junction table | Implicit many-to-many | Implicit m-n relations cannot store metadata (we need per-meeting selection) |
| Prisma Migrate | Manual SQL migrations | Lose type generation, migration history tracking, and rollback capability |
| Optional fields | Discriminated unions | More complex, doesn't leverage database NULL semantics |

**Installation:**
```bash
# Already installed in project at correct versions
# After schema changes, regenerate client:
npm run prisma:generate
```

## Architecture Patterns

### Recommended Project Structure
```
prisma/
├── migrations/           # Migration history (git-committed)
│   ├── 0001_init/
│   ├── 0011_make_meeting_skill_optional/  # New migration
│   └── migration_lock.toml
└── schema.prisma        # Single source of truth
```

### Pattern 1: Optional Foreign Key Relations
**What:** Making a required foreign key optional to allow NULL values in the database
**When to use:** When a relation should be optional (e.g., meetings can exist without a skill)
**Example:**
```prisma
// Source: Prisma Official Documentation - Relations
// Before (required):
model Meeting {
  id      String @id @default(cuid())
  skillId String
  skill   Skill  @relation(fields: [skillId], references: [id])
}

// After (optional):
model Meeting {
  id      String  @id @default(cuid())
  skillId String?
  skill   Skill?  @relation(fields: [skillId], references: [id])

  @@index([skillId])
}
```
**Key points:**
- Both relation scalar field (`skillId String?`) and relation field (`skill Skill?`) must have `?`
- Existing indexes are preserved
- Migration automatically generates `ALTER TABLE "Meeting" ALTER COLUMN "skillId" DROP NOT NULL`
- All existing data is preserved (non-NULL values remain)

### Pattern 2: Explicit Junction Table (Many-to-Many with Metadata)
**What:** Manually defining a junction table as a Prisma model to store relationship metadata
**When to use:** When you need to store additional data about the relationship itself (attendee selection metadata, timestamps, etc.)
**Example:**
```prisma
// Source: Prisma Official Documentation - Many-to-Many Relations
model Meeting {
  id        String             @id @default(cuid())
  title     String
  attendees MeetingAttendee[]  // Relation to junction table
}

model User {
  id               String             @id @default(cuid())
  meetingAttendees MeetingAttendee[]  // Relation to junction table
}

model MeetingAttendee {
  meetingId String
  userId    String
  addedAt   DateTime @default(now())
  addedBy   String?

  meeting Meeting @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([meetingId, userId])           // Composite primary key
  @@index([meetingId])                 // Foreign key index for performance
  @@index([userId])                    // Foreign key index for performance
}
```
**Key points:**
- Junction model includes relation fields pointing to both sides
- Composite `@@id` ensures uniqueness of the combination
- Additional metadata fields can be added (timestamps, who added, etc.)
- `onDelete: Cascade` ensures cleanup when parent records are deleted
- Indexes on foreign keys improve query performance

### Pattern 3: Migration Customization with --create-only
**What:** Generate migration SQL without applying it, allowing manual review and customization
**When to use:** When you need to verify data preservation or add custom migration logic
**Example:**
```bash
# Source: Prisma Official Documentation - Customizing Migrations
# 1. Create migration draft without applying
npx prisma migrate dev --create-only --name make_meeting_skill_optional

# 2. Review generated SQL in prisma/migrations/[timestamp]_make_meeting_skill_optional/migration.sql

# 3. If acceptable, apply the migration
npx prisma migrate dev

# 4. Generate updated TypeScript types
npx prisma generate
```

### Pattern 4: TypeScript Strict Null Handling for Optional Relations
**What:** Using TypeScript's optional chaining and nullish coalescing with Prisma's generated types
**When to use:** All code that accesses optional relations or fields
**Example:**
```typescript
// Source: Project codebase pattern + TypeScript best practices
// Prisma generates: skill: Skill | null

// Query with optional include
const meeting = await prisma.meeting.findUnique({
  where: { id: meetingId },
  include: { skill: true }  // skill may be null
});

// Safe access with optional chaining
const skillName = meeting?.skill?.name ?? 'Management Meeting';

// Type-safe filtering
const skillMeetings = await prisma.meeting.findMany({
  where: {
    skillId: { not: null }  // TypeScript knows these have skills
  },
  include: { skill: true }
});

// For management meetings specifically
const managementMeetings = await prisma.meeting.findMany({
  where: {
    skillId: null  // null = management meetings
  }
});
```

### Anti-Patterns to Avoid
- **Setting relation field to `null` directly:** Use `disconnect: true` or set the scalar field (`skillId: null`), not the relation object
- **Forgetting to add `?` to both scalar and relation fields:** Both `skillId` and `skill` must be optional
- **Using implicit many-to-many for junction tables:** Loses ability to store metadata about the relationship
- **Not indexing foreign keys:** PostgreSQL doesn't auto-index foreign keys; add `@@index([foreignKey])` for performance
- **Applying migrations without review in production:** Always use `--create-only` first to verify SQL

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type generation for DB schema | Manual TypeScript interfaces | Prisma Client generator | Prisma auto-generates types from schema, maintains sync, includes relation types |
| Migration SQL generation | Hand-written SQL files | Prisma Migrate | Tracks migration history, generates idempotent SQL, handles rollbacks |
| NULL vs undefined handling | Custom logic to distinguish | Prisma's null/undefined semantics | Prisma has built-in: `null` = set to NULL, `undefined` = don't update |
| Junction table queries | Raw SQL joins | Prisma's relation queries | Type-safe, handles nested creates/connects, optimizes queries |
| Schema validation | Runtime checks on DB schema | Prisma schema validation | Validates at schema definition time, prevents invalid states |

**Key insight:** Prisma's type generation and migration system handle the complex edge cases that arise when database schema and TypeScript types must stay synchronized. Building custom solutions loses this automatic synchronization and introduces maintenance burden.

## Common Pitfalls

### Pitfall 1: Using SetNull Referential Action with Optional Relations
**What goes wrong:** Even though `skillId` is nullable, using `onDelete: SetNull` can cause confusion about deletion behavior
**Why it happens:** Developers expect `SetNull` to prevent deletion errors, but it changes delete semantics
**How to avoid:** For this use case, use default referential action (no explicit `onDelete`). Management meetings with `skillId: null` won't be affected by skill deletion since there's no reference
**Warning signs:** Migration warnings about SetNull on nullable fields

### Pitfall 2: Forgetting to Index Foreign Keys
**What goes wrong:** Queries that filter or join on `skillId` become slow; deleting a Skill causes table scans
**Why it happens:** PostgreSQL doesn't automatically create indexes on foreign key columns (unlike some other databases)
**How to avoid:** Always add `@@index([skillId])` for foreign key columns, even optional ones
**Warning signs:** Slow queries when filtering by skill, slow Skill deletion operations
**Performance impact:** Can be 1000x+ slower without indexes (30 minutes → 1 second in documented cases)

### Pitfall 3: Not Running `prisma generate` After Schema Changes
**What goes wrong:** TypeScript types don't reflect schema changes, causing type errors or runtime mismatches
**Why it happens:** `prisma migrate dev` applies schema to DB but doesn't regenerate Prisma Client
**How to avoid:** Always run `npm run prisma:generate` after migrations, or use `prisma migrate dev` which includes generation
**Warning signs:** TypeScript errors claiming fields don't exist, or fields show as required when they're optional

### Pitfall 4: Confusing null and undefined in Prisma Queries
**What goes wrong:** Using `undefined` when you mean `null` causes the field to be ignored in queries/updates
**Why it happens:** TypeScript allows both, but Prisma treats them differently: `null` = database NULL value, `undefined` = omit from query
**How to avoid:**
- For filtering: use `{ skillId: null }` to find NULL values, `{ skillId: { not: null } }` for non-NULL
- For updates: use `{ skillId: null }` to set to NULL, `{ skillId: undefined }` to skip the field
- Consider enabling `strictUndefinedChecks` preview feature (Prisma 5.20+)
**Warning signs:** Queries returning unexpected results, updates not changing expected fields

### Pitfall 5: Data Loss When Renaming vs Changing Fields
**What goes wrong:** Default migration drops old field and creates new one, losing data
**Why it happens:** Prisma can't detect renames automatically; treats them as delete + create
**How to avoid:** Use `--create-only` flag, edit SQL to use `ALTER TABLE ... RENAME COLUMN` instead of DROP/ADD
**Warning signs:** Migration preview shows DROP COLUMN (for this phase: not applicable since we're only changing constraint, not renaming)
**For this phase:** Not a concern - we're only removing NOT NULL constraint, not renaming

### Pitfall 6: Missing Cascade Deletes on Junction Tables
**What goes wrong:** Deleting a Meeting or User leaves orphaned MeetingAttendee records
**Why it happens:** Forgetting to specify `onDelete: Cascade` on junction table relations
**How to avoid:** Always add `onDelete: Cascade` to junction table foreign keys
**Warning signs:** Database grows with orphaned records, foreign key constraint errors when deleting

## Code Examples

Verified patterns from official sources:

### Creating a Meeting with Optional Skill (Skill Meeting)
```typescript
// Source: Prisma Client documentation + project patterns
const skillMeeting = await prisma.meeting.create({
  data: {
    title: "Technical Planning Session",
    startTime: new Date("2026-03-15T10:00:00Z"),
    endTime: new Date("2026-03-15T11:00:00Z"),
    skillId: "skill_abc123",  // Link to skill
    meetingLink: "https://zoom.us/j/123456",
  }
});
```

### Creating a Management Meeting (No Skill)
```typescript
// Management meeting with skillId: null
const managementMeeting = await prisma.meeting.create({
  data: {
    title: "Secretariat Strategy Session",
    startTime: new Date("2026-03-20T14:00:00Z"),
    endTime: new Date("2026-03-20T15:30:00Z"),
    skillId: null,  // No skill association
    meetingLink: "https://teams.microsoft.com/...",
  }
});
```

### Creating Meeting with Attendees (Junction Table)
```typescript
// Create management meeting with specific attendees in one transaction
const meetingWithAttendees = await prisma.meeting.create({
  data: {
    title: "Q1 Review Meeting",
    startTime: new Date("2026-04-01T09:00:00Z"),
    endTime: new Date("2026-04-01T10:00:00Z"),
    skillId: null,
    attendees: {
      create: [
        { userId: "user_1", addedBy: currentUserId },
        { userId: "user_2", addedBy: currentUserId },
        { userId: "user_3", addedBy: currentUserId },
      ]
    }
  },
  include: {
    attendees: {
      include: { user: true }
    }
  }
});
```

### Querying Meetings by Type
```typescript
// Get all skill meetings
const skillMeetings = await prisma.meeting.findMany({
  where: { skillId: { not: null } },
  include: { skill: true }
});

// Get all management meetings
const managementMeetings = await prisma.meeting.findMany({
  where: { skillId: null },
  include: {
    attendees: {
      include: { user: { select: { name: true, email: true } } }
    }
  }
});

// Get meetings for specific user (via junction table)
const userMeetings = await prisma.meeting.findMany({
  where: {
    OR: [
      { skillId: { not: null }, skill: { saId: userId } },  // User is SA
      { attendees: { some: { userId: userId } } },          // User is attendee
    ]
  },
  include: { skill: true }
});
```

### Type-Safe Access to Optional Relations
```typescript
// TypeScript knows skill can be null
const meeting = await prisma.meeting.findUnique({
  where: { id: meetingId },
  include: { skill: true }
});

// Safe access patterns
if (meeting) {
  // Optional chaining
  const skillName = meeting.skill?.name;

  // Nullish coalescing
  const displayName = meeting.skill?.name ?? 'Management Meeting';

  // Type narrowing
  if (meeting.skill) {
    // TypeScript knows meeting.skill is not null here
    console.log(`Skill meeting for: ${meeting.skill.name}`);
  } else {
    console.log('Management meeting');
  }
}
```

### Disconnecting Optional Relation
```typescript
// Convert skill meeting to management meeting
await prisma.meeting.update({
  where: { id: meetingId },
  data: {
    skillId: null  // Set foreign key to null
    // OR use disconnect (same effect):
    // skill: { disconnect: true }
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `undefined` for omitting fields | `Prisma.skip` symbol | Prisma 5.20.0 (2024) | Prevents accidental data loss from undefined usage |
| Implicit type checks | `strictUndefinedChecks` preview feature | Prisma 5.20.0 | Runtime errors for undefined values, forces explicit handling |
| Manual type definitions | Auto-generated types from schema | Since Prisma 2.x | Types always match schema, no drift |
| `prisma db push` in dev | `prisma migrate dev` | Best practice shift | Better migration history, safer for teams |

**Deprecated/outdated:**
- **Implicit many-to-many for metadata-rich relationships:** Still works but explicit junction tables are recommended when you need to query or store metadata about the relationship itself
- **Using `undefined` without `strictUndefinedChecks`:** Prisma 5.20+ recommends enabling this preview feature to catch bugs early
- **Not using `exactOptionalPropertyTypes` in TypeScript:** Recommended to pair with `strictUndefinedChecks` for compile-time safety

## Open Questions

Things that couldn't be fully resolved:

1. **Should we enable `strictUndefinedChecks` preview feature?**
   - What we know: Prisma 5.20+ offers this as a preview feature; will be GA in Prisma 6.x
   - What's unclear: Whether existing codebase has patterns that rely on `undefined` for "omit field" behavior
   - Recommendation: Start without it, consider enabling in a future phase after codebase audit. Use `Prisma.skip` only if needed.

2. **What referential action should be used when deleting Skills with meetings?**
   - What we know: Default is `Restrict` (prevents deletion if meetings exist)
   - What's unclear: Business requirements - should deleting a skill be allowed? Should meetings become management meetings?
   - Recommendation: Keep default `Restrict` unless product owner specifies. Safer to require manual cleanup.

3. **Should MeetingAttendee track who added each attendee?**
   - What we know: Pattern supports `addedBy` field
   - What's unclear: Whether this audit trail is needed for this phase
   - Recommendation: Include `addedBy String?` field in schema now (cheap to add), implement tracking logic in later phase if needed

## Sources

### Primary (HIGH confidence)
- [Prisma Official Documentation - Many-to-Many Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations) - Junction table patterns
- [Prisma Official Documentation - Customizing Migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations) - Migration workflow
- [Prisma Official Documentation - Null and Undefined](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/null-and-undefined) - Type handling
- [Prisma Official Documentation - Data Migration Guide](https://www.prisma.io/docs/guides/data-migration) - Expand and contract pattern
- [Prisma Official Documentation - Referential Actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions) - Cascade behavior
- Codebase analysis: `C:\Users\LukeBoustridge\Projects\Worldskills\prisma\schema.prisma` - Current schema structure
- Codebase analysis: `C:\Users\LukeBoustridge\Projects\Worldskills\src\app\(dashboard)\skills\[skillId]\meeting-actions.ts` - Existing meeting patterns

### Secondary (MEDIUM confidence)
- [Foreign Key Indexing and Performance in PostgreSQL - Cybertec](https://www.cybertec-postgresql.com/en/index-your-foreign-key/) - Index performance data
- [PostgreSQL Composite Primary Keys - ObjectRocket](https://kb.objectrocket.com/postgresql/postgresql-composite-primary-keys-629) - Junction table best practices
- [Prisma GitHub Issue #18058](https://github.com/prisma/prisma/issues/18058) - Optional relations creating FK constraints
- [Prisma Testing Guide - Integration Testing](https://www.prisma.io/blog/testing-series-3-aBUyF8nxAn) - Migration testing patterns

### Tertiary (LOW confidence)
- Web search results about Prisma migration best practices (multiple blog posts, 2025-2026) - General validation of patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using project's existing tools (Prisma 5.20, PostgreSQL, TypeScript)
- Architecture: HIGH - All patterns verified from official Prisma documentation and project codebase
- Pitfalls: MEDIUM-HIGH - Mix of official documentation and community experience (GitHub issues)

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days) - Prisma is stable; patterns unlikely to change significantly

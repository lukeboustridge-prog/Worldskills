# Phase 3: Search & Discovery - Research

**Researched:** 2026-02-02
**Domain:** PostgreSQL Full-Text Search, Next.js Search UX, Prisma Integration
**Confidence:** HIGH

## Summary

Phase 3 implements PostgreSQL full-text search (FTS) for the descriptor library with relevance ranking, multi-criteria filtering, and URL-based state persistence. The standard approach combines PostgreSQL's native `tsvector` and `ts_rank` functions with GIN indexes for <100ms performance, accessed via Prisma's `$queryRaw` since native FTS support remains in preview with known limitations.

**Key findings:**
- PostgreSQL native FTS with GIN indexes handles the 12K+ descriptor corpus efficiently (<100ms)
- Prisma's FTS preview feature has performance issues; use `$queryRaw` with TypedSQL for type safety
- Next.js App Router provides URL-based state persistence via `useSearchParams` with `use-debounce` library
- Faceted filter counts require careful optimization; standard SQL aggregation works for <1M rows
- `websearch_to_tsquery` is the most user-friendly query parser (supports quoted phrases, OR, NOT)

**Primary recommendation:** Use functional GIN indexes with `$queryRaw` for FTS, combine with standard WHERE clauses for filters, implement URL-based search state with nuqs library for type-safe param management.

## Standard Stack

The established libraries/tools for PostgreSQL full-text search in Next.js applications:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL native FTS | 16+ | Full-text search with tsvector, ts_rank | Built-in, production-proven, no external dependencies |
| Prisma $queryRaw | 5.20+ | Raw SQL execution with type safety | Required for optimal FTS performance; native preview has issues |
| GIN indexes | Native | Inverted index for fast text search | Standard for FTS; 10-100x faster than sequential scans |
| nuqs | 2.x | Type-safe URL search params state management | Modern, 6kB, supports Next.js 14+ App Router |
| use-debounce | 10.x | Debounce search input | Official Next.js docs recommendation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg_trgm extension | Native | Trigram similarity for fuzzy matching | Related descriptor recommendations (SEARCH-08) |
| TypedSQL | Prisma 5.19+ | Type-safe SQL queries in .sql files | Complex search queries with compile-time validation |
| zod | 3.23+ | Runtime validation for search params | Validate/parse filter values from URL |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL FTS | Elasticsearch | Overkill for 12K corpus; adds infrastructure complexity, deployment cost |
| nuqs | Manual URLSearchParams | More boilerplate, no type safety, harder to maintain |
| $queryRaw | Prisma FTS preview | Preview feature has known performance issues, lacks index support |
| GIN index | Sequential scan | 10-100x slower; unacceptable for <100ms requirement |

**Installation:**
```bash
npm install nuqs use-debounce zod
# PostgreSQL extensions (run in migration)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── descriptors/
│       ├── page.tsx                    # Server Component with searchParams
│       └── components/
│           ├── SearchInput.tsx         # Client Component with debounce
│           ├── FilterPanel.tsx         # Client Component for facets
│           └── DescriptorList.tsx      # Server Component for results
├── lib/
│   ├── actions/
│   │   └── search-descriptors.ts       # Server Action with $queryRaw
│   └── queries/
│       └── descriptor-search.ts        # Raw SQL query functions
└── prisma/
    └── migrations/
        └── XXX_add_fts_indexes.sql     # GIN index migration
```

### Pattern 1: Functional GIN Index for Multi-Field Search
**What:** Create GIN index on expression combining multiple text fields with weighting
**When to use:** When searching across criterion name, performance levels, tags simultaneously
**Example:**
```sql
-- Migration: Add functional GIN index
CREATE INDEX idx_descriptors_search
ON "Descriptor"
USING GIN (
  setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
);
-- Source: https://www.postgresql.org/docs/current/textsearch-tables.html
-- A-weight (1.0) for criterion name = most important
-- B-weight (0.4) for performance levels = secondary importance
```

**Why functional index over generated column:**
- No storage duplication (tsvector not materialized in table)
- No trigger maintenance needed
- Same query performance as stored column
- Simpler schema evolution
- Source: [PostgreSQL FTS Documentation - Tables and Indexes](https://www.postgresql.org/docs/current/textsearch-tables.html)

### Pattern 2: Combined Search + Filter with Relevance Ranking
**What:** Use websearch_to_tsquery for user input, combine with WHERE filters, rank with ts_rank
**When to use:** Main search interface (SEARCH-01, SEARCH-02, SEARCH-03)
**Example:**
```typescript
// lib/queries/descriptor-search.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface SearchParams {
  query?: string;
  skillArea?: string;
  category?: string;
  qualityIndicator?: string;
  limit?: number;
  offset?: number;
}

export async function searchDescriptors(params: SearchParams) {
  const { query, skillArea, category, qualityIndicator, limit = 20, offset = 0 } = params;

  // Build dynamic WHERE conditions
  const whereConditions: string[] = ['"deletedAt" IS NULL'];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (query) {
    whereConditions.push(
      `websearch_to_tsquery('english', $${paramIndex}) @@ (
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
      )`
    );
    queryParams.push(query);
    paramIndex++;
  }

  if (skillArea) {
    whereConditions.push(`"skillName" = $${paramIndex}`);
    queryParams.push(skillArea);
    paramIndex++;
  }

  if (category) {
    whereConditions.push(`"category" = $${paramIndex}`);
    queryParams.push(category);
    paramIndex++;
  }

  if (qualityIndicator) {
    whereConditions.push(`"qualityIndicator" = $${paramIndex}`);
    queryParams.push(qualityIndicator);
    paramIndex++;
  }

  const whereClause = whereConditions.join(' AND ');

  // Ranking: use ts_rank_cd with normalization for better relevance
  const rankExpression = query
    ? `ts_rank_cd(
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B'),
        websearch_to_tsquery('english', $1),
        32  -- Normalization: scale to 0-1 range
      ) DESC`
    : '"createdAt" DESC';

  const sql = `
    SELECT
      id,
      code,
      "criterionName",
      excellent,
      good,
      pass,
      "belowPass",
      source,
      "skillName",
      sector,
      category,
      tags,
      "qualityIndicator",
      "createdAt"
      ${query ? `, ts_rank_cd(
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B'),
        websearch_to_tsquery('english', $1),
        32
      ) as rank` : ''}
    FROM "Descriptor"
    WHERE ${whereClause}
    ORDER BY ${rankExpression}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  return prisma.$queryRaw(Prisma.sql([sql], ...queryParams));
}
// Source: https://www.postgresql.org/docs/current/textsearch-controls.html
```

**Key decisions:**
- `websearch_to_tsquery` instead of `plainto_tsquery`: Supports quoted phrases, OR, NOT operators, never throws errors
- `ts_rank_cd` with normalization 32: Cover density (proximity matters) + scales to 0-1 range
- Dynamic WHERE conditions: Filters don't replace search, they narrow it
- Source: [PostgreSQL Text Search Controls](https://www.postgresql.org/docs/current/textsearch-controls.html)

### Pattern 3: URL-Based Search State with nuqs
**What:** Type-safe URL search param management for shareable/bookmarkable searches
**When to use:** Search interface state (query, filters, pagination) (SEARCH-06)
**Example:**
```typescript
// app/descriptors/components/SearchInput.tsx
'use client';

import { useQueryState } from 'nuqs';
import { useDebouncedCallback } from 'use-debounce';
import { Input } from '@/components/ui/input';

export function SearchInput() {
  const [query, setQuery] = useQueryState('q', {
    defaultValue: '',
    shallow: false, // Trigger server re-render
  });

  const handleSearch = useDebouncedCallback((term: string) => {
    setQuery(term || null); // null removes param from URL
  }, 300);

  return (
    <Input
      type="search"
      placeholder="Search descriptors..."
      defaultValue={query}
      onChange={(e) => handleSearch(e.target.value)}
      className="w-full"
    />
  );
}

// app/descriptors/components/FilterPanel.tsx
'use client';

import { useQueryState } from 'nuqs';

export function FilterPanel({ facets }: { facets: Facets }) {
  const [skillArea, setSkillArea] = useQueryState('skill');
  const [category, setCategory] = useQueryState('category');
  const [quality, setQuality] = useQueryState('quality');

  return (
    <aside>
      <h3>Filter by Skill Area</h3>
      {facets.skillAreas.map(({ name, count }) => (
        <button
          key={name}
          onClick={() => setSkillArea(name === skillArea ? null : name)}
          className={skillArea === name ? 'active' : ''}
        >
          {name} ({count})
        </button>
      ))}
      {/* Similar for category, quality */}
    </aside>
  );
}

// app/descriptors/page.tsx (Server Component)
import { searchDescriptors } from '@/lib/queries/descriptor-search';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    skill?: string;
    category?: string;
    quality?: string;
    page?: string;
  }>;
}

export default async function DescriptorsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = 20;

  const results = await searchDescriptors({
    query: params.q,
    skillArea: params.skill,
    category: params.category,
    qualityIndicator: params.quality,
    limit,
    offset: (page - 1) * limit,
  });

  return (
    <div>
      <SearchInput />
      <FilterPanel facets={facets} />
      <DescriptorList results={results} />
    </div>
  );
}
// Source: https://nuqs.dev/ and https://nextjs.org/learn/dashboard-app/adding-search-and-pagination
```

**Benefits:**
- Shareable URLs: Copy/paste search results to colleagues
- Bookmarkable: Save frequent searches in browser
- Back/forward navigation works
- Type-safe with TypeScript
- Source: [nuqs documentation](https://nuqs.dev/)

### Pattern 4: Faceted Filter Counts with Standard SQL
**What:** Aggregate counts for filter options alongside main search results
**When to use:** Filter panels showing "Safety (23), Teamwork (15)" (UI-02)
**Example:**
```typescript
// lib/queries/facet-counts.ts
export async function getFacetCounts(searchQuery?: string) {
  const searchCondition = searchQuery
    ? Prisma.sql`WHERE websearch_to_tsquery('english', ${searchQuery}) @@ (
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
      ) AND "deletedAt" IS NULL`
    : Prisma.sql`WHERE "deletedAt" IS NULL`;

  // Parallel queries for better performance
  const [skillAreas, categories, qualities] = await Promise.all([
    prisma.$queryRaw<Array<{ name: string; count: number }>>`
      SELECT "skillName" as name, COUNT(*)::int as count
      FROM "Descriptor"
      ${searchCondition}
      GROUP BY "skillName"
      ORDER BY count DESC, name ASC
    `,
    prisma.$queryRaw<Array<{ name: string; count: number }>>`
      SELECT category as name, COUNT(*)::int as count
      FROM "Descriptor"
      ${searchCondition}
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC, name ASC
    `,
    prisma.$queryRaw<Array<{ name: string; count: number }>>`
      SELECT "qualityIndicator" as name, COUNT(*)::int as count
      FROM "Descriptor"
      ${searchCondition}
      GROUP BY "qualityIndicator"
      ORDER BY count DESC
    `,
  ]);

  return { skillAreas, categories, qualities };
}
// Source: https://www.cybertec-postgresql.com/en/faceting-large-result-sets/
```

**Performance characteristics:**
- Standard SQL aggregation works well for <1M rows (our corpus is ~12K)
- Parallel queries reduce total latency
- Indexes on filter columns (skillName, category, qualityIndicator) speed up GROUP BY
- For >1M rows, consider pgfaceting extension with roaring bitmaps
- Source: [Faceting large result sets in PostgreSQL](https://www.cybertec-postgresql.com/en/faceting-large-result-sets/)

### Pattern 5: User Bookmarks with Many-to-Many Relation
**What:** Junction table linking users to favorite descriptors
**When to use:** Save frequently accessed descriptors (SEARCH-07)
**Example:**
```prisma
// prisma/schema.prisma
model User {
  id                  String   @id @default(cuid())
  // ... existing fields
  favoriteDescriptors DescriptorFavorite[]
}

model Descriptor {
  id          String   @id @default(cuid())
  // ... existing fields
  favoritedBy DescriptorFavorite[]
}

model DescriptorFavorite {
  userId       String
  descriptorId String
  createdAt    DateTime @default(now())

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  descriptor Descriptor @relation(fields: [descriptorId], references: [id], onDelete: Cascade)

  @@id([userId, descriptorId])
  @@index([userId])
  @@index([descriptorId])
}
```

**Query patterns:**
```typescript
// Add favorite
await prisma.descriptorFavorite.create({
  data: { userId, descriptorId },
});

// Remove favorite
await prisma.descriptorFavorite.delete({
  where: { userId_descriptorId: { userId, descriptorId } },
});

// Get user's favorites
await prisma.descriptorFavorite.findMany({
  where: { userId },
  include: { descriptor: true },
  orderBy: { createdAt: 'desc' },
});

// Check if descriptor is favorited
const isFavorited = await prisma.descriptorFavorite.findUnique({
  where: { userId_descriptorId: { userId, descriptorId } },
}) !== null;
```

### Pattern 6: Related Descriptors with pg_trgm Similarity
**What:** Find similar descriptors using trigram similarity on criterion text
**When to use:** "Related descriptors" suggestions (SEARCH-08)
**Example:**
```sql
-- Migration: Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index for trigram similarity on criterionName
CREATE INDEX idx_descriptors_trgm
ON "Descriptor"
USING GIN ("criterionName" gin_trgm_ops);
```

```typescript
// lib/queries/related-descriptors.ts
export async function getRelatedDescriptors(
  descriptorId: string,
  limit: number = 5
) {
  return prisma.$queryRaw<Descriptor[]>`
    SELECT
      d2.*,
      similarity(d1."criterionName", d2."criterionName") as sim_score
    FROM "Descriptor" d1
    CROSS JOIN LATERAL (
      SELECT *
      FROM "Descriptor"
      WHERE id != ${descriptorId}
        AND "deletedAt" IS NULL
        AND similarity("criterionName", d1."criterionName") > 0.3
      ORDER BY similarity("criterionName", d1."criterionName") DESC
      LIMIT ${limit}
    ) d2
    WHERE d1.id = ${descriptorId}
  `;
}
// Source: https://www.postgresql.org/docs/current/pgtrgm.html
```

**Similarity threshold:**
- Default: 0.3 (configurable via `SET pg_trgm.similarity_threshold`)
- Higher = more strict (fewer results, more similar)
- Lower = more permissive (more results, less similar)
- Tune based on user feedback
- Source: [pg_trgm Extension Documentation](https://www.postgresql.org/docs/current/pgtrgm.html)

### Anti-Patterns to Avoid

- **Using Prisma's FTS preview for production**: Known performance issues, no index support; use `$queryRaw` instead
- **OFFSET-based pagination for deep pages**: Performance degrades linearly with offset; use cursor pagination for infinite scroll or limit max pages to 10-20
- **Storing tsvector in generated column**: Functional GIN index achieves same performance without storage/trigger overhead
- **plainto_tsquery for user input**: Doesn't support phrases or operators; use `websearch_to_tsquery` instead
- **Separate queries for counts**: Combine search and count queries when possible to avoid duplicate work
- **Client-side filter state without URL sync**: Breaks sharing, bookmarking, and server-side rendering

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL search param management | Custom useState + URLSearchParams + useRouter | nuqs library | Type safety, 6kB, handles edge cases (null values, array params, history), SSR-friendly |
| Debouncing search input | Custom useEffect with setTimeout | use-debounce library | Official Next.js recommendation, handles cleanup, TypeScript support |
| Text similarity scoring | Custom string comparison algorithm | pg_trgm extension | Production-proven, handles Unicode, configurable threshold, GIN-indexable |
| Full-text query parsing | Manual string manipulation | websearch_to_tsquery | Handles quoted phrases, OR/NOT operators, never throws errors, user-friendly |
| Relevance ranking | Custom scoring logic | ts_rank/ts_rank_cd | Accounts for term frequency, proximity, document length normalization, field weighting |
| Pagination deep pages | OFFSET/LIMIT for all pages | OFFSET for first 10-20 pages, disable thereafter | OFFSET degrades 17x slower at deep pages; limit max pages or use cursor pagination |

**Key insight:** PostgreSQL's text search capabilities are mature and comprehensive. Don't reinvent these features in application code—they're faster, more correct, and better maintained when implemented in the database.

## Common Pitfalls

### Pitfall 1: Prisma FTS Preview Performance Issues
**What goes wrong:** Using Prisma's native `search` field for PostgreSQL FTS results in slow queries (>500ms) even with proper indexes
**Why it happens:** Prisma's FTS implementation doesn't utilize GIN indexes and has known performance issues (GitHub issue #8950)
**How to avoid:** Always use `$queryRaw` with PostgreSQL's native `to_tsvector`/`ts_rank` functions
**Warning signs:**
- Search queries taking >100ms with <1000 matching rows
- EXPLAIN showing sequential scan instead of GIN index scan
**Sources:**
- [Prisma FTS Documentation](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search)
- [GitHub Issue: Postgres Full-Text Search Index is not used](https://github.com/prisma/prisma/issues/8950)

### Pitfall 2: Forgetting to Combine Filters with Search
**What goes wrong:** Implementing filters that replace the search query instead of narrowing it (e.g., selecting a skill clears the keyword search)
**Why it happens:** Treating search and filters as separate states instead of combined query
**How to avoid:** Always combine FTS WHERE clause with filter WHERE clauses using AND
**Warning signs:**
- User selects filter and their search keyword disappears
- URL has either `?q=keyword` OR `?skill=Welding` but never both
**Example fix:**
```sql
-- WRONG: Filter replaces search
WHERE "skillName" = 'Welding'

-- RIGHT: Filter narrows search
WHERE websearch_to_tsquery('english', 'safety') @@ search_vector
  AND "skillName" = 'Welding'
```

### Pitfall 3: Using to_tsquery Instead of websearch_to_tsquery
**What goes wrong:** User input like `dark matter` throws syntax error: "syntax error in tsquery: 'dark matter'"
**Why it happens:** `to_tsquery` requires operator syntax (`dark & matter`), but users enter plain text
**How to avoid:** Always use `websearch_to_tsquery` for user-generated queries; reserve `to_tsquery` for programmatically-built queries
**Warning signs:**
- Syntax errors when users search multi-word phrases
- Having to escape or pre-process user input before querying
**Sources:**
- [PostgreSQL Text Search Controls](https://www.postgresql.org/docs/current/textsearch-controls.html)
- [websearch_to_tsquery documentation](https://pgpedia.info/w/websearch_to_tsquery.html)

### Pitfall 4: Not Normalizing ts_rank Scores
**What goes wrong:** Long descriptors dominate search results even when less relevant, because they contain more term occurrences
**Why it happens:** Default `ts_rank` doesn't account for document length
**How to avoid:** Use normalization option 32 (`ts_rank_cd(vector, query, 32)`) to scale by document length and normalize to 0-1 range
**Warning signs:**
- Longest descriptors always rank first regardless of relevance
- Short, highly-relevant descriptors buried on page 2+
**Example:**
```sql
-- Without normalization: long docs dominate
ts_rank_cd(search_vector, query)

-- With normalization: length-adjusted relevance
ts_rank_cd(search_vector, query, 32)
```
**Source:** [PostgreSQL Text Search Controls - Ranking](https://www.postgresql.org/docs/current/textsearch-controls.html)

### Pitfall 5: Deep Pagination with OFFSET
**What goes wrong:** Page 50 takes 500ms while page 1 takes 10ms
**Why it happens:** PostgreSQL must scan and discard all rows before OFFSET, even with index
**How to avoid:**
- Limit max pages to 10-20 for OFFSET-based pagination
- Use cursor-based pagination for infinite scroll
- Show "Page X of 20" instead of "Page X of 500"
**Warning signs:**
- Linear performance degradation as page number increases
- EXPLAIN showing large number of rows examined vs returned
**Performance data:** 17x slowdown when accessing page 1000 vs page 1 (source: Cursor Pagination Guide)
**Sources:**
- [Keyset Cursors, Not Offsets, for Postgres Pagination](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/)
- [Optimizing SQL Pagination in Postgres](https://readyset.io/blog/optimizing-sql-pagination-in-postgres)

### Pitfall 6: Not Setting Reasonable Debounce Delay
**What goes wrong:** Too low (50ms) = excessive server load; too high (1000ms) = feels unresponsive
**Why it happens:** Guessing debounce delay without user testing
**How to avoid:** Start with 300ms (official Next.js recommendation), adjust based on server latency
**Warning signs:**
- Network tab shows 10+ search requests per second
- Users complain search feels "laggy" or "delayed"
**Tuning guide:**
- Fast server (<50ms): 200-300ms debounce
- Normal server (50-150ms): 300-400ms debounce
- Slow server (>150ms): 400-500ms debounce
**Source:** [Next.js Tutorial: Adding Search and Pagination](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination)

### Pitfall 7: Forgetting NULL Checks in tsvector Expressions
**What goes wrong:** Index doesn't get used, or NULL values cause incorrect ranking
**Why it happens:** Descriptor fields (excellent, good, pass) can be NULL
**How to avoid:** Always wrap fields in `coalesce(field, '')` in tsvector expressions
**Warning signs:**
- GIN index exists but EXPLAIN shows sequential scan
- Some descriptors missing from search results
**Example:**
```sql
-- WRONG: NULL breaks index
to_tsvector('english', "excellent")

-- RIGHT: coalesce handles NULL
to_tsvector('english', coalesce("excellent", ''))
```

## Code Examples

Verified patterns from official sources:

### Create Functional GIN Index for Multi-Field FTS
```sql
-- Migration: 20XX_add_fts_indexes.sql
-- Create functional GIN index combining multiple weighted fields
CREATE INDEX idx_descriptors_fts
ON "Descriptor"
USING GIN (
  setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
);

-- Add pg_trgm for similarity search (related descriptors)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_descriptors_trgm
ON "Descriptor"
USING GIN ("criterionName" gin_trgm_ops);

-- Standard B-tree indexes for filter columns
CREATE INDEX idx_descriptors_skill_name ON "Descriptor"("skillName") WHERE "deletedAt" IS NULL;
CREATE INDEX idx_descriptors_category ON "Descriptor"("category") WHERE "deletedAt" IS NULL;
CREATE INDEX idx_descriptors_quality ON "Descriptor"("qualityIndicator") WHERE "deletedAt" IS NULL;
-- Source: https://www.postgresql.org/docs/current/textsearch-indexes.html
```

### Full-Text Search with Relevance Ranking
```typescript
// lib/queries/search-descriptors.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface SearchResult {
  id: string;
  code: string;
  criterionName: string;
  excellent: string | null;
  good: string | null;
  pass: string | null;
  belowPass: string | null;
  skillName: string;
  category: string | null;
  tags: string[];
  qualityIndicator: string;
  rank?: number;
}

export async function searchDescriptors(
  query: string,
  filters: {
    skillName?: string;
    category?: string;
    qualityIndicator?: string;
  } = {},
  pagination: { limit: number; offset: number } = { limit: 20, offset: 0 }
): Promise<SearchResult[]> {
  const { skillName, category, qualityIndicator } = filters;
  const { limit, offset } = pagination;

  // Build WHERE conditions
  const conditions: string[] = ['"deletedAt" IS NULL'];
  const params: any[] = [query];
  let paramIndex = 2;

  if (query) {
    conditions.push(`
      websearch_to_tsquery('english', $1) @@ (
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
      )
    `);
  }

  if (skillName) {
    conditions.push(`"skillName" = $${paramIndex}`);
    params.push(skillName);
    paramIndex++;
  }

  if (category) {
    conditions.push(`"category" = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (qualityIndicator) {
    conditions.push(`"qualityIndicator" = $${paramIndex}`);
    params.push(qualityIndicator);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const sql = `
    SELECT
      id,
      code,
      "criterionName",
      excellent,
      good,
      pass,
      "belowPass",
      "skillName",
      category,
      tags,
      "qualityIndicator",
      ts_rank_cd(
        setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("belowPass", '')), 'B'),
        websearch_to_tsquery('english', $1),
        32  -- Normalize to 0-1 range, adjust for document length
      ) as rank
    FROM "Descriptor"
    WHERE ${whereClause}
    ORDER BY rank DESC, "criterionName" ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  return prisma.$queryRaw(Prisma.sql([sql], ...params)) as Promise<SearchResult[]>;
}
// Source: https://www.postgresql.org/docs/current/textsearch-controls.html
```

### URL-Based Search State with nuqs
```typescript
// app/descriptors/page.tsx (Server Component)
import { Suspense } from 'react';
import { SearchInput } from './components/SearchInput';
import { FilterPanel } from './components/FilterPanel';
import { DescriptorList } from './components/DescriptorList';
import { searchDescriptors } from '@/lib/queries/search-descriptors';
import { getFacetCounts } from '@/lib/queries/facet-counts';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    skill?: string;
    category?: string;
    quality?: string;
    page?: string;
  }>;
}

export default async function DescriptorsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = 20;

  const [results, facets] = await Promise.all([
    searchDescriptors(
      params.q || '',
      {
        skillName: params.skill,
        category: params.category,
        qualityIndicator: params.quality,
      },
      { limit, offset: (page - 1) * limit }
    ),
    getFacetCounts(params.q),
  ]);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Descriptor Library</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <aside className="md:col-span-1">
          <Suspense fallback={<div>Loading filters...</div>}>
            <FilterPanel facets={facets} />
          </Suspense>
        </aside>

        <main className="md:col-span-3">
          <SearchInput />
          <Suspense fallback={<div>Loading results...</div>}>
            <DescriptorList results={results} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

// app/descriptors/components/SearchInput.tsx (Client Component)
'use client';

import { useQueryState } from 'nuqs';
import { useDebouncedCallback } from 'use-debounce';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function SearchInput() {
  const [query, setQuery] = useQueryState('q', {
    defaultValue: '',
    shallow: false, // Server re-render on change
  });

  const handleSearch = useDebouncedCallback((value: string) => {
    setQuery(value || null); // null removes param from URL
  }, 300);

  return (
    <div className="relative mb-6">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search descriptors by keyword..."
        defaultValue={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}

// app/descriptors/components/FilterPanel.tsx (Client Component)
'use client';

import { useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';

interface Facets {
  skillAreas: Array<{ name: string; count: number }>;
  categories: Array<{ name: string; count: number }>;
  qualities: Array<{ name: string; count: number }>;
}

export function FilterPanel({ facets }: { facets: Facets }) {
  const [skillArea, setSkillArea] = useQueryState('skill');
  const [category, setCategory] = useQueryState('category');
  const [quality, setQuality] = useQueryState('quality');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Skill Area</h3>
        <div className="space-y-2">
          {facets.skillAreas.map(({ name, count }) => (
            <Button
              key={name}
              variant={skillArea === name ? 'default' : 'ghost'}
              size="sm"
              className="w-full justify-between"
              onClick={() => setSkillArea(skillArea === name ? null : name)}
            >
              <span>{name}</span>
              <span className="text-muted-foreground">({count})</span>
            </Button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Category</h3>
        <div className="space-y-2">
          {facets.categories.map(({ name, count }) => (
            <Button
              key={name}
              variant={category === name ? 'default' : 'ghost'}
              size="sm"
              className="w-full justify-between"
              onClick={() => setCategory(category === name ? null : name)}
            >
              <span>{name}</span>
              <span className="text-muted-foreground">({count})</span>
            </Button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Quality</h3>
        <div className="space-y-2">
          {facets.qualities.map(({ name, count }) => (
            <Button
              key={name}
              variant={quality === name ? 'default' : 'ghost'}
              size="sm"
              className="w-full justify-between"
              onClick={() => setQuality(quality === name ? null : name)}
            >
              <span>{name}</span>
              <span className="text-muted-foreground">({count})</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
// Source: https://nuqs.dev/ and https://nextjs.org/learn/dashboard-app/adding-search-and-pagination
```

### Faceted Filter Counts
```typescript
// lib/queries/facet-counts.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface FacetCount {
  name: string;
  count: number;
}

export interface Facets {
  skillAreas: FacetCount[];
  categories: FacetCount[];
  qualities: FacetCount[];
}

export async function getFacetCounts(searchQuery?: string): Promise<Facets> {
  // Build search condition if query provided
  const searchCondition = searchQuery
    ? Prisma.sql`
        WHERE websearch_to_tsquery('english', ${searchQuery}) @@ (
          setweight(to_tsvector('english', coalesce("criterionName", '')), 'A') ||
          setweight(to_tsvector('english', coalesce("excellent", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("good", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("pass", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("belowPass", '')), 'B')
        )
        AND "deletedAt" IS NULL
      `
    : Prisma.sql`WHERE "deletedAt" IS NULL`;

  // Execute facet count queries in parallel
  const [skillAreas, categories, qualities] = await Promise.all([
    prisma.$queryRaw<FacetCount[]>`
      SELECT "skillName" as name, COUNT(*)::int as count
      FROM "Descriptor"
      ${searchCondition}
      GROUP BY "skillName"
      ORDER BY count DESC, name ASC
    `,
    prisma.$queryRaw<FacetCount[]>`
      SELECT category as name, COUNT(*)::int as count
      FROM "Descriptor"
      ${searchCondition}
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC, name ASC
    `,
    prisma.$queryRaw<FacetCount[]>`
      SELECT "qualityIndicator" as name, COUNT(*)::int as count
      FROM "Descriptor"
      ${searchCondition}
      GROUP BY "qualityIndicator"
      ORDER BY count DESC
    `,
  ]);

  return {
    skillAreas,
    categories,
    qualities,
  };
}
// Source: https://www.cybertec-postgresql.com/en/faceting-large-result-sets/
```

### User Bookmarks/Favorites
```typescript
// lib/actions/toggle-favorite.ts
'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function toggleFavorite(descriptorId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  // Check if already favorited
  const existing = await prisma.descriptorFavorite.findUnique({
    where: {
      userId_descriptorId: {
        userId,
        descriptorId,
      },
    },
  });

  if (existing) {
    // Remove favorite
    await prisma.descriptorFavorite.delete({
      where: {
        userId_descriptorId: {
          userId,
          descriptorId,
        },
      },
    });
  } else {
    // Add favorite
    await prisma.descriptorFavorite.create({
      data: {
        userId,
        descriptorId,
      },
    });
  }

  revalidatePath('/descriptors');
  return { success: true };
}

// lib/queries/get-favorites.ts
export async function getUserFavorites(userId: string) {
  return prisma.descriptorFavorite.findMany({
    where: { userId },
    include: {
      descriptor: {
        where: { deletedAt: null },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Check if specific descriptor is favorited
export async function isFavorited(userId: string, descriptorId: string) {
  const favorite = await prisma.descriptorFavorite.findUnique({
    where: {
      userId_descriptorId: {
        userId,
        descriptorId,
      },
    },
  });
  return favorite !== null;
}
```

### Related Descriptors with pg_trgm
```typescript
// lib/queries/related-descriptors.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface RelatedDescriptor {
  id: string;
  code: string;
  criterionName: string;
  skillName: string;
  category: string | null;
  qualityIndicator: string;
  similarityScore: number;
}

export async function getRelatedDescriptors(
  descriptorId: string,
  limit: number = 5,
  similarityThreshold: number = 0.3
): Promise<RelatedDescriptor[]> {
  return prisma.$queryRaw<RelatedDescriptor[]>`
    SELECT
      d2.id,
      d2.code,
      d2."criterionName",
      d2."skillName",
      d2.category,
      d2."qualityIndicator",
      similarity(d1."criterionName", d2."criterionName") as "similarityScore"
    FROM "Descriptor" d1
    CROSS JOIN LATERAL (
      SELECT *
      FROM "Descriptor"
      WHERE id != ${descriptorId}
        AND "deletedAt" IS NULL
        AND similarity("criterionName", d1."criterionName") > ${similarityThreshold}
      ORDER BY similarity("criterionName", d1."criterionName") DESC
      LIMIT ${limit}
    ) d2
    WHERE d1.id = ${descriptorId}
    ORDER BY "similarityScore" DESC
  `;
}
// Source: https://www.postgresql.org/docs/current/pgtrgm.html
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma FTS preview feature | $queryRaw with native PostgreSQL FTS | 2024-2025 | Prisma FTS remains in preview with performance issues; raw SQL is production standard |
| Manual URLSearchParams manipulation | nuqs library | 2024-2025 | Type-safe, SSR-friendly, 6kB, handles edge cases |
| Stored tsvector columns with triggers | Functional GIN indexes | Always preferred | No storage duplication, no trigger maintenance, same performance |
| plainto_tsquery for user input | websearch_to_tsquery | PostgreSQL 11+ (2018) | User-friendly syntax (quoted phrases, OR, NOT), never throws errors |
| OFFSET/LIMIT for all pagination | OFFSET for first N pages, then limit | 2025+ | OFFSET degrades at scale; limit max pages or use cursor pagination |
| ts_rank without normalization | ts_rank_cd with normalization 32 | Best practice 2025+ | Length-normalized relevance prevents long docs from dominating |

**Deprecated/outdated:**
- **Elasticsearch for <100K documents**: PostgreSQL FTS now handles small-medium corpora efficiently; Elasticsearch overhead not justified
- **Storing tsvector in materialized columns**: Functional indexes achieve same performance without storage/trigger complexity
- **tsquery for raw user input**: Throws syntax errors; websearch_to_tsquery is user-friendly replacement
- **Unlimited OFFSET pagination**: Known performance anti-pattern; limit to first 10-20 pages

## Open Questions

Things that couldn't be fully resolved:

1. **BM25 Ranking Algorithm Availability**
   - What we know: pg_textsearch extension by Timescale implements BM25 (industry-standard relevance), expected GA Feb 2026
   - What's unclear: Whether it will be stable/production-ready by Phase 3 implementation
   - Recommendation: Start with ts_rank_cd (normalization 32), monitor pg_textsearch for GA release, potentially upgrade ranking in future iteration if BM25 shows measurably better results
   - Source: [pg_textsearch GitHub](https://github.com/timescale/pg_textsearch)

2. **Optimal Similarity Threshold for Related Descriptors**
   - What we know: pg_trgm default is 0.3, range is 0.0-1.0, higher = stricter
   - What's unclear: What threshold works best for marking scheme descriptors (technical terminology vs natural language)
   - Recommendation: Start with 0.3, collect user feedback on "related descriptors" quality, tune based on precision/recall tradeoff
   - Source: [pg_trgm documentation](https://www.postgresql.org/docs/current/pgtrgm.html)

3. **Facet Count Performance at Scale**
   - What we know: Standard SQL aggregation works for <1M rows, pgfaceting extension handles >60M rows in 155ms
   - What's unclear: Current corpus is ~12K; if it grows to >100K, will standard approach still meet <100ms target?
   - Recommendation: Implement with standard SQL, monitor query performance in production, add pgfaceting extension only if performance degrades below target
   - Source: [pgfaceting extension](https://github.com/cybertec-postgresql/pgfaceting)

4. **TypedSQL Adoption for Type Safety**
   - What we know: Prisma TypedSQL provides type-safe raw SQL, released v5.19.0, requires .sql files
   - What's unclear: Development workflow impact (writing SQL in separate files vs inline), IDE support quality, debugging experience
   - Recommendation: Start with $queryRaw and TypeScript interfaces for result types, evaluate TypedSQL migration in Phase 4 if type safety issues emerge
   - Source: [Prisma TypedSQL documentation](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/typedsql)

## Sources

### Primary (HIGH confidence)
- [PostgreSQL 18 Text Search Documentation](https://www.postgresql.org/docs/current/textsearch-indexes.html) - GIN index best practices, functional indexes
- [PostgreSQL Text Search Controls](https://www.postgresql.org/docs/current/textsearch-controls.html) - ts_rank, ts_rank_cd, weighting, normalization
- [pg_trgm Extension Documentation](https://www.postgresql.org/docs/current/pgtrgm.html) - Trigram similarity for related descriptors
- [Prisma Full-Text Search Documentation](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search) - Official FTS preview feature status and limitations
- [Next.js App Router: Adding Search and Pagination](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination) - Official tutorial with use-debounce pattern
- [nuqs Documentation](https://nuqs.dev/) - Type-safe search params library

### Secondary (MEDIUM confidence)
- [Neon PostgreSQL Full-Text Search Guide](https://neon.com/postgresql/postgresql-indexes/postgresql-full-text-search) - Practical implementation examples
- [Crunchy Data: Postgres Full-Text Search Blog](https://www.crunchydata.com/blog/postgres-full-text-search-a-search-engine-in-a-database) - Architecture patterns and best practices
- [CYBERTEC: Faceting Large Result Sets](https://www.cybertec-postgresql.com/en/faceting-large-result-sets/) - Faceted search performance optimization
- [ParadeDB: Faceting Performance](https://www.paradedb.com/blog/faceting) - 14x faster faceting with columnar indexes
- [Keyset Cursors for Pagination](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/) - Cursor vs OFFSET performance comparison
- [PostgreSQL Full-Text Search with Prisma - Michael Svanström](https://www.svanstrom.nu/2024/03/05/postgresql-full-text-search-with-prisma/) - Practical Prisma integration patterns

### Tertiary (LOW confidence - for context)
- [Medium: PostgreSQL FTS Alternative to Elasticsearch](https://iniakunhuda.medium.com/postgresql-full-text-search-a-powerful-alternative-to-elasticsearch-for-small-to-medium-d9524e001fe0) - Use case comparison
- [Medium: Bulletproof FTS in Prisma](https://medium.com/@chauhananubhav16/bulletproof-full-text-search-fts-in-prisma-with-postgresql-tsvector-without-migration-drift-c421f63aaab3) - Community patterns
- [GitHub: pg_textsearch](https://github.com/timescale/pg_textsearch) - BM25 extension (pre-release, v0.5.0-dev, GA expected Feb 2026)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - PostgreSQL FTS is mature (15+ years), official documentation comprehensive, Prisma limitations well-documented
- Architecture patterns: HIGH - All patterns verified with official PostgreSQL docs and Next.js documentation
- Pitfalls: HIGH - Verified with official docs and GitHub issues (Prisma #8950, #12344)
- Performance optimization: MEDIUM - General guidance from official docs, specific tuning requires load testing with production data
- Related descriptors: MEDIUM - pg_trgm well-documented, but optimal threshold needs empirical tuning

**Research date:** 2026-02-02
**Valid until:** 2026-04-02 (60 days - PostgreSQL stable, but Prisma/Next.js ecosystem evolving)

**Key assumptions:**
- Corpus size remains <100K descriptors (current: ~12K from 58 skills)
- Performance target <100ms for typical queries (keyword + 2-3 filters)
- Users comfortable with web search syntax (quoted phrases, OR, NOT)
- English language only (as per PROJECT.md requirements)

**Technologies researched:**
- PostgreSQL 16+ full-text search (tsvector, ts_rank, GIN indexes)
- Prisma ORM 5.20+ ($queryRaw, TypedSQL preview)
- Next.js 14.2+ App Router (useSearchParams, Server Components)
- nuqs 2.x (type-safe URL state management)
- pg_trgm extension (trigram similarity)

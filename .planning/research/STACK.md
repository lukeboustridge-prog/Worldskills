# Stack Research: Descriptor Library & Marking Scheme

**Domain:** Document analysis, full-text search, and marking scheme generation
**Researched:** 2026-02-01
**Confidence:** HIGH

## Context

This research focuses on **stack additions** needed for descriptor library and marking scheme features in an existing WorldSkills management app. The existing stack (Next.js 14, Prisma/PostgreSQL, S3, Resend) is validated and operational.

**New capabilities required:**
- Parse 58 Excel marking schemes to extract descriptors
- Store descriptors with metadata (skill, criterion type, performance level, tags)
- Enable full-text search across descriptors
- Build marking schemes in-app
- Export marking schemes to Excel and PDF

## Recommended Stack Additions

### Excel Parsing & Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SheetJS (xlsx) | Latest (CDN) | Parse Excel files to extract descriptors | Industry standard with 47M+ weekly npm downloads. Supports both reading and writing .xlsx files. **Critical: Do NOT use npm registry version** - install from official CDN to avoid security vulnerabilities in outdated v0.18.5 |
| ExcelJS | ^4.4.0 | Export marking schemes to styled Excel | Best for creating Excel files with rich formatting, styles, formulas. Better write performance than SheetJS. 1.5M+ weekly downloads |

**Recommendation:** Use **SheetJS for reading** Excel marking schemes (one-time import) and **ExcelJS for writing** (ongoing exports with professional styling).

### Full-Text Search

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL Full-Text Search | Built-in | Search descriptors by text content | Already have PostgreSQL. Native FTS with GIN indexes provides excellent performance for small-to-medium datasets (< 1M descriptors). Avoids Elasticsearch complexity and cost |
| Prisma Raw SQL | N/A | Query PostgreSQL FTS | Prisma's built-in FTS support is preview-only for PostgreSQL with known index issues. Use `prisma.$queryRaw` with `to_tsvector` and `ts_rank` for production-ready implementation |

**Recommendation:** Use **PostgreSQL native FTS with raw SQL queries** instead of Prisma's preview FTS feature. This provides full control over ranking, multi-column search, and index usage.

### PDF Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @react-pdf/renderer | ^4.3.2 (upgrade from ^3.4.4) | Generate marking scheme PDFs | Already in project (v3.4.4). Upgrade to v4.3.2 for React 19 support and bug fixes. React-based API makes it easy to create branded PDFs. Works in Next.js API routes with workarounds |

**Note:** Project currently has @react-pdf/renderer v3.4.4. Upgrade to v4.3.2 required.

### Data Storage & Categorization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL JSONB | Built-in | Store tags array on descriptors | Already using PostgreSQL. JSONB columns with GIN indexes provide flexible tagging with excellent query performance for < 100K descriptors |
| Prisma Enums | Built-in | Store fixed categories (criterion type, performance level) | Already using Prisma enums (see Role, DeliverableState). Perfect for fixed, small value sets like "technical", "behavioral", "safety" |

**Recommendation:** Use **Prisma enums** for fixed categories (criterion type, performance level) and **JSONB arrays** for flexible tags.

## Installation Commands

```bash
# Excel parsing (read)
npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz

# Excel generation (write with styling)
npm install exceljs@^4.4.0

# PDF generation (upgrade existing)
npm install @react-pdf/renderer@^4.3.2

# Type definitions
npm install -D @types/node
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Excel Parsing | SheetJS (CDN) | xlsx-populate | xlsx-populate is designed for modifying existing files, not parsing. SheetJS has broader feature set and better documentation |
| Excel Export | ExcelJS | SheetJS write API | ExcelJS provides superior styling, data validation, and formula support. Better DX for complex exports |
| PDF Generation | @react-pdf/renderer | PDFKit | PDFKit uses canvas API (harder to maintain). @react-pdf/renderer uses React components (matches existing Next.js stack) |
| PDF Generation | @react-pdf/renderer | Puppeteer | Puppeteer requires headless Chrome (300MB+ memory overhead). Overkill for structured documents. Use only if pixel-perfect HTML rendering required |
| Full-Text Search | PostgreSQL FTS | Elasticsearch | Elasticsearch adds infrastructure complexity (another service to run). PostgreSQL FTS handles < 1M documents easily. Only consider Elasticsearch if hitting performance limits |
| Tags Storage | JSONB array | Separate tags table | Tags table adds join complexity. JSONB + GIN index provides same query performance for this scale without normalization overhead |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `npm install xlsx` | Installs v0.18.5 with known high-severity vulnerabilities (Prototype Pollution, DoS). SheetJS stopped publishing to npm in 2023 | Install from CDN: `npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz` |
| Prisma fullTextSearch (PostgreSQL) | Still in **Preview** as of 2026. Known issue: doesn't use GIN indexes, causing slow queries | Use `prisma.$queryRaw` with PostgreSQL `to_tsvector`, `to_tsquery`, `ts_rank` directly |
| jsPDF (server-side) | Designed for browser, relies on html2canvas. Doesn't run well in Node.js | Use @react-pdf/renderer for server-side PDF generation in Next.js |
| Separate tags table (normalized) | Overkill for this scale. Adds join overhead | Use JSONB array column with GIN index for flexible tagging |

## Integration Patterns

### Excel Parsing (One-Time Import)

```typescript
// app/api/descriptors/import/route.ts
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const buffer = await file.arrayBuffer();

  // Parse Excel
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);

  // Store in Prisma (bulk insert)
  // ...
}
```

### Full-Text Search (PostgreSQL with Prisma)

```typescript
// lib/search/descriptors.ts
import { prisma } from '@/lib/prisma';

export async function searchDescriptors(query: string) {
  return prisma.$queryRaw`
    SELECT
      id,
      text,
      skill,
      ts_rank(to_tsvector('english', text), to_tsquery('english', ${query})) as rank
    FROM "Descriptor"
    WHERE to_tsvector('english', text) @@ to_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT 50
  `;
}
```

**Migration for GIN index:**
```sql
-- Add tsvector column for performance
ALTER TABLE "Descriptor" ADD COLUMN text_search tsvector
  GENERATED ALWAYS AS (to_tsvector('english', text)) STORED;

-- Create GIN index
CREATE INDEX descriptor_text_search_idx ON "Descriptor" USING GIN(text_search);
```

### Excel Export (Next.js API Route)

```typescript
// app/api/marking-schemes/[id]/export-excel/route.ts
import ExcelJS from 'exceljs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const scheme = await prisma.markingScheme.findUnique({
    where: { id: params.id },
    include: { descriptors: true }
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Marking Scheme');

  // Add headers with styling
  worksheet.columns = [
    { header: 'Criterion', key: 'criterion', width: 30 },
    { header: 'Descriptor', key: 'descriptor', width: 60 }
  ];

  // Add data
  scheme.descriptors.forEach(d => {
    worksheet.addRow({ criterion: d.criterion, descriptor: d.text });
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="marking-scheme-${params.id}.xlsx"`
    }
  });
}
```

### PDF Export (Next.js API Route)

```typescript
// app/api/marking-schemes/[id]/export-pdf/route.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { MarkingSchemePDF } from '@/components/pdf/MarkingSchemePDF';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const scheme = await prisma.markingScheme.findUnique({
    where: { id: params.id },
    include: { descriptors: true }
  });

  // Render React PDF component to buffer
  const buffer = await renderToBuffer(<MarkingSchemePDF scheme={scheme} />);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="marking-scheme-${params.id}.pdf"`
    }
  });
}
```

**Note for Next.js 14 App Router:** @react-pdf/renderer v4 works with Next.js 14.1.1+ but may require adding to `serverComponentsExternalPackages` in next.config.js if encountering issues:

```javascript
// next.config.js
module.exports = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer']
  }
}
```

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| SheetJS (latest) | Node.js 20.x | Use CommonJS `require()` in Node.js, not ESM |
| ExcelJS 4.4.0 | Node.js 20.x, Next.js 14 | Full ESM and CommonJS support |
| @react-pdf/renderer 4.3.2 | React 18, React 19, Next.js 14.1.1+ | App Router requires Next.js 14.1.1+ for stability |
| PostgreSQL FTS | PostgreSQL 12+ | GIN indexes available since PostgreSQL 8.2 |

## Stack-Specific Considerations

### Why Not Upgrade to Next.js 15?

@react-pdf/renderer has known issues with Next.js 15 App Router (GitHub issue #2994). Stick with **Next.js 14.2.10** (current version in project) until compatibility is resolved.

### Prisma Schema Additions

```prisma
// schema.prisma additions

enum CriterionType {
  TECHNICAL
  BEHAVIORAL
  SAFETY
  QUALITY
}

enum PerformanceLevel {
  EXCELLENT
  GOOD
  SATISFACTORY
  NEEDS_IMPROVEMENT
}

model Descriptor {
  id                String            @id @default(cuid())
  text              String            @db.Text
  skillId           String?
  criterionType     CriterionType
  performanceLevel  PerformanceLevel
  tags              Json              @default("[]") // Array of strings
  sourceFile        String?           // Original Excel filename
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  // For full-text search (generated column)
  textSearch        Unsupported("tsvector")?

  skill             Skill?            @relation(fields: [skillId], references: [id])
  markingSchemes    MarkingSchemeDescriptor[]

  @@index([skillId])
  @@index([criterionType])
  @@index([performanceLevel])
  // GIN index created via migration SQL
}

model MarkingScheme {
  id          String                    @id @default(cuid())
  name        String
  skillId     String
  createdBy   String
  createdAt   DateTime                  @default(now())
  updatedAt   DateTime                  @updatedAt

  skill       Skill                     @relation(fields: [skillId], references: [id])
  descriptors MarkingSchemeDescriptor[]

  @@index([skillId])
}

model MarkingSchemeDescriptor {
  schemeId     String
  descriptorId String
  position     Int

  scheme       MarkingScheme @relation(fields: [schemeId], references: [id], onDelete: Cascade)
  descriptor   Descriptor    @relation(fields: [descriptorId], references: [id], onDelete: Cascade)

  @@id([schemeId, descriptorId])
  @@index([schemeId])
}
```

## Performance Characteristics

| Operation | Expected Performance | Scaling Considerations |
|-----------|---------------------|------------------------|
| Excel parsing (58 files, ~500KB each) | < 5s total | One-time import, acceptable |
| Full-text search (10K descriptors) | < 100ms with GIN index | PostgreSQL FTS scales to 100K+ docs with proper indexing |
| PDF generation (20-page marking scheme) | 1-2s | @react-pdf/renderer is CPU-bound, consider background job for large exports |
| Excel generation (200-row marking scheme) | < 500ms | ExcelJS streaming API available for 10K+ rows |
| Tag queries (JSONB GIN index) | < 50ms | JSONB containment queries with GIN index are fast |

## Migration Path

1. **Phase 1: Add packages**
   - Install SheetJS (CDN), ExcelJS, upgrade @react-pdf/renderer
   - Add TypeScript types

2. **Phase 2: Database schema**
   - Add Prisma models (Descriptor, MarkingScheme, enums)
   - Run migration to create tables
   - Add GIN indexes for full-text search and JSONB tags

3. **Phase 3: Import pipeline**
   - Build Excel parsing API route
   - Parse 58 marking schemes
   - Bulk insert descriptors with metadata

4. **Phase 4: Search & export**
   - Implement full-text search API
   - Build marking scheme builder UI
   - Implement Excel/PDF export routes

## Confidence Assessment

| Technology | Confidence | Rationale |
|------------|-----------|-----------|
| SheetJS (CDN install) | **HIGH** | Official installation method, verified via [SheetJS docs](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). Security warning about npm registry version confirmed across multiple sources |
| ExcelJS | **HIGH** | Mature library (4.4.0 stable), excellent documentation, widely used for server-side Excel generation. [npm comparison](https://npm-compare.com/exceljs,xlsx,xlsx-populate) shows strong adoption |
| PostgreSQL FTS | **HIGH** | [Official PostgreSQL docs](https://www.postgresql.org/docs/current/textsearch.html) confirm GIN index support and performance characteristics. Multiple production case studies available |
| Prisma raw SQL for FTS | **HIGH** | Prisma's built-in FTS is [documented as Preview](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search) with known index issues. Raw SQL is standard workaround |
| @react-pdf/renderer upgrade | **MEDIUM** | v4.3.2 is latest, but [Next.js compatibility issues exist](https://github.com/diegomura/react-pdf/issues/2460) with App Router. Workarounds documented, requires testing |
| JSONB for tags | **HIGH** | [PostgreSQL JSONB + GIN](https://www.crunchydata.com/blog/tags-aand-postgres-arrays-a-purrfect-combination) is proven pattern for tagging at this scale |

## Sources

### SheetJS
- [SheetJS Next.js Documentation](https://docs.sheetjs.com/docs/demos/static/nextjs/)
- [SheetJS Installation (Node.js)](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)
- [SheetJS CDN](https://cdn.sheetjs.com/)
- [npm package security warning](https://git.sheetjs.com/sheetjs/sheetjs/issues/3098)

### Excel Libraries
- [Excel Libraries Comparison (npm-compare)](https://npm-compare.com/exceljs,xlsx,xlsx-populate)
- [Next.js Excel Download Guide](https://www.davegray.codes/posts/how-to-download-xlsx-files-from-a-nextjs-route-handler)
- [Export Excel in Next.js 14](https://emdiya.medium.com/how-to-export-data-into-excel-in-next-js-14-820edf8eae6a)

### PostgreSQL Full-Text Search
- [PostgreSQL FTS Documentation](https://www.postgresql.org/docs/current/textsearch.html)
- [Postgres Full-Text Search Guide (Crunchy Data)](https://www.crunchydata.com/blog/postgres-full-text-search-a-search-engine-in-a-database)
- [PostgreSQL FTS vs Elasticsearch](https://iniakunhuda.medium.com/postgresql-full-text-search-a-powerful-alternative-to-elasticsearch-for-small-to-medium-d9524e001fe0)

### Prisma Full-Text Search
- [Prisma FTS Documentation](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search)
- [Prisma PostgreSQL FTS Implementation](https://www.pedroalonso.net/blog/postgres-full-text-search/)
- [Prisma FTS Index Issue](https://github.com/prisma/prisma/discussions/12276)

### PDF Generation
- [Best PDF Libraries for Node.js](https://blog.logrocket.com/best-html-pdf-libraries-node-js/)
- [Top PDF Libraries 2025](https://www.nutrient.io/blog/top-js-pdf-libraries/)
- [react-pdf GitHub Issues](https://github.com/diegomura/react-pdf)

### Tagging Strategies
- [PostgreSQL Tags + Arrays (Crunchy Data)](https://www.crunchydata.com/blog/tags-aand-postgres-arrays-a-purrfect-combination)
- [PostgreSQL Tagging Best Practices](https://www.alibabacloud.com/blog/optimizing-real-time-tagging-on-postgresql_594689)
- [Enum vs Foreign Key (Supabase)](https://supabase.com/docs/guides/database/postgres/enums)

---

*Stack research for: WorldSkills Descriptor Library & Marking Scheme*
*Researched: 2026-02-01*
*Confidence: HIGH*

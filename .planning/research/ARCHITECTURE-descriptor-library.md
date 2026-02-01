# Architecture Research: Descriptor Library & Marking Scheme

**Domain:** Educational Assessment Tools - Descriptor Library with Full-Text Search and Marking Scheme Builder
**Researched:** 2026-02-01
**Confidence:** HIGH

## Integration Architecture

This is a **subsequent milestone** adding descriptor library and marking scheme features to an existing Next.js 14 application with Prisma ORM and PostgreSQL.

### Existing Architecture (Current State)

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 14 App Router                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Pages   │  │ Server  │  │  API    │  │ Comp.   │        │
│  │ (RSC)   │  │ Actions │  │ Routes  │  │ (Client)│        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│                    Business Logic Layer                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  src/lib/*.ts (auth, permissions, deliverables)     │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    Data Access Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  Prisma  │  │  S3/R2   │  │  Email   │                   │
│  │  Client  │  │  Storage │  │  (Resend)│                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
   PostgreSQL        AWS S3         External
   Database          Storage        Services
```

**Current Patterns:**
- Next.js 14 App Router with Server Components (RSC)
- Server Actions for mutations (`"use server"`)
- API Routes for file operations (presigned URLs, downloads)
- Prisma ORM for all database operations
- Zod for input validation
- Role-based access control (SA, SCM, Admin, SkillTeam, Secretariat)
- AWS S3 for document storage (deliverables, meeting docs)
- Activity logging for audit trail

### New Architecture (Descriptor Library + Marking Scheme)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Next.js 14 App Router                         │
├─────────────────────────────────────────────────────────────────────┤
│  NEW: Descriptor Library Pages          NEW: Marking Scheme Builder │
│  ┌─────────────────────────────┐       ┌──────────────────────────┐ │
│  │ /descriptors (browse/search)│       │ /marking-schemes (CRUD)  │ │
│  │ /descriptors/[id] (detail)  │       │ /marking-schemes/[id]    │ │
│  └────────────┬────────────────┘       └───────────┬──────────────┘ │
│               │                                    │                 │
├───────────────┴────────────────────────────────────┴─────────────────┤
│                    NEW: Business Logic Layer                         │
│  ┌───────────────────────┐  ┌──────────────────────────────────┐    │
│  │ src/lib/descriptors.ts│  │ src/lib/marking-schemes.ts       │    │
│  │ - Search/filter logic │  │ - CRUD operations                │    │
│  │ - Tag management      │  │ - Descriptor linking             │    │
│  │ - Import from Excel   │  │ - Validation                     │    │
│  └───────────────────────┘  └──────────────────────────────────┘    │
│  ┌───────────────────────┐  ┌──────────────────────────────────┐    │
│  │ src/lib/excel-parser.ts│ │ src/lib/export-generator.ts      │    │
│  │ - One-time Excel parse│  │ - Excel export (exceljs)         │    │
│  │ - Descriptor extraction│ │ - PDF export (puppeteer)         │    │
│  └───────────────────────┘  └──────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                    NEW: Data Access Layer                            │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │  Prisma Client (extended with fullTextSearch)            │       │
│  │  - Descriptor queries with ts_vector search              │       │
│  │  - Marking scheme CRUD with descriptor relations         │       │
│  └──────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Database                           │
│  NEW TABLES:                                                         │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │   Descriptor   │  │ DescriptorTag    │  │ MarkingScheme    │    │
│  │   (with GIN    │  │                  │  │                  │    │
│  │    FTS index)  │  │                  │  │                  │    │
│  └────────┬───────┘  └────────┬─────────┘  └────────┬─────────┘    │
│           │                   │                     │               │
│           │    ┌──────────────┴─────────────┐       │               │
│           │    │                            │       │               │
│  ┌────────▼────▼───────┐       ┌────────────▼───────▼─────┐        │
│  │DescriptorTagRelation│       │MarkingSchemeDescriptor   │        │
│  │ (many-to-many)      │       │ (many-to-many with order)│        │
│  └─────────────────────┘       └──────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema Design

### New Tables

#### 1. Descriptor

Stores individual descriptors parsed from source documents or created manually.

```prisma
model Descriptor {
  id          String   @id @default(cuid())
  code        String   @unique // e.g., "2.4.1", "A.3.2"
  title       String
  description String   @db.Text
  category    String?  // e.g., "Technical", "Safety", "Quality"
  source      String?  // e.g., "WSSS 2024", "Custom"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tags                 DescriptorTagRelation[]
  markingSchemeItems   MarkingSchemeDescriptor[]

  @@index([category])
  @@index([source])
  // PostgreSQL full-text search index
  @@index([title, description], type: Gin(name: "descriptor_fts_idx"))
}
```

**Why this structure:**
- `code` is unique identifier for descriptors (matches source documents)
- `description` uses `@db.Text` for unlimited length (some descriptors are lengthy)
- `category` and `source` are indexed for filtering
- GIN index on `title` and `description` enables fast full-text search

#### 2. DescriptorTag

Hierarchical tag system for categorization beyond simple categories.

```prisma
model DescriptorTag {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  parentId    String?  // Allows hierarchical tags
  color       String?  // UI hint for tag display
  createdAt   DateTime @default(now())

  parent      DescriptorTag?  @relation("TagHierarchy", fields: [parentId], references: [id])
  children    DescriptorTag[] @relation("TagHierarchy")
  descriptors DescriptorTagRelation[]

  @@index([parentId])
}
```

**Why this structure:**
- Self-referential hierarchy allows "Welding > TIG Welding > Vertical Position"
- `color` helps UI distinguish tag types visually
- Flexible enough for both broad and specific categorization

#### 3. DescriptorTagRelation

Many-to-many junction table between Descriptors and Tags.

```prisma
model DescriptorTagRelation {
  descriptorId String
  tagId        String
  assignedAt   DateTime @default(now())

  descriptor Descriptor    @relation(fields: [descriptorId], references: [id], onDelete: Cascade)
  tag        DescriptorTag @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([descriptorId, tagId])
  @@index([tagId])
}
```

**Why separate junction table:**
- Clean many-to-many without JSON arrays
- Can add metadata like `assignedAt` for audit
- Cascade deletes maintain referential integrity

#### 4. MarkingScheme

Top-level marking scheme container.

```prisma
model MarkingScheme {
  id          String   @id @default(cuid())
  skillId     String?  // Optional link to Skill
  name        String
  description String?  @db.Text
  totalMarks  Int      @default(0) // Calculated from descriptors
  createdBy   String
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  skill       Skill?  @relation(fields: [skillId], references: [id], onDelete: SetNull)
  creator     User    @relation("MarkingSchemeCreator", fields: [createdBy], references: [id])
  updater     User?   @relation("MarkingSchemeUpdater", fields: [updatedBy], references: [id])
  descriptors MarkingSchemeDescriptor[]

  @@index([skillId])
  @@index([createdBy])
}
```

**Why this structure:**
- Optional `skillId` allows both skill-specific and generic schemes
- `totalMarks` denormalized for performance (updated via trigger or app logic)
- Audit trail with `createdBy` and `updatedBy`

#### 5. MarkingSchemeDescriptor

Junction table linking MarkingScheme to Descriptors with ordering and weighting.

```prisma
model MarkingSchemeDescriptor {
  id               String   @id @default(cuid())
  markingSchemeId  String
  descriptorId     String
  position         Int      @default(0) // Display order
  marks            Int      @default(1) // Marks allocated to this descriptor
  notes            String?  @db.Text    // Context-specific notes
  createdAt        DateTime @default(now())

  markingScheme MarkingScheme @relation(fields: [markingSchemeId], references: [id], onDelete: Cascade)
  descriptor    Descriptor     @relation(fields: [descriptorId], references: [id], onDelete: Restrict)

  @@unique([markingSchemeId, descriptorId])
  @@index([markingSchemeId, position])
}
```

**Why this structure:**
- `position` enables user-defined ordering of descriptors
- `marks` allows same descriptor to have different weights in different schemes
- `notes` provides context-specific overrides
- `onDelete: Restrict` on descriptor prevents accidental data loss

### Schema Migration Strategy

Since this is an existing database:

1. **Migration 1: Core Tables**
   - Add `Descriptor`, `DescriptorTag`, `DescriptorTagRelation` tables
   - No data dependencies

2. **Migration 2: Marking Scheme Tables**
   - Add `MarkingScheme`, `MarkingSchemeDescriptor` tables
   - Add foreign key to existing `Skill` table
   - Add relations to existing `User` table

3. **Migration 3: Full-Text Search Index**
   - Add GIN index using raw SQL (Prisma migrate will handle this)
   - Create `tsvector` column or use expression index

4. **Migration 4: User Relationships** (optional)
   - Update `User` model to include relations to MarkingScheme

## Full-Text Search Architecture

### Recommended Approach: PostgreSQL Native Full-Text Search

**Verdict: Use PostgreSQL FTS** (not Elasticsearch)

**Rationale:**
- Already using PostgreSQL - no additional infrastructure
- Expected dataset size: <50,000 descriptors (well within PostgreSQL FTS capabilities)
- PostgreSQL FTS response time: ~100ms for 1.5M records (our dataset much smaller)
- Eliminates ETL pipeline complexity and sync lag issues
- Zero additional cost vs Elasticsearch licensing/hosting
- ACID transaction guarantees (no sync issues)

### Implementation Pattern

#### 1. Enable Prisma Full-Text Search

Update `prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "fullTextIndex"]
}
```

#### 2. Create GIN Index (via migration)

```sql
-- In Prisma migration file
CREATE INDEX descriptor_fts_idx ON "Descriptor"
USING gin(to_tsvector('english', title || ' ' || description || ' ' || COALESCE(code, '')));
```

**Why GIN index:**
- Optimized for full-text search on large text fields
- 5-10x faster than regular B-tree index for text search
- Supports partial matching, stemming, ranking

#### 3. Search Query Pattern

In `src/lib/descriptors.ts`:

```typescript
// Full-text search with Prisma
async function searchDescriptors(query: string, options?: SearchOptions) {
  const { category, tags, limit = 50, offset = 0 } = options ?? {};

  return await prisma.$queryRaw`
    SELECT
      d.id,
      d.code,
      d.title,
      d.description,
      d.category,
      d.source,
      ts_rank(
        to_tsvector('english', d.title || ' ' || d.description),
        plainto_tsquery('english', ${query})
      ) as rank
    FROM "Descriptor" d
    WHERE to_tsvector('english', d.title || ' ' || d.description) @@ plainto_tsquery('english', ${query})
      ${category ? Prisma.sql`AND d.category = ${category}` : Prisma.empty}
    ORDER BY rank DESC, d.code ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}
```

**Why this pattern:**
- `ts_rank` provides relevance scoring
- `plainto_tsquery` handles basic stemming/normalization
- Fallback to Prisma typed queries available
- Can combine FTS with regular filters (category, tags)

#### 4. Fallback for Simple Filtering

```typescript
// When no search query, use regular Prisma query
async function listDescriptors(filters: DescriptorFilters) {
  return await prisma.descriptor.findMany({
    where: {
      category: filters.category,
      tags: filters.tags?.length
        ? {
            some: {
              tagId: { in: filters.tags }
            }
          }
        : undefined
    },
    include: {
      tags: {
        include: { tag: true }
      }
    },
    orderBy: { code: 'asc' },
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0
  });
}
```

### Search Performance Optimization

| Dataset Size | Expected Response | Optimization |
|--------------|-------------------|--------------|
| <10k descriptors | <50ms | Basic GIN index sufficient |
| 10k-50k descriptors | 50-100ms | Add materialized tsvector column |
| 50k-100k descriptors | 100-200ms | Consider partitioning by category |
| >100k descriptors | Review architecture | Consider Elasticsearch if needed |

**For this project:** Basic GIN index is sufficient. Monitor query performance and add materialized column if needed.

## Document Pipeline Architecture

### One-Time Import Pipeline (Excel → Database)

#### Pattern: Background Job (Not Real-Time Upload)

```
┌─────────────────┐
│  Admin uploads  │
│  Excel file     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Store in S3/R2 │ ← Reuse existing storage infrastructure
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Server Action triggers parse job    │
│  (or Next.js API route)              │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  src/lib/excel-parser.ts             │
│  - Download from S3                  │
│  - Parse with exceljs                │
│  - Extract descriptors               │
│  - Validate structure                │
│  - Batch insert to DB                │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Database: Descriptor table          │
│  - Insert in transaction             │
│  - Associate tags                    │
│  - Log import activity               │
└──────────────────────────────────────┘
```

#### Library Choice: ExcelJS

**Recommended: `exceljs@4.4.0`**

**Why ExcelJS over xlsx (SheetJS):**
- Security: xlsx package has known vulnerabilities (DoS, prototype pollution) as of 2025
- ExcelJS actively maintained with 2139 dependent projects
- Better browser compatibility (not needed here, but good for future)
- Robust read/write capabilities
- TypeScript support built-in

**Installation:**
```bash
npm install exceljs
```

**Basic parsing pattern:**

```typescript
// src/lib/excel-parser.ts
import ExcelJS from 'exceljs';

async function parseDescriptorExcel(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.getWorksheet('Descriptors');
  if (!sheet) throw new Error('Descriptors sheet not found');

  const descriptors: DescriptorInput[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const code = row.getCell(1).text;
    const title = row.getCell(2).text;
    const description = row.getCell(3).text;
    const category = row.getCell(4).text;

    if (!code || !title) return; // Skip invalid rows

    descriptors.push({
      code,
      title,
      description,
      category: category || null,
      source: 'Excel Import'
    });
  });

  return descriptors;
}
```

**Error handling strategy:**
- Validate Excel structure before processing
- Use database transactions for all-or-nothing inserts
- Log failed rows with line numbers
- Provide detailed error report to admin

### Export Pipeline (Database → Excel/PDF)

#### Pattern: Server-Side Generation with Streaming

```
┌─────────────────────────────────────┐
│  User clicks "Export" button        │
│  (Marking Scheme detail page)       │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Next.js API Route                  │
│  /api/marking-schemes/[id]/export   │
│  - Auth check                       │
│  - Fetch marking scheme + descriptors│
└────────┬────────────────────────────┘
         │
         ├─────────────────┬────────────────────┐
         ▼                 ▼                    ▼
┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  Excel Export   │  │   PDF Export     │  │   JSON Export   │
│  (exceljs)      │  │   (puppeteer)    │  │   (native)      │
└─────────────────┘  └──────────────────┘  └─────────────────┘
         │                 │                    │
         └─────────────────┴────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────┐
│  Stream response to browser             │
│  Content-Disposition: attachment         │
└──────────────────────────────────────────┘
```

#### Library Choices

**Excel Export: ExcelJS** (same as import)

```typescript
// src/lib/export-generator.ts
async function exportMarkingSchemeToExcel(markingSchemeId: string) {
  const scheme = await prisma.markingScheme.findUnique({
    where: { id: markingSchemeId },
    include: {
      descriptors: {
        include: { descriptor: true },
        orderBy: { position: 'asc' }
      }
    }
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Marking Scheme');

  // Header
  sheet.columns = [
    { header: 'Position', key: 'position', width: 10 },
    { header: 'Code', key: 'code', width: 15 },
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Marks', key: 'marks', width: 10 }
  ];

  // Data
  scheme.descriptors.forEach((item, idx) => {
    sheet.addRow({
      position: idx + 1,
      code: item.descriptor.code,
      title: item.descriptor.title,
      description: item.descriptor.description,
      marks: item.marks
    });
  });

  // Styling
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  return workbook.xlsx.writeBuffer();
}
```

**PDF Export: Puppeteer** (server-side HTML → PDF)

**Recommended: `puppeteer@23.x`**

**Why Puppeteer:**
- Best for pixel-perfect rendering of complex layouts
- Handles CSS grid/flexbox (marking schemes often have complex layouts)
- Can render existing React components to PDF
- Battle-tested for server-side PDF generation

**Trade-off:**
- Resource-heavy (launches headless Chrome)
- Slower than PDFKit (~2-5 seconds vs <1 second)
- Acceptable for on-demand exports (not high-frequency)

**Alternative considered: PDFKit**
- Faster, lighter weight
- Better for programmatic layouts
- Harder to match complex UI designs
- **Use if:** Simple table-based layouts sufficient

**Implementation pattern:**

```typescript
// src/lib/export-generator.ts
import puppeteer from 'puppeteer';

async function exportMarkingSchemeToPDF(markingSchemeId: string) {
  const scheme = await fetchMarkingSchemeData(markingSchemeId);

  // Generate HTML (can reuse React component with renderToStaticMarkup)
  const html = generateMarkingSchemeHTML(scheme);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
  });

  await browser.close();

  return pdf;
}
```

**Deployment consideration:**
- Puppeteer requires Chrome binaries (~300MB)
- Works on Vercel with `@sparticuz/chromium` package
- Alternative: Use Edge Function or separate export service

#### API Route Pattern

```typescript
// app/api/marking-schemes/[id]/export/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const format = request.nextUrl.searchParams.get('format') ?? 'excel';

  // Permission check
  const scheme = await prisma.markingScheme.findUnique({
    where: { id: params.id },
    select: { skillId: true, createdBy: true }
  });

  if (!canAccessMarkingScheme(user, scheme)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  let buffer: Buffer;
  let contentType: string;
  let filename: string;

  if (format === 'pdf') {
    buffer = await exportMarkingSchemeToPDF(params.id);
    contentType = 'application/pdf';
    filename = `marking-scheme-${params.id}.pdf`;
  } else {
    buffer = await exportMarkingSchemeToExcel(params.id);
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    filename = `marking-scheme-${params.id}.xlsx`;
  }

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString()
    }
  });
}
```

## Integration Points with Existing System

### 1. Skill Association

Marking schemes can optionally link to existing `Skill` model:

```prisma
// In Skill model (existing)
model Skill {
  // ... existing fields

  markingSchemes MarkingScheme[]
}
```

**Integration pattern:**
- Marking scheme creation page can select from user's skills
- Skill detail page shows associated marking schemes
- Optional relationship (marking schemes can be standalone)

### 2. Permission System

Reuse existing `canManageSkill` pattern:

```typescript
// src/lib/permissions.ts (extend existing)
export function canAccessMarkingScheme(
  user: User,
  scheme: { skillId?: string | null; createdBy: string }
) {
  // Admins can access all
  if (user.isAdmin) return true;

  // Creator can access own
  if (scheme.createdBy === user.id) return true;

  // If linked to skill, check skill permissions
  if (scheme.skillId) {
    const skill = await prisma.skill.findUnique({
      where: { id: scheme.skillId },
      include: { teamMembers: { select: { userId: true } } }
    });

    if (!skill) return false;

    return canManageSkill(user, {
      saId: skill.saId,
      scmId: skill.scmId,
      teamMemberIds: skill.teamMembers.map(m => m.userId)
    });
  }

  return false;
}
```

### 3. Activity Logging

Extend existing `ActivityLog` pattern:

```typescript
// src/lib/activity.ts (extend existing)
await logActivity({
  skillId: markingScheme.skillId, // Can be null
  userId: user.id,
  action: 'MarkingSchemeCreated',
  payload: {
    markingSchemeId: markingScheme.id,
    name: markingScheme.name,
    descriptorCount: markingScheme.descriptors.length
  }
});
```

**New action types:**
- `MarkingSchemeCreated`
- `MarkingSchemeUpdated`
- `DescriptorAdded`
- `DescriptorRemoved`
- `MarkingSchemeExported`
- `DescriptorsImported`

### 4. Navigation Integration

Add to existing dashboard navigation:

```typescript
// Layout navigation (existing pattern)
const navigationItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Skills', href: '/skills' },
  { label: 'Hub', href: '/hub' },
  // NEW:
  { label: 'Descriptor Library', href: '/descriptors' },
  { label: 'Marking Schemes', href: '/marking-schemes' },
  // ... existing items
];
```

**Role-based visibility:**
- `Descriptor Library`: All authenticated users (read-only for non-admins)
- `Marking Schemes`: Users with skill assignments or admins

### 5. S3 Storage Reuse

Descriptor imports use existing storage infrastructure:

```typescript
// src/lib/storage/client.ts (extend existing)
async function uploadDescriptorImport(file: File) {
  const key = `descriptor-imports/${Date.now()}-${file.name}`;

  // Reuse existing createPresignedUpload
  return await createPresignedUpload({
    key,
    contentType: file.type,
    contentLength: file.size
  });
}
```

**Storage structure:**
```
s3://bucket/
  deliverables/         ← Existing
  meetings/             ← Existing
  descriptor-imports/   ← NEW (one-time imports)
```

## Component Boundaries

### New Components

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `DescriptorSearch` | Full-text search UI, filter controls | `src/lib/descriptors.ts` |
| `DescriptorList` | Display search results, pagination | Prisma via Server Component |
| `DescriptorDetail` | Show full descriptor with tags | Prisma via Server Component |
| `TagSelector` | Hierarchical tag selection | `src/lib/descriptors.ts` |
| `MarkingSchemeBuilder` | Drag-drop descriptor ordering | `src/lib/marking-schemes.ts` |
| `DescriptorPicker` | Modal to select from library | `DescriptorSearch` component |
| `ExportButton` | Trigger Excel/PDF export | API route `/api/marking-schemes/[id]/export` |
| `ImportWizard` | Upload Excel, map columns, preview | `src/lib/excel-parser.ts` |

### Modified Components

| Component | Modification | Reason |
|-----------|--------------|--------|
| `SkillDetailPage` | Add "Marking Schemes" tab | Show associated marking schemes |
| `DashboardNav` | Add descriptor/marking scheme links | Navigation access |
| `ActivityLog` | Handle new action types | Audit trail for new features |

## Data Flow

### Descriptor Search Flow

```
[User types search query]
    ↓
[Client component debounces input]
    ↓
[Server Action: searchDescriptors(query)]
    ↓
[PostgreSQL FTS query with ts_rank]
    ↓
[Return ranked results (limit 50)]
    ↓
[Client renders results with highlighting]
```

**Performance optimization:**
- Debounce client input (300ms)
- Limit initial results to 50
- Paginate remaining results
- Cache common searches (React Query / SWR)

### Marking Scheme Creation Flow

```
[User creates new marking scheme]
    ↓
[Server Action: createMarkingScheme()]
    ↓
[Insert MarkingScheme record]
    ↓
[User searches & selects descriptors]
    ↓
[Client: Drag to reorder, assign marks]
    ↓
[Server Action: addDescriptorsToScheme()]
    ↓
[Batch insert MarkingSchemeDescriptor records]
    ↓
[Update totalMarks on MarkingScheme]
    ↓
[Revalidate page]
```

**Transaction guarantees:**
- All descriptor additions in single transaction
- Rollback if validation fails (e.g., duplicate descriptor)
- Optimistic UI updates with revalidation

### Export Flow

```
[User clicks "Export as Excel"]
    ↓
[Next.js API Route: GET /api/marking-schemes/[id]/export?format=excel]
    ↓
[Auth check + permission check]
    ↓
[Fetch marking scheme with relations]
    ↓
[Generate Excel with exceljs]
    ↓
[Stream buffer to response]
    ↓
[Browser downloads file]
```

**Streaming optimization:**
- Use `writeBuffer()` for in-memory generation
- Stream large exports with `writeStream()`
- Add loading indicator during generation

## Architectural Patterns to Follow

### Pattern 1: Server Component Data Fetching

**What:** Fetch data in Server Components, pass to Client Components as props

**When:** Descriptor list pages, marking scheme detail pages

**Example:**
```typescript
// app/descriptors/page.tsx (Server Component)
export default async function DescriptorsPage({ searchParams }) {
  const descriptors = await prisma.descriptor.findMany({
    where: searchParams.category ? { category: searchParams.category } : {},
    include: { tags: { include: { tag: true } } },
    take: 50
  });

  return <DescriptorList descriptors={descriptors} />;
}

// components/DescriptorList.tsx (Client Component)
'use client';
export function DescriptorList({ descriptors }: Props) {
  // Interactive UI with server-fetched data
}
```

### Pattern 2: Server Actions for Mutations

**What:** Use `"use server"` functions for all data mutations

**When:** Creating/updating marking schemes, adding descriptors, importing data

**Example:**
```typescript
// app/marking-schemes/[id]/actions.ts
"use server";

export async function addDescriptorToScheme(formData: FormData) {
  const user = await requireUser();
  const parsed = schema.safeParse({ ... });

  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }

  // Permission check
  const scheme = await prisma.markingScheme.findUnique(...);
  if (!canAccessMarkingScheme(user, scheme)) {
    throw new Error('Forbidden');
  }

  // Mutation
  await prisma.markingSchemeDescriptor.create({ ... });

  // Revalidate
  revalidatePath(`/marking-schemes/${parsed.data.schemeId}`);
}
```

### Pattern 3: API Routes for File Operations

**What:** Use Next.js API routes (not Server Actions) for file uploads/downloads

**When:** Excel import upload, PDF/Excel export download

**Example:**
```typescript
// app/api/descriptors/import/route.ts
export async function POST(request: NextRequest) {
  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // Store in S3
  const storageKey = await uploadDescriptorImport(file);

  // Trigger background parse job
  await parseDescriptorExcelJob(storageKey, user.id);

  return NextResponse.json({ success: true, jobId: '...' });
}
```

**Why API routes for files:**
- Server Actions don't support streaming responses
- API routes better for binary data (File, Buffer)
- Can set custom headers (Content-Disposition, Content-Type)

### Pattern 4: Zod Validation Everywhere

**What:** Use Zod schemas for all input validation

**When:** Server Actions, API routes, form submissions

**Example:**
```typescript
const markingSchemeSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  skillId: z.string().cuid().optional(),
  descriptors: z.array(z.object({
    descriptorId: z.string().cuid(),
    marks: z.number().int().min(0).max(100),
    position: z.number().int().min(0)
  }))
});

type MarkingSchemeInput = z.infer<typeof markingSchemeSchema>;
```

### Pattern 5: Transaction-Wrapped Mutations

**What:** Use Prisma transactions for multi-step operations

**When:** Creating marking scheme with descriptors, bulk imports, complex updates

**Example:**
```typescript
await prisma.$transaction(async (tx) => {
  // Create marking scheme
  const scheme = await tx.markingScheme.create({ ... });

  // Add all descriptors
  await tx.markingSchemeDescriptor.createMany({
    data: descriptors.map((d, idx) => ({
      markingSchemeId: scheme.id,
      descriptorId: d.id,
      position: idx,
      marks: d.marks
    }))
  });

  // Update total marks
  const total = descriptors.reduce((sum, d) => sum + d.marks, 0);
  await tx.markingScheme.update({
    where: { id: scheme.id },
    data: { totalMarks: total }
  });
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Full-Text Search

**What people do:** Fetch all descriptors to client, filter with JavaScript

**Why it's wrong:**
- Massive initial payload (10k+ descriptors = several MB)
- Slow search on large datasets
- Doesn't leverage database indexes

**Do this instead:** Server-side search with PostgreSQL FTS

### Anti-Pattern 2: N+1 Queries for Related Data

**What people do:**
```typescript
const schemes = await prisma.markingScheme.findMany();
for (const scheme of schemes) {
  scheme.descriptors = await prisma.markingSchemeDescriptor.findMany({
    where: { markingSchemeId: scheme.id }
  });
}
```

**Why it's wrong:** 1 query + N queries = performance disaster

**Do this instead:**
```typescript
const schemes = await prisma.markingScheme.findMany({
  include: {
    descriptors: {
      include: { descriptor: true },
      orderBy: { position: 'asc' }
    }
  }
});
```

### Anti-Pattern 3: Storing Search Results in State

**What people do:** Store large search results in client state (useState/Redux)

**Why it's wrong:**
- Memory bloat on client
- Stale data (no revalidation)
- Re-fetches on navigation

**Do this instead:** Use URL search params + Server Components
```typescript
// app/descriptors/page.tsx
export default async function Page({ searchParams }) {
  const results = await searchDescriptors(searchParams.q);
  return <Results data={results} />;
}
```

**Benefits:**
- Shareable URLs
- Browser back button works
- Server-side caching possible

### Anti-Pattern 4: Synchronous PDF Generation

**What people do:** Generate PDF synchronously, block request until complete

**Why it's wrong:**
- Puppeteer takes 2-5 seconds
- Vercel function timeout (10s on hobby, 60s on pro)
- Poor UX (spinner for 5 seconds)

**Do this instead:**
- For small schemes (<50 descriptors): Synchronous OK
- For large schemes: Background job + polling/webhook
- Alternative: Use PDFKit for faster generation

### Anti-Pattern 5: Excel Import Without Validation

**What people do:** Trust Excel data, insert directly to DB

**Why it's wrong:**
- Invalid data corrupts database
- No user feedback on errors
- Hard to debug import failures

**Do this instead:**
1. Parse Excel
2. Validate each row (Zod schema)
3. Show preview to user
4. User confirms
5. Insert in transaction
6. Report success/failures

## Scalability Considerations

| Concern | At 1k descriptors | At 10k descriptors | At 50k+ descriptors |
|---------|-------------------|--------------------|--------------------|
| **Search performance** | <50ms (GIN index) | 50-100ms (GIN index) | 100-200ms (materialized tsvector) |
| **Import time** | <5s synchronous | <30s background job | Background job with progress |
| **Export time** | <2s (Excel/PDF) | 2-5s (stream response) | Background job + email link |
| **Database size** | <100MB | <500MB | Consider partitioning |
| **Marking scheme complexity** | <100 descriptors/scheme | <500 descriptors/scheme | Paginate builder UI |

### Optimization Triggers

**When to add materialized tsvector column:**
- FTS queries exceed 200ms
- Implementation: Add `search_vector` column, update via trigger

**When to move exports to background jobs:**
- Export generation exceeds 5 seconds
- Implementation: Queue job (BullMQ), store result in S3, email link

**When to consider Elasticsearch:**
- >100k descriptors
- Advanced search features needed (fuzzy, synonyms, geospatial)
- Budget allows infrastructure cost

## Build Order (Dependencies)

### Phase 1: Database Foundation
1. Create descriptor tables (Descriptor, DescriptorTag, DescriptorTagRelation)
2. Run Prisma migration
3. Add GIN full-text search index
4. Seed with sample data

**No dependencies** - can start immediately

### Phase 2: Descriptor Library (Read-Only)
1. Build descriptor search/list pages
2. Implement PostgreSQL FTS queries
3. Build descriptor detail page
4. Implement tag filtering

**Depends on:** Phase 1

### Phase 3: Excel Import
1. Build import UI (file upload)
2. Implement Excel parser (exceljs)
3. Build validation & preview
4. Implement batch insert

**Depends on:** Phase 2 (to verify imported data displays correctly)

### Phase 4: Marking Scheme Tables
1. Create marking scheme tables
2. Add foreign keys to Skill and User
3. Run Prisma migration

**Depends on:** Phase 1 (needs Descriptor table)
**Can parallel with:** Phase 2-3

### Phase 5: Marking Scheme Builder
1. Build marking scheme CRUD
2. Implement descriptor picker (reuses search from Phase 2)
3. Build drag-drop ordering UI
4. Implement mark allocation

**Depends on:** Phase 2 (descriptor search), Phase 4 (schema)

### Phase 6: Export Pipeline
1. Implement Excel export (exceljs)
2. Implement PDF export (puppeteer or PDFKit)
3. Build export API routes
4. Add export buttons to UI

**Depends on:** Phase 5 (needs marking schemes to export)

**Recommended ordering:**
1. Phase 1 + Phase 4 (all database migrations together)
2. Phase 2 (descriptor library - provides foundation)
3. Phase 3 (import - provides data)
4. Phase 5 (marking scheme builder - core feature)
5. Phase 6 (export - enhancement)

**Parallelization opportunities:**
- Phase 2 and Phase 4 can be developed in parallel (different developers)
- Phase 3 and Phase 5 can overlap (Phase 5 can start with manual descriptor creation)

## Sources

- [PostgreSQL vs Elasticsearch: Full-Text Search Comparison](https://xata.io/blog/postgres-full-text-search-postgres-vs-elasticsearch)
- [Postgres vs Elasticsearch for Full-Text Search](https://www.myscale.com/blog/postgres-vs-elasticsearch-comparison-full-text-search/)
- [Full-Text Search Battle: PostgreSQL vs Elasticsearch](https://www.rocky.dev/blog/full-text-search)
- [Comparing Native Postgres, ElasticSearch, and pg_search - Neon](https://neon.com/blog/postgres-full-text-search-vs-elasticsearch)
- [Full-Text Search with PostgreSQL and Prisma](https://www.pedroalonso.net/blog/postgres-full-text-search/)
- [Prisma ORM and Postgres with Next.js](https://www.prisma.io/docs/guides/nextjs)
- [Prisma ORM Production Guide: Next.js Complete Setup 2025](https://www.digitalapplied.com/blog/prisma-orm-production-guide-nextjs)
- [xlsx vs exceljs comparison](https://npm-compare.com/excel4node,exceljs,xlsx,xlsx-populate)
- [ExcelJS npm package](https://www.npmjs.com/package/exceljs)
- [Best HTML to PDF libraries for Node.js](https://blog.logrocket.com/best-html-pdf-libraries-node-js/)
- [Top JavaScript PDF generator libraries for 2025](https://www.nutrient.io/blog/top-js-pdf-libraries/)
- [Top PDF Generation Libraries for Node.js in 2025](https://pdfbolt.com/blog/top-nodejs-pdf-generation-libraries)
- [Database Schema Design Best Practices](https://www.bytebase.com/blog/top-database-schema-design-best-practices/)
- [Mastering Database Schema Design](https://airbyte.com/data-engineering-resources/database-schema-design)
- [Schema design best practices - Google Cloud Spanner](https://cloud.google.com/spanner/docs/schema-design)

---

*Architecture research for: Descriptor Library & Marking Scheme Builder*
*Researched: 2026-02-01*
*Confidence: HIGH*

# Project Research Summary

**Project:** Descriptor Library & Marking Scheme Management
**Domain:** Content library with document analysis, full-text search, and export generation
**Researched:** 2026-02-01
**Confidence:** HIGH

## Executive Summary

This project adds descriptor library and marking scheme management features to an existing WorldSkills management application. The system must parse 58 Excel marking schemes from WSC2024, extract and categorize descriptors, enable search and discovery, and allow users to build new marking schemes by combining descriptors with professional Excel/PDF export capabilities.

The recommended approach leverages the existing Next.js 14/Prisma/PostgreSQL stack with targeted additions: SheetJS (CDN) for Excel parsing, ExcelJS for styled exports, PostgreSQL native full-text search (avoiding Prisma's preview FTS), and upgrading @react-pdf/renderer for PDF generation. The architecture maintains separation of concerns through a new descriptor domain layer while integrating cleanly with existing role-based access control and skill management.

Critical risks center on Excel parsing fragility (58 files with varying structures), search relevance quality, and export formatting fidelity. Mitigation requires upfront validation of all 58 source files, careful search relevance tuning with real queries, and template-based exports that match the original WSC2024 format exactly. The phased approach prioritizes data quality and search functionality before building advanced features like batch operations or usage analytics.

## Key Findings

### Recommended Stack

The existing stack (Next.js 14.2.10, Prisma, PostgreSQL, S3, Resend) is solid and validated. New capabilities require strategic additions rather than replacement.

**Core technology additions:**
- **SheetJS (CDN install)**: Parse Excel marking schemes during import — industry standard (47M+ weekly downloads) but MUST install from CDN to avoid npm registry vulnerabilities (v0.18.5 has high-severity DoS and prototype pollution issues)
- **ExcelJS v4.4.0**: Generate styled Excel exports — superior formatting capabilities for professional marking scheme exports with merged cells, borders, column widths (1.5M+ weekly downloads)
- **PostgreSQL Full-Text Search (native)**: Search descriptors by text content — already have PostgreSQL, native FTS with GIN indexes sufficient for <1M descriptors, avoids Elasticsearch complexity
- **Prisma Raw SQL**: Query PostgreSQL FTS — Prisma's preview FTS has known index issues, raw SQL provides production-ready control
- **@react-pdf/renderer v4.3.2**: Upgrade from existing v3.4.4 for React 19 support and PDF generation

**Critical version requirements:**
- Stay on Next.js 14.2.10 (current) — @react-pdf/renderer has compatibility issues with Next.js 15
- Use `npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz` — NOT `npm install xlsx` which installs vulnerable v0.18.5
- PostgreSQL 12+ for FTS features (GIN indexes available since 8.2)

**Data storage patterns:**
- Prisma enums for fixed categories (CriterionType, PerformanceLevel)
- JSONB arrays with GIN indexes for flexible tags
- Generated tsvector columns for full-text search performance

### Expected Features

Research reveals a clear hierarchy between table stakes (must have), differentiators (competitive advantage), and anti-features (commonly requested but problematic).

**Must have (table stakes):**
- **Keyword search** across descriptor text — 73% of users search rather than browse (primary discovery mechanism)
- **Multi-criteria filtering** (skill area, criterion type, performance level) — faceted filtering pattern, combine filters don't replace
- **Performance level grouping** — descriptors aren't useful in isolation, need complete rubric context showing Excellent/Good/Pass/Below Pass together
- **Preview before insert** — users must see full context (all performance levels) before committing
- **Copy to clipboard** — standard reusable content workflow with single-click and visual confirmation
- **Source attribution** — which WSC2024 skill the descriptor came from (trust signal: "proven in real competition")
- **Tag-based organization** — flexible categorization beyond strict hierarchies, bridges gap between formal categories and natural search terms

**Should have (competitive advantage):**
- **Saved/favorited descriptors** — add when SCMs report repeat searching, trigger: repeat search patterns in analytics (v1.x)
- **Descriptor quality indicators** — mark "excellent example" vs "reference only" based on curation (v1.x)
- **Batch insert** — select multiple descriptors and insert as criterion set, add when building schemes from scratch (v1.x)
- **Comparison view** — side-by-side view of 2-3 similar descriptors, add when difficulty choosing (v1.x)
- **Usage analytics** — "most used descriptors" from similar skills, add after 3 months of data (v1.x)

**Defer (v2+):**
- **Cross-skill pattern discovery** — requires mature taxonomy and rich tagging, value unclear without usage data
- **Related suggestions** (recommendation engine) — needs ML/data science investment
- **Collaborative library contributions** — solve curation problem first, requires submission workflow and moderation
- **Multi-language support** — validate English library first, translation quality critical for marking criteria
- **Advanced export formats** (Word with formatting) — Excel sufficient for v1

**Anti-features (avoid):**
- **AI-generated descriptors** — quality control nightmare, marking schemes need precision, AI hallucinates measurements/criteria
- **Collaborative editing of library** — becomes dumping ground without admin curation, quality dilution
- **Real-time updates** — complexity without value for stable reference data (descriptor library is not collaborative document)
- **Versioning individual descriptors** — version sprawl creates choice paralysis, which version is canonical?
- **Rating/voting on descriptors** — popularity ≠ quality for marking rubrics, technical accuracy matters more than votes
- **Auto-validation of inserted descriptors** — false confidence, automation can't judge if descriptor fits skill context

### Architecture Approach

The descriptor library integrates into existing Next.js 14 App Router architecture with Prisma/PostgreSQL, following established patterns for Server Components, Server Actions, and API Routes.

**Integration strategy:**
- **Database layer**: New Prisma models (Descriptor, DescriptorTag, MarkingScheme, junction tables) with proper relations, GIN indexes for FTS and JSONB
- **Permission layer**: Extend existing `src\lib\permissions.ts` patterns for descriptor access control (canAccessMarkingScheme follows canManageSkill pattern)
- **API layer**: New routes for descriptor import and export at `src\app\api\descriptors`
- **Business logic**: New domain modules `src\lib\descriptors.ts`, `src\lib\marking-schemes.ts`, `src\lib\excel-parser.ts`, `src\lib\export-generator.ts`
- **UI components**: Extract reusable components, maintain consistency with existing skill workspace patterns
- **Storage**: Reuse existing S3 infrastructure with `descriptor-imports/` prefix

**Major components:**
1. **Descriptor domain layer** — Search/filter logic, tag management, Excel import with validation and transaction safety
2. **Import pipeline** — SheetJS parsing, text normalization (handle formatting artifacts like bullets, smart quotes), bulk insertion with quality validation
3. **Search service** — PostgreSQL FTS with `ts_rank` relevance scoring, weighted multi-field search, pagination
4. **Export generators** — ExcelJS for styled Excel, @react-pdf/renderer for branded PDF, template-based not raw data dumps
5. **Library UI** — Search interface with debounced input, faceted filter panels, preview modals, clipboard integration

**Key architectural patterns:**
- **Server Component data fetching** — Fetch in RSC, pass to Client Components as props, shareable URLs via searchParams
- **Server Actions for mutations** — `"use server"` for all CRUD (createMarkingScheme, addDescriptor), Zod validation everywhere
- **API Routes for file operations** — Upload/download (Server Actions don't support streaming), custom headers for Content-Disposition
- **Transaction-wrapped mutations** — Prisma `$transaction` for multi-step operations (scheme creation + descriptor linking), all-or-nothing guarantees
- **Generated columns for performance** — `tsvector` columns for FTS, updated via PostgreSQL triggers

**Database schema highlights:**
- `Descriptor` table with GIN index on `to_tsvector('english', title || description)` for fast full-text search
- `DescriptorTag` with self-referential hierarchy (parentId) for "Welding > TIG Welding > Vertical Position"
- `MarkingScheme` with optional `skillId` (can be skill-specific or standalone), `totalMarks` denormalized for performance
- `MarkingSchemeDescriptor` junction with `position` (user-defined ordering), `marks` (per-scheme weighting), `notes` (context-specific overrides)

### Critical Pitfalls

**1. Excel Parsing Fragility from Schema Assumptions**
- **Risk:** Parser breaks on 40% of files due to merged cells, varying terminology ("Excellent" vs "Outstanding" vs "Level 4"), inconsistent column structures, embedded formulas appearing as text
- **Avoidance:** Survey ALL 58 files BEFORE writing parser code, design for variance not uniformity, handle merged cells explicitly with cellStyles option, extract text content not formulas, log failures with file-level granularity
- **When:** Phase 1 (Data Import) — parser must be robust before building library features
- **Warning signs:** Parser succeeds on test files but fails on production, >10% error rate, silent failures with missing descriptors, merged cells cause wrong associations

**2. Over-Categorization Leading to Empty Categories**
- **Risk:** 60% of categories have <3 descriptors, users can't find anything despite good search, scattered across too many narrow categories defeats purpose
- **Avoidance:** Categorize AFTER analyzing descriptor corpus (see what emerges naturally), minimum 5+ descriptors per category rule, start with 3-5 broad categories not 15 narrow ones, use tags for flexibility not rigid hierarchies
- **When:** Phase 2 (Library Structure) — categorization schema must be validated before UI implementation
- **Warning signs:** >40% categories have <5 descriptors, users complain "can't find anything", searches return from only 2-3 categories, overly specific category names

**3. Full-Text Search Irrelevance from Poor Ranking**
- **Risk:** Search returns 45 results but most relevant buried on page 3, users resort to browsing instead of searching, search essentially random
- **Avoidance:** Weight title/criterion fields higher with `setweight('A')` for important fields, multi-field search across text/criterion/skill with different weights, test with 10 real SCM queries (verify top 3 relevant), consider trigram similarity for fuzzy matching with `pg_trgm`, boost descriptors from multiple skills (proven across contexts)
- **When:** Phase 3 (Search & Discovery) — search relevance validated with real queries before launch
- **Warning signs:** Users say "search doesn't work" when technically returns results, usage drops over time, most relevant rarely in top 5, keyword stuffing would improve ranking

**4. Export Formatting Loss Due to Direct Database-to-Excel Mapping**
- **Risk:** Exports technically correct but unusable because column widths wrong, merged cells lost, headers don't wrap, doesn't match WSC2024 format, users refuse feature and manually recreate spreadsheets
- **Avoidance:** Template-based exports not raw data dumps (use ExcelJS styling), match original WSC2024 format exactly (don't invent new layouts), set explicit column widths (auto-width fails with merged cells), preserve visual hierarchy (merged headers, bold criterion names, indented sub-criteria), test in both Excel AND Google Sheets, add print settings (page breaks, margins, orientation), validate with actual SCMs before launch
- **When:** Phase 4 (Export Generation) — formatting validated with real users before release
- **Warning signs:** "Export looks broken" despite correct data, SCMs continue using own templates, horizontal scrolling, headers don't match original, merged cells in wrong positions

**5. Schema Evolution Without Version Strategy**
- **Risk:** After launch, need new field but database migration breaks existing code, no way to distinguish v1 from v2 descriptors, rollback impossible
- **Avoidance:** Add `schema_version` field to descriptor table from day 1 (defaults to 1), write backward-compatible migrations (new fields nullable or have defaults), version API responses (`/api/descriptors/v1`), test migrations on production data copy, plan rollback scripts alongside migrations, document breaking vs non-breaking changes
- **When:** Phase 1 (Database Schema) — version strategy before first production deployment
- **Warning signs:** "Can't add field without breaking production" conversation, fear of deploying database changes, no A/B test capability, rollback requires manual SQL

**6. Text Extraction Quality Blind Spots**
- **Risk:** 10% of descriptors contain formatting artifacts ("â¢" instead of bullets, "â€™" instead of apostrophes), users lose trust in library quality
- **Avoidance:** Normalize text during extraction (convert smart quotes to straight quotes, bullets to dashes), detect encoding issues (flag unexpected Unicode ranges >U+007F), visual inspection of random 5% sample before bulk import, implement text quality scoring (flag unusual character patterns), preserve original alongside normalized (keep raw for debugging, display normalized), log extraction artifacts for manual review
- **When:** Phase 1 (Data Import) — text normalization during initial extraction
- **Warning signs:** Users report "weird characters", apostrophes become "â€™", bullets render as boxes, em-dashes become random characters, inconsistent spacing

## Implications for Roadmap

Based on research, the recommended phase structure prioritizes data quality and search functionality, defers advanced features until core value is validated, and sequences work to minimize rework.

### Phase 1: Data Import & Schema Foundation
**Rationale:** Database schema and import quality are foundational — building features on bad data wastes effort. Excel parsing is highest-risk component (58 files with varying structures) and must be validated upfront.

**Delivers:**
- Prisma models (Descriptor, MarkingScheme, enums for CriterionType/PerformanceLevel)
- Database migration with GIN indexes for search and JSONB tags
- Excel parsing pipeline with variance handling (survey all 58 files first, document structural variations)
- Text normalization and quality validation (handle Unicode artifacts, smart quotes, bullets)
- Bulk import of 58 WSC2024 marking schemes (transaction-wrapped, all-or-nothing)
- Schema versioning infrastructure (schema_version field, rollback scripts)

**Addresses features:**
- Source attribution (storing skill metadata)
- Performance level grouping (proper data model with enums)

**Avoids pitfalls:**
- Excel parsing fragility (validate all 58 files, build variance map)
- Text extraction artifacts (normalization pipeline, visual inspection)
- Schema evolution issues (version field from start, backward-compatible migrations)

**Research flag:** **Needs phase-specific research** — Deep dive into 58 actual WSC2024 Excel files to document structural variations, build parser configuration. Standard Excel parsing patterns won't suffice given variance.

**Estimated effort:** 12-16 hours (file survey 4h, parser 4h, migration 2h, import 2h, validation 4h)

### Phase 2: Descriptor Library Structure & Categorization
**Rationale:** Categorization schema must be data-driven, not assumed. Can't build UI before knowing what categories/tags emerge from actual descriptor corpus. Depends on Phase 1 import completion.

**Delivers:**
- Category/tag analysis of imported descriptors (natural groupings from corpus)
- Final categorization schema (3-5 broad categories minimum, validated against 5+ descriptors threshold)
- Tag assignment logic and migration (JSONB arrays with GIN indexes)
- Category distribution validation (ensure no empty categories)
- Database indexes for filtering performance (on category, performanceLevel, criterionType)

**Addresses features:**
- Tag-based organization (validated schema)
- Multi-criteria filtering (category structure that supports faceted filtering)

**Avoids pitfalls:**
- Over-categorization (data-driven schema, minimum thresholds enforced)
- Empty categories (validate distribution before implementing UI)

**Research flag:** **Standard patterns** — Taxonomy and categorization best practices well-documented. No deep research needed.

**Estimated effort:** 6-8 hours (analysis 3h, schema design 2h, migration 1h, validation 2h)

### Phase 3: Search & Discovery Implementation
**Rationale:** Search is primary discovery mechanism (73% search vs browse). Quality matters more than advanced features. Must validate relevance before building UI around search.

**Delivers:**
- PostgreSQL FTS implementation with `ts_rank` weighted ranking (`setweight('A')` for title/criterion)
- Search API with pagination and filtering (combine FTS with category/tag filters)
- Trigram similarity for fuzzy matching (`pg_trgm` extension)
- Search relevance testing with real SCM queries (10 test queries, verify top 3 relevant)
- Performance optimization (query plans, index usage verification, <100ms target)

**Addresses features:**
- Keyword search (core table stakes with relevance ranking)
- Multi-criteria filtering (combined with search, not separate)

**Avoids pitfalls:**
- Search irrelevance (weighted ranking, test queries validate quality)
- Performance issues (GIN indexes, pagination, query plan analysis)

**Research flag:** **Needs validation** — While PostgreSQL FTS patterns are standard, relevance tuning requires testing with real descriptor content and SCM queries. Plan for iteration based on feedback.

**Estimated effort:** 8-10 hours (FTS setup 3h, API 2h, tuning 3h, testing 2h)

### Phase 4: Library UI & Preview
**Rationale:** UI depends on working search backend and validated categorization. Preview is gateway to all actions (copy/insert), must be frictionless.

**Delivers:**
- Search interface with faceted filtering (debounced input 300ms, filter pills, clear all)
- Descriptor preview modal (full context with all performance levels grouped together)
- Copy to clipboard with visual confirmation (single-click, "Copied" toast)
- Performance level grouping display (Excellent/Good/Pass/Below Pass as complete criterion)
- Source attribution display (skill badge showing WSC2024 origin)
- Responsive design for hub/skill workspace views (no horizontal scroll on mobile)

**Addresses features:**
- Preview before insert (modal workflow with full context)
- Copy to clipboard (standard UX with confirmation)
- Clear visual hierarchy (typography/spacing separate content from chrome)
- Performance level grouping (grouped display, not isolated descriptors)

**Avoids pitfalls:**
- No preview causing mistakes (modal with full performance level context)
- Overwhelming users (pagination 20 results, filters to narrow)
- Poor mobile experience (responsive design, readable without scrolling)

**Research flag:** **Standard patterns** — Component library UX patterns well-documented (VSCode snippets, Figma components, n8n templates). No deep research needed.

**Estimated effort:** 10-12 hours (search UI 4h, preview modal 3h, filtering 2h, responsive 3h)

### Phase 5: Marking Scheme Builder
**Rationale:** Core CRUD for marking schemes. Depends on descriptor library UI being functional. Simpler than export generation (no formatting complexity).

**Delivers:**
- Marking scheme creation/edit forms (Zod validation, skill association optional)
- Descriptor insertion from library (reuse search/preview from Phase 4)
- Scheme organization (drag-drop ordering with position field, mark allocation)
- Association with skill context (optional skillId foreign key)
- Permission checks (canAccessMarkingScheme follows canManageSkill pattern)

**Addresses features:**
- Build marking schemes in-app (core requirement)
- Integration with existing skill management (reuse permission patterns)

**Avoids pitfalls:**
- Role access issues (permission layer extension)
- Data integrity (proper relations, cascading deletes, transaction-wrapped)

**Research flag:** **Standard patterns** — CRUD operations and form handling well-established in Next.js/Prisma. No deep research needed.

**Estimated effort:** 8-10 hours (CRUD 4h, descriptor picker 2h, ordering UI 2h, permissions 2h)

### Phase 6: Export Generation (Excel & PDF)
**Rationale:** Export formatting is high-risk (fidelity to WSC2024 format). Must come after scheme builder is stable. Template-based approach requires upfront design work.

**Delivers:**
- Excel export with ExcelJS (styled to match WSC2024: merged cells, borders, column widths, bold headers, wrapping)
- PDF export with @react-pdf/renderer (branded, printable, page breaks, margins)
- Template system for consistent formatting (don't invent layouts, replicate WSC2024)
- Export validation with actual SCMs (side-by-side comparison, user acceptance)
- Download handling and error recovery (streaming for large schemes, error messages)

**Addresses features:**
- Export marking schemes to Excel (table stakes with professional formatting)
- Export marking schemes to PDF (table stakes with branding)

**Avoids pitfalls:**
- Export formatting loss (template-based, match WSC2024 exactly, validate with users)
- Performance issues for large schemes (streaming API, async generation if >100 descriptors)

**Research flag:** **Needs validation** — While ExcelJS/PDF patterns are documented, matching WSC2024 format exactly requires testing with real marking schemes and user validation. Plan for iteration based on SCM feedback.

**Estimated effort:** 10-14 hours (Excel template 5h, PDF template 4h, API routes 2h, validation 3h)

### Phase Ordering Rationale

**Sequential dependencies:**
1. **Data quality (Phase 1) must precede feature building** — bad data invalidates all downstream work, Excel parsing is highest-risk
2. **Categorization (Phase 2) must precede UI (Phase 4)** — can't design filters without knowing categories, schema must be data-driven
3. **Search backend (Phase 3) must precede UI (Phase 4)** — frontend depends on working API, relevance tuning needs actual corpus
4. **Library UI (Phase 4) must precede scheme builder (Phase 5)** — insertion workflow depends on library, preview/copy foundation
5. **Scheme builder (Phase 5) must precede export (Phase 6)** — can't export what doesn't exist, need real schemes to validate templates

**Risk-first sequencing:**
- Highest-risk component (Excel parsing) tackled first when energy/focus is highest
- Search relevance validated early before building UI around poor search
- Export formatting (user-facing quality) validated last with real schemes, allows iteration

**Parallel opportunities:**
- Phase 2 (categorization) can overlap with Phase 3 (search backend) — both work with imported data, different concerns
- Phase 4 (library UI) can partially overlap with Phase 5 (scheme builder) — shared components, different features

**Total estimated effort:** 54-70 hours (~7-9 days for single developer, ~4-5 days with parallelization)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1 (Data Import):** Analyze all 58 WSC2024 Excel files to document structural variations, build parser configuration map. High variance expected based on different skill managers creating files with inconsistent layouts/terminology.
- **Phase 3 (Search):** Test search relevance with real descriptor corpus and SCM queries. Ranking weights require iteration. Collect 10 representative queries from SCMs, verify top 3 results are relevant, adjust weights based on feedback.
- **Phase 6 (Export):** Side-by-side comparison with WSC2024 format, iterate on template until SCM validation passes. User acceptance criteria critical. Don't assume format, replicate exactly.

**Phases with standard patterns (skip deep research):**
- **Phase 2 (Categorization):** Taxonomy best practices well-documented (Digital Project Manager, Docsie, MatrixFlows)
- **Phase 4 (Library UI):** Component library patterns established (VSCode snippets, Figma components, n8n templates, UI-patterns.com)
- **Phase 5 (Scheme Builder):** Standard CRUD with Next.js/Prisma, drag-drop ordering libraries mature (dnd-kit, react-beautiful-dnd)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | SheetJS CDN install verified via official docs, PostgreSQL FTS production-proven at scale (1.5M records <100ms), ExcelJS mature library (1.5M+ weekly downloads, excellent documentation). @react-pdf/renderer upgrade path clear (stay on Next.js 14.2.10, compatibility issues with Next.js 15 documented). All recommendations from primary sources. |
| Features | **MEDIUM** | Feature expectations derived from component library patterns (VSCode, Figma) and workflow tools (n8n, HighLevel). Table stakes vs differentiators validated across multiple professional tool sources. Anti-features based on content curation research. Limited direct SCM user research — assumptions about WorldSkills-specific workflows based on general UX patterns. Recommend user interviews during Phase 4. |
| Architecture | **HIGH** | Integration patterns match existing codebase (Prisma models, permission layer `src\lib\permissions.ts`, API routes). Database schema follows established patterns (junction tables, optional foreign keys, generated columns for performance). PostgreSQL FTS vs Elasticsearch decision validated by multiple technical comparisons. ExcelJS vs SheetJS comparison from npm-compare.com and LogRocket. Build order sequenced by dependencies, parallelization opportunities identified. |
| Pitfalls | **HIGH** | Excel parsing fragility documented across multiple spreadsheet sources (Data Carpentry, Coefficient, MyOnlineTrainingHub). Search relevance issues verified in PostgreSQL/Elasticsearch comparisons (Couchbase, Crunchy Data, MongoDB). Export formatting and text extraction pitfalls confirmed via OCR/ETL validation research (Kili Technology, Airbyte). Schema migration patterns from Azure Cosmos DB and Metisdata. All pitfalls have prevention strategies and phase assignments. |

**Overall confidence:** **HIGH**

The research is comprehensive and grounded in primary sources (official documentation, npm statistics, existing codebase analysis). Medium confidence on features reflects lack of direct WorldSkills SCM user research, but general UX patterns are well-validated across professional tools.

### Gaps to Address

**During planning:**
- **Actual WSC2024 file analysis:** Research assumes Excel variance but needs to SEE the 58 files to document specific patterns. Plan file survey task in Phase 1 (allocate 4 hours). Build parser configuration map noting merged cell patterns, terminology variations ("Excellent" vs "Outstanding"), column structures.
- **SCM workflow validation:** Feature prioritization based on general UX patterns, not WorldSkills-specific workflows. Consider user interviews during Phase 4 UI design (3-5 SCMs, 30-min sessions, validate search/preview/copy workflow).
- **Performance benchmarks:** PostgreSQL FTS recommended for <1M descriptors, but actual descriptor count unknown. Verify 58 files × ~200 descriptors = ~12K descriptors fits comfortably within performance envelope (<100ms search target).

**During implementation:**
- **Search query patterns:** Can't tune relevance without real SCM queries. Plan to collect query logs in Phase 3 and iterate on `ts_rank` weights. Consider A/B testing different ranking algorithms if initial relevance is poor.
- **Export template fidelity:** Template must match WSC2024 format, but format not documented in research. Plan template design workshop with SCMs in Phase 6 (bring sample marking scheme, iterate until approval).
- **Category emergence:** Final categorization depends on imported data distribution. Reserve flexibility to adjust schema after Phase 1 import completes (may discover natural groupings that don't match assumptions).

**Not blocking:**
- Next.js 15 upgrade path — stay on Next.js 14.2.10 until @react-pdf/renderer compatibility resolved (GitHub issue #2994 tracks this)
- Elasticsearch migration — only needed if PostgreSQL FTS performance degrades >1M descriptors (unlikely at 12K scale)
- Collaborative features — deferred to v2+, not relevant for initial roadmap
- Multi-language support — English-only v1, defer translation until library proven valuable

## Sources

### Primary (HIGH confidence)

**Stack Research:**
- [SheetJS Next.js Documentation](https://docs.sheetjs.com/docs/demos/static/nextjs/) — Official documentation
- [SheetJS Installation (Node.js)](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) — Official installation method
- [SheetJS CDN](https://cdn.sheetjs.com/) — Verified CDN install to avoid npm vulnerabilities
- [npm package security warning](https://git.sheetjs.com/sheetjs/sheetjs/issues/3098) — v0.18.5 DoS/prototype pollution
- [PostgreSQL FTS Documentation](https://www.postgresql.org/docs/current/textsearch.html) — Official documentation
- [Prisma FTS Documentation](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search) — Preview limitations documented
- [ExcelJS npm comparison](https://npm-compare.com/exceljs,xlsx,xlsx-populate) — 1.5M+ weekly downloads vs xlsx
- [@react-pdf/renderer GitHub Issues](https://github.com/diegomura/react-pdf/issues/2460) — Next.js 15 compatibility issues

**Feature Research:**
- [VSCode Snippet Guide](https://code.visualstudio.com/api/language-extensions/snippet-guide) — Official documentation
- [Figma Components Best Practices](https://www.figma.com/best-practices/components-styles-and-shared-libraries/) — Official best practices
- [n8n Workflow Templates](https://n8n.io/workflows/) — 7888 templates, UX patterns
- [UI-patterns.com Favorites](https://ui-patterns.com/patterns/favorites) — Heart vs star, two-state buttons
- [MatrixFlows Knowledge Base Taxonomy](https://www.matrixflows.com/blog/knowledge-base-taxonomy-best-practices) — 73% search vs browse statistic
- [HighLevel Template Library](https://help.gohighlevel.com/support/solutions/articles/155000005613-template-library-for-workflows) — Workflow template UX

**Architecture Research:**
- [PostgreSQL vs Elasticsearch Full-Text Search](https://xata.io/blog/postgres-full-text-search-postgres-vs-elasticsearch) — Performance comparison
- [Postgres Full-Text Search Guide (Crunchy Data)](https://www.crunchydata.com/blog/postgres-full-text-search-a-search-engine-in-a-database) — GIN index patterns
- [Prisma PostgreSQL FTS Implementation](https://www.pedroalonso.net/blog/postgres-full-text-search/) — Raw SQL patterns
- [Best HTML to PDF Libraries for Node.js](https://blog.logrocket.com/best-html-pdf-libraries-node-js/) — ExcelJS vs alternatives
- [Database Schema Design Best Practices](https://www.bytebase.com/blog/top-database-schema-design-best-practices/) — Junction tables, indexes

**Pitfalls Research:**
- [Common Mistakes by Spreadsheet Users](https://datacarpentry.github.io/2015-05-03-NDIC/excel-ecology/02-common-mistakes.html) — Merged cells issues
- [Full-Text Search Tips for Query Performance](https://www.couchbase.com/blog/full-text-search-tips-for-query-performance/) — Ranking optimization
- [Document Management Best Practices](https://thedigitalprojectmanager.com/project-management/document-management-best-practices/) — Taxonomy design
- [Schema Migration Challenges](https://www.metisdata.io/blog/common-challenges-in-schema-migration-how-to-overcome-them) — Version strategies
- [Data Validation in ETL](https://airbyte.com/data-engineering-resources/data-validation) — Extraction quality

### Secondary (MEDIUM confidence)
- npm weekly download statistics (SheetJS 47M+, ExcelJS 1.5M+, @react-pdf/renderer stable)
- Community consensus on Excel library comparisons (xlsx vulnerabilities widely reported)
- UX pattern preferences (heart vs star icon 52% preference from A/B testing)
- Search relevance metrics from MongoDB resources (ranking algorithms)
- PostgreSQL FTS scaling data (1.5M records <100ms from Iniakunhuda Medium article)

### Tertiary (LOW confidence)
- Inferred descriptor count (~12K from 58 files × 200 avg) — needs validation with actual files
- Performance scaling assumptions (<100ms search with 10K descriptors) — based on PostgreSQL benchmarks, needs testing
- Category distribution predictions (3-5 broad categories sufficient) — will validate after Phase 1 import

---
*Research completed: 2026-02-01*
*Ready for roadmap: yes*

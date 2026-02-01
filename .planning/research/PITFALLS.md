# Pitfalls Research: Descriptor Library & Marking Scheme Feature

**Domain:** Content library with document analysis, search, and export
**Researched:** 2026-02-01
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Excel Parsing Fragility from Schema Assumptions

**What goes wrong:**
Parser breaks when encountering real-world Excel files with merged cells, inconsistent column structures, embedded formulas, or formatting variations. The system fails to extract descriptors from 40% of the 58 source files because the schema was too rigid.

**Why it happens:**
Developers build parsers based on a few example files and assume all 58 WSC2024 marking schemes follow the same structure. Excel files created by different skill managers have inconsistent layouts, merged header cells, varying terminology for performance levels (e.g., "Excellent" vs "Outstanding" vs "Level 4"), and embedded formulas that appear as text.

**How to avoid:**
- **Survey ALL 58 files BEFORE writing parser code** — document structural variations
- **Design for variance, not uniformity** — use pattern matching rather than fixed column indices
- **Handle merged cells explicitly** — use library that understands cell spans (e.g., xlsx with cellStyles option)
- **Extract text content, not formulas** — ensure raw values are extracted, not `=SUM(...)` expressions
- **Log parsing failures with file-level granularity** — capture which files fail and why
- **Build parser with configuration per skill if needed** — accept that not all files are identical

**Warning signs:**
- Parser succeeds on test files but fails on production data
- High error rate (>10%) when processing all 58 files
- Silent failures where some descriptors are missing but no error is thrown
- Merged cells cause descriptors to appear under wrong criterion

**Phase to address:**
Phase 1 (Data Import & Schema) — parser must be robust before building library features

---

### Pitfall 2: Over-Categorization Leading to Empty Categories

**What goes wrong:**
Descriptor library creates 15 different tags and 8 skill areas, but 60% of categories have fewer than 3 descriptors. Users can't find descriptors because they're scattered across too many narrow categories, defeating the purpose of categorization.

**Why it happens:**
Temptation to create very specific categories that "might be useful later" without verifying that sufficient content exists for each. Assumption that more categories = better organization, ignoring that empty or sparse categories create noise.

**How to avoid:**
- **Categorize AFTER analyzing descriptor corpus** — see what natural groupings emerge
- **Minimum threshold rule: 5+ descriptors per category** — merge or eliminate sparse categories
- **Start with 3-5 broad categories, not 15 narrow ones** — let users request subdivisions if needed
- **Use tags for flexibility, not rigid hierarchies** — descriptors can have multiple tags
- **Validate category distribution before implementing UI** — check that each category has meaningful content
- **User research on SCM mental models** — ask how they think about descriptor types

**Warning signs:**
- More than 40% of categories have fewer than 5 descriptors
- Users complaining "can't find anything" despite good search
- Most searches return results from only 2-3 categories
- Category names are overly specific ("Safety with hand tools" vs "Safety")

**Phase to address:**
Phase 2 (Descriptor Library Structure) — categorization schema must be validated before UI implementation

---

### Pitfall 3: Full-Text Search Irrelevance from Poor Ranking

**What goes wrong:**
Search for "safety procedures" returns 45 results, but the most relevant descriptors are buried on page 3. Users resort to browsing instead of searching because search results are essentially random, losing the value of the search feature entirely.

**Why it happens:**
Default full-text search implementations (like PostgreSQL `to_tsvector`) rank by keyword frequency, not semantic relevance. Descriptors with "safety" mentioned 3 times rank higher than descriptors where "safety" is the primary focus but mentioned once. No consideration of context (criterion type, skill area) in ranking.

**How to avoid:**
- **Weight title/criterion fields higher than description** — `setweight('A')` for important fields in PostgreSQL
- **Implement multi-field search with boosting** — search across descriptor text, criterion name, and skill area with different weights
- **Test search quality with real queries** — "safety", "measurement accuracy", "quality control" — verify top 3 results are relevant
- **Consider trigram similarity for fuzzy matching** — handle typos and partial matches with `pg_trgm`
- **Add metadata to ranking** — boost descriptors from multiple skills (proven across contexts)
- **Limit initial results to top 20, not all matches** — overwhelming users defeats relevance

**Warning signs:**
- Users saying "search doesn't work" when it technically returns results
- Search usage drops over time as users learn it's unreliable
- Most relevant result is rarely in top 5
- Keyword stuffing would improve ranking (indicates poor algorithm)

**Phase to address:**
Phase 3 (Search & Discovery) — search relevance must be validated with real queries before launch

---

### Pitfall 4: Export Formatting Loss Due to Direct Database-to-Excel Mapping

**What goes wrong:**
Exported marking schemes are technically correct but unusable because column widths are wrong, merged cells are lost, headers don't wrap, and the spreadsheet looks nothing like the original WSC2024 format that SCMs expect. Users refuse to use the export feature and manually recreate spreadsheets.

**Why it happens:**
Treating Excel export as simple data serialization rather than document generation. Assumption that Excel will auto-format appropriately, ignoring that proper Excel documents require explicit styling (column widths, cell merging, borders, number formats, text wrapping).

**How to avoid:**
- **Create template-based exports, not raw data dumps** — use libraries that support styling (exceljs, xlsx with cell styles)
- **Match the original WSC2024 format exactly** — don't invent new layouts, replicate what users know
- **Set explicit column widths** — auto-width doesn't work well for merged cells or wrapped text
- **Preserve visual hierarchy** — merged header cells, bold criterion names, indented sub-criteria
- **Test exports by opening in Excel AND Google Sheets** — formatting can render differently
- **Add print settings** — page breaks, margins, landscape/portrait orientation
- **Validate with actual SCMs before launch** — show exports to users, ask "would you use this?"

**Warning signs:**
- "Export looks broken" feedback despite correct data
- SCMs continue using their own Excel templates instead of exports
- Column widths force horizontal scrolling for 30+ columns
- Headers don't match original marking scheme format
- Merged cells become unmerged or appear in wrong positions

**Phase to address:**
Phase 4 (Export Generation) — export formatting must be validated with real users before release

---

### Pitfall 5: Schema Evolution Without Version Strategy

**What goes wrong:**
After launch, team realizes descriptor model needs new fields (e.g., "performance_level_differentiation_quality" rating). Database migration adds column, but existing code breaks because it assumed fixed schema. No way to distinguish v1 descriptors from v2 descriptors, making rollback impossible.

**Why it happens:**
Treating initial schema as final rather than v1. No planning for how the descriptor model will evolve as usage reveals missing metadata. Database migrations without corresponding application version management.

**How to avoid:**
- **Add `schema_version` field to descriptor table from day 1** — defaults to 1, enables versioned queries
- **Write backward-compatible migrations** — new fields must be nullable or have defaults
- **Version API responses** — `/api/descriptors/v1` allows v2 to coexist during migration
- **Test migrations on production data copy** — validate migration doesn't corrupt existing descriptors
- **Plan rollback scripts alongside migrations** — every migration has tested rollback
- **Document breaking vs non-breaking changes** — clarify which changes require version bump

**Warning signs:**
- "We can't add this field without breaking production" conversation
- Fear of deploying database changes
- No way to A/B test schema changes
- Rollback requires manual SQL surgery
- Adding a field requires coordinated deploy across multiple services

**Phase to address:**
Phase 1 (Database Schema) — version strategy must be in place before first production deployment

---

### Pitfall 6: Text Extraction Quality Blind Spots

**What goes wrong:**
10% of descriptors extracted from Excel files contain formatting artifacts: "•   Quality of finish" becomes "â¢   Quality of finish", or bullet points become random Unicode. Users lose trust in the library because of visible data quality issues.

**Why it happens:**
Excel cells contain rich text formatting (bullets, em-dashes, curly quotes) that doesn't map cleanly to plain text. Parsers extract text without handling encoding issues or stripping formatting artifacts. No quality validation step to catch corrupted text before inserting into database.

**How to avoid:**
- **Normalize text during extraction** — convert smart quotes to straight quotes, bullets to dashes
- **Detect encoding issues** — flag descriptors with unexpected Unicode ranges (>U+007F)
- **Visual inspection of random sample** — manually review 5% of extracted descriptors before bulk import
- **Implement text quality scoring** — flag descriptors with unusual character patterns
- **Preserve original alongside normalized** — keep raw extraction for debugging, display normalized
- **Log extraction artifacts** — capture warnings for manual review

**Warning signs:**
- Users reporting "weird characters" in descriptors
- Descriptors with "â€™" instead of apostrophes
- Bullet points rendering as boxes or question marks
- Em-dashes becoming two hyphens or random characters
- Inconsistent capitalization or spacing

**Phase to address:**
Phase 1 (Data Import & Schema) — text normalization must happen during initial extraction

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store entire Excel file instead of extracted text | Faster initial implementation, preserves original | Storage bloat, can't search file contents, parsing on-demand is slow | Never — defeats purpose of searchable library |
| Generic "description" field instead of structured criterion/level | Simpler schema, less parsing logic | Can't filter by performance level, poor search relevance | Never — filtering is core requirement |
| Skip text normalization during import | Faster import pipeline | Data quality issues permanent in database, fixing requires re-import | Never — users see artifacts immediately |
| Hardcode category list instead of DB table | Faster to implement, no category UI needed | Can't add categories without code deploy, no per-descriptor category stats | MVP only — plan migration to DB table |
| Single search field instead of advanced filters | Simpler UI, faster to build | Users can't narrow results by skill/criterion, poor UX for 500+ descriptors | Early prototype — must add filters before launch |
| Export without styling/formatting | Faster implementation, focuses on data | Unusable exports, users reject feature, wasted implementation effort | Never — formatting is table stakes for Excel export |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Excel parsing (xlsx library) | Using `sheet.getCell()` with hardcoded row/column indices | Use `sheet.eachRow()` to iterate rows, match headers by content not position |
| PostgreSQL full-text search | Using default `to_tsvector()` without weights | Apply `setweight()` to boost important fields (A=title, B=criterion, C=description) |
| Excel export with merged cells | Writing data then trying to merge afterward | Define merge regions before writing cell content to avoid overwriting |
| File upload for Excel imports | Accepting files without validation | Check file extension, MIME type, and parse headers before processing full file |
| S3 file storage | Storing Excel files with generic keys | Use structured keys with skill/version metadata: `marking-schemes/{skillId}/{version}.xlsx` |
| Prisma full-text queries | Using `contains` for large text fields | Use PostgreSQL `@@` full-text operator via `queryRaw` for performance |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all descriptors into memory for search | Slow page loads, high memory usage on server | Implement pagination, server-side search with cursors | >1000 descriptors (~20 files parsed) |
| N+1 queries when displaying descriptor lists | Fast initial load, then 500ms delay per descriptor | Use Prisma `include` for related data (skill, criterion) in single query | >50 descriptors per page |
| Re-parsing Excel files on every request | Slow descriptor viewing, CPU spikes | Parse once during import, store extracted text in database | First production use with real files |
| Full table scan for text search without index | Search takes 2+ seconds | Create GIN index on `tsvector` columns for PostgreSQL full-text | >500 descriptors |
| Generating Excel exports synchronously | API timeout after 30 seconds for large schemes | Queue export jobs, return download link when ready | Marking schemes with >100 criteria |
| Unoptimized PDF generation | 10+ second generation time, server CPU spikes | Use streaming, cache fonts, optimize image handling | First PDF export attempt |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Allowing arbitrary file uploads without validation | Malicious file execution, storage abuse | Validate MIME type, file extension, max size (5MB), scan for macros in .xlsx |
| Storing uploaded Excel files with user-controlled names | Path traversal attacks, file overwrite | Generate UUIDs for file keys, sanitize original filename for display only |
| Exposing all descriptors regardless of role | Data leakage if some skills are confidential | Implement role-based descriptor access (SCMs see only their skill's library in v1) |
| No rate limiting on search endpoint | DoS via rapid search queries | Rate limit search to 60 requests/minute per user |
| Including original Excel files in export downloads | Exposing source files with potential metadata/comments | Export only extracted data, never return original upload |
| Unvalidated user input in export filenames | XSS in downloaded files, path traversal | Sanitize skill names, use safe characters only, no user input in paths |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing all 500+ descriptors in one page | Overwhelming, slow scrolling, users can't find anything | Pagination with 20 results, clear "Showing X-Y of Z" indicator |
| No preview before inserting descriptor | Users don't know what they're inserting, causes mistakes | Modal preview with full context (skill, criterion, all performance levels) |
| Search with no results message | Users assume library is empty, don't know why | "No results for 'X'. Try: broader terms, check spelling, browse categories" |
| Export taking 10 seconds with no feedback | Users click multiple times, generate duplicate exports | Progress indicator "Generating marking scheme... 45%" with estimated time |
| Category filter shows empty categories | Users waste clicks on categories with 0 results | Hide categories with 0 results in current search, show count "(12)" beside category name |
| No indication of which descriptors are already used | SCMs duplicate descriptors, marking schemes become repetitive | Show "Used in 3 marking schemes" badge, offer "suggest similar" |

## "Looks Done But Isn't" Checklist

- [ ] **Excel parsing:** Tested on ALL 58 WSC2024 files, not just 5 samples — verify success rate >95%
- [ ] **Text extraction:** Visually inspect random 20 descriptors for formatting artifacts — verify no visible corruption
- [ ] **Search relevance:** Test 10 real SCM queries, verify relevant result in top 3 — verify user satisfaction >80%
- [ ] **Export formatting:** Open exported Excel in Microsoft Excel AND Google Sheets — verify identical layout to original
- [ ] **PDF export:** Print PDF to paper, verify readability and page breaks — verify no content cutoff
- [ ] **Categorization:** Verify each category has 5+ descriptors — verify no "empty category" user complaints
- [ ] **Performance:** Test search with 1000+ descriptors, verify <500ms response — verify no timeout errors
- [ ] **Error handling:** Upload malformed Excel file, verify clear error message — verify no server crash
- [ ] **Role access:** Verify SCM can only see descriptors for their skills — verify no unauthorized access
- [ ] **Mobile responsive:** Test descriptor browsing on phone, verify readable without horizontal scroll — verify mobile usability
- [ ] **Edge cases:** Test descriptor with 0 characters, 5000 characters, special characters — verify no crashes
- [ ] **Migration rollback:** Test schema rollback on staging, verify data integrity — verify rollback succeeds

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Excel parsing fails on 40% of files | HIGH | Re-analyze failed files, categorize failure types, implement parser variants, re-import |
| Poor search relevance | MEDIUM | Implement search weights, add trigram similarity, rebuild search index, test with real queries |
| Export formatting broken | LOW | Update export templates, add styling code, regenerate test exports, validate with users |
| Over-categorized library | LOW | Merge sparse categories, update tag mappings, migrate descriptors, inform users of changes |
| Text extraction artifacts | HIGH | Write normalization script, re-parse Excel files, update descriptors in database, verify fixes |
| Missing schema version field | HIGH | Add migration with default version=1, update queries to filter by version, test rollback |
| Performance issues with 1000+ descriptors | MEDIUM | Add database indexes, implement pagination, cache frequent queries, monitor performance |
| Security issue in file upload | CRITICAL | Disable upload endpoint, audit uploaded files, implement validation, re-enable with fixes |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Excel parsing fragility | Phase 1: Import | Success rate >95% on all 58 files, error log shows file-level failures |
| Over-categorization | Phase 2: Library Schema | Each category has 5+ descriptors, distribution chart shows balance |
| Search irrelevance | Phase 3: Search Implementation | Test 10 SCM queries, relevant result in top 3 for 8+ queries |
| Export formatting loss | Phase 4: Export Generation | Side-by-side comparison with original WSC2024 format shows match |
| Schema evolution issues | Phase 1: Database Design | Migration tested with rollback, schema_version field present |
| Text extraction artifacts | Phase 1: Import | Visual inspection of 20 random descriptors shows no corruption |
| N+1 query performance | Phase 3: Search Implementation | Query count logged, verify single query for descriptor list |
| Upload security issues | Phase 1: Import | File validation rejects .xlsm, >5MB files, non-Excel MIME types |

## Sources

**Excel Parsing Pitfalls:**
- [Common mistakes by spreadsheet users](https://datacarpentry.github.io/2015-05-03-NDIC/excel-ecology/02-common-mistakes.html) — merged cells, data structure issues
- [How to Parse Data in Excel: Unleash the Power of Analysis](https://coefficient.io/excel-tutorials/how-to-parse-data-in-excel) — formula parsing, syntax errors
- [10 Common Excel Mistakes to Avoid](https://www.myonlinetraininghub.com/10-common-excel-mistakes-to-avoid) — merged cells causing sorting/formula issues

**Full-Text Search Performance:**
- [Full-Text Search - 5 Tips To Improve Your Query Performance](https://www.couchbase.com/blog/full-text-search-tips-for-query-performance/) — fuzzy query performance, prefix_length optimization
- [MySQL Full-Text Search Limitations and Alternative Solutions](https://data-sleek.com/blog/the-limits-of-mysql-full-text-search-and-the-quest-for-alternative-solutions/) — performance degradation with data growth
- [Full Text Search Indexing Best Practices by Use Case Examples](https://www.couchbase.com/blog/full-text-search-indexing-best-practices-by-use-case/) — index optimization, caching strategies
- [Mastering Search Relevance: Metrics for Effective Evaluation](https://www.mongodb.com/resources/basics/search-relevance) — ranking algorithms, relevance metrics

**Document Categorization & Tagging:**
- [7 Document Management Best Practices in 2026](https://thedigitalprojectmanager.com/project-management/document-management-best-practices/) — standardized taxonomy, metadata governance
- [DAM Best Practices: 5 Tips On How To Tag Your Content](https://thedigitalprojectmanager.com/project-management/dam-tagging-best-practices/) — hierarchical tag structure, avoid duplication
- [Tagging System for Documentation Teams: Best Practices](https://www.docsie.io/blog/glossary/tagging-system/) — limit categories to 3-5, maintain consistency

**Excel/PDF Export Formatting:**
- [How to Convert Excel to PDF Without Losing Formatting](https://excelinsider.com/excel-pro-tips/export-to-pdf/without-losing-formatting/) — margin/layout issues, print preview validation
- [How to convert Excel to PDF without losing formatting](https://www.adobe.com/acrobat/hub/how-to-preserve-formatting-excel-to-pdf.html) — general formatting loss, export method selection
- [Wrong format when exporting Excel to PDF](https://forum.aspose.com/t/wrong-format-when-exporting-excel-to-pdf/279297) — row height issues, word wrapping problems

**Data Quality & Text Extraction:**
- [The Complete Guide to OCR Data Labeling: 2026 Update](https://kili-technology.com/blog/ocr-annotation) — image quality variations, auxiliary elements obscuring data
- [Evaluating the quality of AI document data extraction](https://techcommunity.microsoft.com/blog/azureforisvandstartupstechnicalblog/evaluating-the-quality-of-ai-document-data-extraction-with-small-and-large-langu/4157719) — confidence scoring, human-in-the-loop review
- [Data Validation in ETL: Why It Matters and How to Do It Right](https://airbyte.com/data-engineering-resources/data-validation) — source schema evolution, extraction validation

**Schema Evolution & Migration:**
- [Common Challenges in Schema Migration & How To Overcome Them](https://www.metisdata.io/blog/common-challenges-in-schema-migration-how-to-overcome-them) — planning changes, testing migrations, data loss risks
- [Versioning for Database Systems: Handling Schema Evolutions](https://fastercapital.com/content/Versioning-for-Database-Systems--Handling-Schema-Evolutions.html) — rollback strategies, version control
- [Azure Cosmos DB design patterns – Part 9: Schema versioning](https://devblogs.microsoft.com/cosmosdb/azure-cosmos-db-design-patterns-part-9-schema-versioning/) — SchemaVersion field pattern, seamless transitions

**Search Relevance & Ranking:**
- [What is search relevance: Everything you need to know](https://www.meilisearch.com/blog/search-relevance) — ranking factors, keyword matching, user intent
- [Reranking Hits in Public Library Catalog Search with Learning to Rank](https://www.tandfonline.com/doi/full/10.1080/01639374.2025.2562075?mi=523r8w) — library-specific challenges, sparse metadata

---
*Pitfalls research for: Descriptor Library & Marking Scheme feature*
*Researched: 2026-02-01*

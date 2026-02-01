# Feature Research: Descriptor Library & Marking Scheme

**Domain:** Content library / Reusable text component management
**Researched:** 2026-02-01
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Keyword search** | Core discovery mechanism - 73% of users search rather than browse | LOW | Full-text search across descriptor text, not just titles |
| **Multi-criteria filtering** | Users need to narrow by category (skill area, criterion type, performance level) | MEDIUM | Faceted filtering pattern - combine filters, don't replace |
| **Preview before insert** | Must see full context (all performance levels) before committing | LOW | Modal or expandable panel showing complete criterion block |
| **Copy to clipboard** | Standard expectation for reusable content libraries | LOW | Single-click copy with visual confirmation |
| **Clear visual hierarchy** | Distinguish descriptor text from metadata (tags, source skill) | LOW | Typography and spacing to separate content from chrome |
| **Performance level grouping** | Show all levels (Excellent/Good/Pass/Below Pass) together as complete criterion | MEDIUM | Descriptors aren't useful in isolation - need context of full rubric |
| **Source attribution** | Show which WSC2024 skill the descriptor came from | LOW | Trust signal - "proven in real competition" |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Tag-based organization** | Flexible categorization beyond strict hierarchies - tag "teamwork" "safety" "precision" | MEDIUM | Bridges gap between formal categories and natural search terms |
| **Saved/favorited descriptors** | SCMs can bookmark useful descriptors for current project | LOW | Personal workspace - reduces repeat searching |
| **Descriptor quality indicators** | Mark "excellent example" vs "reference only" based on curation | LOW | Guide SCMs to better patterns - educational value |
| **Cross-skill pattern discovery** | "See how other skills describe precision/safety/teamwork" | MEDIUM | Value: Learn from peers across skill families |
| **Usage analytics** | Show "most used descriptors" or "descriptors from similar skills" | HIGH | Social proof - "others found this useful" |
| **Batch insert** | Select multiple descriptors and insert as criterion set | MEDIUM | Efficiency for building schemes from scratch |
| **Comparison view** | Side-by-side view of 2-3 similar descriptors | MEDIUM | Help SCMs choose the best fit for their context |
| **Related suggestions** | "If you liked this descriptor, consider these similar ones" | HIGH | Discovery aid - surface relevant content |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **AI-generated descriptors** | "Make my job easier" | Quality control nightmare - marking schemes need precision, AI hallucinates measurements/criteria | Curated library from proven examples - humans write, AI assists with search/categorization |
| **Collaborative editing of library** | "Let SCMs contribute" | Quality dilution - becomes dumping ground of unvetted content | Admin-curated with submission workflow - contributors suggest, admins approve |
| **Real-time everything** | "Live updates during CPW" | Complexity without value - descriptor library is stable reference data, not collaborative document | Standard pagination/filtering - no WebSocket overhead |
| **Versioning individual descriptors** | "Track changes over time" | Version sprawl - which version is canonical? Creates choice paralysis | Single authoritative version per descriptor - library is snapshot of WSC2024 |
| **Rating/voting on descriptors** | "Crowdsource quality" | Popularity != quality for marking rubrics - technical accuracy matters more than votes | Expert curation with quality indicators - trust domain experts |
| **Multi-language support (v1)** | "Support all WSC languages" | Scope explosion - translation quality critical for marking criteria | English-only v1 - defer translation until library proven valuable |
| **Auto-validation of inserted descriptors** | "Ensure consistency" | False confidence - automation can't judge if descriptor fits skill context | Manual review by SCM/SA - they know their skill best |

## Feature Dependencies

```
Keyword Search (foundational)
    └──requires──> Full-text database indexing
    └──enhances──> Tag-based organization (tags boost search relevance)

Multi-criteria Filtering
    └──requires──> Normalized taxonomy (skill areas, criterion types, levels)
    └──enhances──> Keyword Search (search within filtered results)

Preview Before Insert
    └──requires──> Performance Level Grouping (must show complete criterion)
    └──enables──> Copy to Clipboard (preview → copy workflow)

Tag-based Organization
    └──requires──> Tag taxonomy (controlled vocabulary vs free-form)
    └──enhances──> Cross-skill Pattern Discovery (tags bridge skills)

Saved/Favorited Descriptors
    └──requires──> User association (many-to-many: users ↔ descriptors)
    └──conflicts with──> Stateless/shareable search URLs (favorites are personal)

Batch Insert
    └──requires──> Multi-select UI pattern
    └──requires──> Preview Before Insert (preview multiple items)

Comparison View
    └──requires──> Multi-select (select 2-3 to compare)
    └──enhances──> Preview Before Insert (alternative to single preview)
```

### Dependency Notes

- **Search + Filtering work together:** Search narrows by keyword, filtering narrows by metadata - both needed for effective discovery
- **Preview is gateway to action:** Users preview (explore) before copying/inserting (commit) - preview must be frictionless
- **Tags bridge structure and search:** Formal categories (criterion types) are limited, tags provide flexible cross-cutting dimensions
- **Batch operations require multi-select:** Don't build batch insert without supporting select multiple in UI
- **Favorites are personal, search is shareable:** Don't conflate these - SCM can't share "my favorites" URL with colleague

## MVP Definition

### Launch With (v1.0)

Minimum viable library - what's needed to validate that curated descriptors help SCMs write better marking schemes.

- [x] **Keyword search** — Primary discovery mechanism (table stakes)
- [x] **Multi-criteria filtering** — Skill area + criterion type + performance level (table stakes)
- [x] **Tag-based organization** — Flexible categorization for cross-skill discovery (differentiator with high value/cost ratio)
- [x] **Preview before insert** — Show complete criterion with all performance levels (table stakes)
- [x] **Copy to clipboard** — Standard reusable content workflow (table stakes)
- [x] **Source attribution** — Which WSC2024 skill (trust signal, table stakes)
- [x] **Performance level grouping** — Descriptors grouped as complete criteria (table stakes)

### Add After Validation (v1.x)

Features to add once core library proves valuable and usage patterns emerge.

- [ ] **Saved/favorited descriptors** — Add when SCMs report "I keep searching for the same descriptor" (trigger: repeat search patterns in analytics)
- [ ] **Descriptor quality indicators** — Add when curation reveals clear quality tiers (trigger: admin feedback during library population)
- [ ] **Batch insert** — Add when SCMs report building schemes from scratch (trigger: "insert 5+ descriptors in one session" usage pattern)
- [ ] **Comparison view** — Add when SCMs report difficulty choosing between similar descriptors (trigger: user testing feedback)
- [ ] **Usage analytics ("most used")** — Add after 3 months of usage data (trigger: sufficient data for statistical significance)

### Future Consideration (v2+)

Features to defer until product-market fit is established and library is proven valuable.

- [ ] **Cross-skill pattern discovery** — Requires mature taxonomy and rich tagging (defer: complexity high, value unclear without usage data)
- [ ] **Related suggestions** — Requires recommendation engine or similarity scoring (defer: needs ML/data science investment)
- [ ] **Collaborative library contributions** — Requires submission workflow, moderation, quality control (defer: solve curation problem first)
- [ ] **Multi-language support** — Requires translation workflow and QA (defer: validate English library first)
- [ ] **Advanced export formats** — PDF/Word with formatting (defer: Excel sufficient for v1)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Keyword search | HIGH | LOW | P1 | v1.0 |
| Multi-criteria filtering | HIGH | MEDIUM | P1 | v1.0 |
| Preview before insert | HIGH | LOW | P1 | v1.0 |
| Copy to clipboard | HIGH | LOW | P1 | v1.0 |
| Performance level grouping | HIGH | MEDIUM | P1 | v1.0 |
| Source attribution | MEDIUM | LOW | P1 | v1.0 |
| Tag-based organization | HIGH | MEDIUM | P1 | v1.0 |
| Saved/favorited descriptors | MEDIUM | LOW | P2 | v1.x |
| Descriptor quality indicators | MEDIUM | LOW | P2 | v1.x |
| Batch insert | MEDIUM | MEDIUM | P2 | v1.x |
| Comparison view | LOW | MEDIUM | P2 | v1.x |
| Usage analytics | LOW | MEDIUM | P2 | v1.x |
| Cross-skill pattern discovery | MEDIUM | HIGH | P3 | v2+ |
| Related suggestions | LOW | HIGH | P3 | v2+ |
| Collaborative contributions | LOW | HIGH | P3 | v2+ |

**Priority key:**
- P1: Must have for launch - validates core value proposition
- P2: Should have when possible - enhances proven workflows
- P3: Nice to have - future consideration after PMF

## UX Pattern Analysis

### Search & Discovery Patterns (from research)

**Industry Standard (Code Editors):**
- VSCode snippets: Search by prefix trigger, browse by category, preview in tooltip
- Sublime Text: Autocomplete-style discovery, keyword-based activation
- **Takeaway:** Instant feedback, low friction to preview, keyboard-navigable

**Content Libraries (Workflow Tools):**
- n8n templates: Browse categories, filter by keyword, instant download
- HighLevel workflows: Category + keyword + popularity sort
- **Takeaway:** Multiple discovery paths (browse OR search), not just one

**Design Systems (Component Libraries):**
- Figma components: Visual preview, tag-based search, usage examples
- UXPin patterns: Search + filter + preview, copy-paste workflow
- **Takeaway:** Visual preview is critical, show usage context not just isolated item

**Knowledge Bases:**
- 73% of users search rather than browse (source: MatrixFlows 2026)
- Inside-out organization fails - organize by user mental model, not admin taxonomy
- **Takeaway:** Search is primary, browsing is secondary - but support both

### Insert/Copy Workflow Patterns

**Standard Workflow (from research):**
1. **Discover** (search OR browse)
2. **Preview** (see full context before committing)
3. **Select** (single OR batch)
4. **Insert** (copy to clipboard OR direct insert into form)
5. **Confirm** (visual feedback: "Copied" toast)

**Clipboard vs Direct Insert:**
- Clipboard: Flexible (works anywhere), requires paste step
- Direct insert: Seamless (no paste needed), requires form context
- **Recommendation:** Support both - clipboard for flexibility, direct insert when editing marking scheme

### Favorites/Bookmarks Patterns

**Heart vs Star Icon:**
- Heart: 52% preference in A/B testing (source: UI Patterns)
- Star: More common in enterprise tools (GitHub, email)
- **Recommendation:** Heart for emotional connection ("I like this descriptor"), aligns with curation/quality focus

**Saved Items UX:**
- Two-state button: empty/filled heart, instant feedback
- Toast notification: "Added to favorites" (non-intrusive)
- Dedicated view: "My Saved Descriptors" page
- **Anti-pattern:** Inconsistent naming (favorites vs bookmarks vs saved) - pick one term

### Filtering Patterns

**Faceted Filtering (recommended):**
- Multiple independent filters combine (AND logic)
- Show filter counts: "Safety (23)"
- Clear all filters button
- Persist filters in URL for shareable links
- **Source:** Holistics, ArcGIS Pro 2026 filter patterns

**Anti-pattern: Dropdown Hell:**
- Don't hide filters in nested dropdowns
- Expose common filters upfront (skill area, criterion type)
- Use pills/tags for selected filters (visible, dismissable)

## Integration with Existing Features

| Existing Feature | Integration Point | Notes |
|------------------|-------------------|-------|
| Skill management | Filter descriptors by skill area | Leverage existing skill sectors/categories |
| Role-based access | SCMs can browse library, Admins can curate | Existing RBAC system |
| Database (Prisma) | Descriptor storage + full-text search | PostgreSQL full-text search sufficient for v1 |
| File storage (S3) | Not needed for descriptors | Descriptors are database records, not files |
| Activity logging | Log descriptor inserts | Audit trail: "SCM copied descriptor X into scheme Y" |
| Knowledge base | Separate from library | Knowledge base = static docs, Library = reusable content |

## Curation Workflow (Admin-facing)

**Not in v1.0 scope, but plan for future:**

1. **Extraction** (manual, v1.0): Admin analyzes WSC2024 schemes, copies good descriptors
2. **Tagging** (manual, v1.0): Admin assigns skill area, criterion type, tags
3. **Quality marking** (manual, v1.0): Admin flags "excellent example" vs "reference"
4. **Contribution workflow** (future): SCM suggests descriptor → Admin reviews → Approve/Reject
5. **Bulk import** (future): Upload CSV of descriptors with metadata

## Sources

### Search & Discovery UX
- [VSCode Snippet Guide](https://code.visualstudio.com/api/language-extensions/snippet-guide) - Official documentation
- [Template Library for Workflows - HighLevel](https://help.gohighlevel.com/support/solutions/articles/155000005613-template-library-for-workflows) - Workflow template UX patterns
- [7888 Workflow Automation Templates - n8n](https://n8n.io/workflows/) - Template library with search/filter
- [Knowledge Base Taxonomy Best Practices 2026](https://www.matrixflows.com/blog/knowledge-base-taxonomy-best-practices) - 73% search vs browse statistic

### Component Libraries & Patterns
- [Design Systems vs Pattern Libraries - UXPin](https://www.uxpin.com/studio/blog/design-systems-vs-pattern-libraries-vs-style-guides-whats-difference/) - Component vs pattern definitions
- [Components, Styles, and Shared Libraries - Figma](https://www.figma.com/best-practices/components-styles-and-shared-libraries/) - Component library best practices
- [Pattern Library Playbook - Futurice](https://www.futurice.com/blog/pattern-library-playbook) - Pattern library structure
- [Creating Consistent User Experiences With Pattern Libraries](https://www.axelerant.com/blog/creating-consistent-user-experiences-pattern-libraries) - Pattern library fundamentals

### Favorites/Bookmarks UX
- [Favorites design pattern - UI-patterns.com](https://ui-patterns.com/patterns/favorites) - Heart vs star, two-state buttons
- [How to design better "favorites" - UX Planet](https://uxplanet.org/how-to-design-better-favorites-d1fe8f204a1) - Consistency, feedback, naming
- [UI for Favorites - Mobiscroll](https://blog.mobiscroll.com/ui-for-favorites/) - Heart icon preference (52% vs star)

### Filtering & Search
- [Reusable Filter & Query Templates - Holistics](https://www.holistics.io/features/filter-query-templates/) - Faceted filtering patterns
- [Filter or search for editing templates - ArcGIS Pro](https://pro.arcgis.com/en/pro-app/latest/help/editing/filter-and-search-for-templates.htm) - Filter patterns in content libraries

### Content Curation & Moderation
- [10 best content moderation tools 2026 - Planable](https://planable.io/blog/content-moderation-tools/) - Curation workflow patterns
- [Content Curation Automation - Zapier](https://zapier.com/automation/content-automation/content-curation) - Moderation pipeline patterns
- [Guide to Moderating User Generated Content - Curator.io](https://curator.io/blog/moderating-user-generated-content) - UGC moderation best practices

### Copywriting & Content Tools
- [Useful Copywriting Tools - Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/copywriting/) - UX copywriting tool patterns
- [UX Writing Assistant - Frontitude](https://write.frontitude.com/) - Content library + style guidelines integration

### Workflow & Bulk Operations
- [How To Design Bulk Import UX - Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/bulk-ux/) - Bulk workflow: setup → upload → map → repair → import
- [Content workflow guide 2026 - Planable](https://planable.io/blog/content-workflow/) - Content workflow sequence patterns

---
*Feature research for: Descriptor Library & Marking Scheme*
*Researched: 2026-02-01*
*Confidence: MEDIUM - Based on WebSearch findings verified against multiple professional tools*

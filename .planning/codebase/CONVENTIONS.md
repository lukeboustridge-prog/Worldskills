# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- TypeScript/JavaScript files: lowercase with dashes for multi-word names (e.g., `global-report-button.tsx`)
- React component files: `.tsx` extension for components, `.ts` for utility modules
- Test files: `__tests__` directory within parent, named `[filename].test.ts` or `[filename].test.tsx`
- Server actions: suffixed with `-actions.ts` (e.g., `settings/actions.ts`, `import-actions.ts`)
- Example: `src/app/(dashboard)/settings/actions.ts`, `src/components/dashboard/global-report-button.tsx`

**Functions:**
- Camel case: `buildCMonthLabel()`, `computeDueDate()`, `parseFilename()`
- Descriptive action verbs: `create*`, `get*`, `format*`, `normalize*`, `validate*`, `is*`, `can*`
- Private/internal functions: prefix with single underscore for test utilities (e.g., `__resetEnvCachesForTests()`)
- Example: `createDocumentEvidenceRecord()`, `isRetryableDocumentUploadError()`, `formatFileSize()`

**Variables:**
- Camel case throughout: `competitionStart`, `accessKeyId`, `uploadPolicy`, `isActive`, `isLoading`
- Boolean flags: `is*`, `has*`, `can*` prefix (e.g., `isLoading`, `hasCompleteS3Config`, `canViewSkill()`)
- Constants: uppercase with underscores (e.g., `DEFAULT_MAX_MB`, `TRUE_VALUES`, `DUE_SOON_THRESHOLD_DAYS`)
- Descriptive names avoiding single letters (except in short loops): `deliverable`, `skillId`, `userId`

**Types:**
- Interface names: PascalCase ending with "Props" for component props (e.g., `NavLinkProps`, `LogActivityParams`)
- Type aliases: PascalCase (e.g., `StorageEnvConfig`, `FileUploadPolicy`, `DeliverableWithStatus`)
- Generic type parameters: single letter conventions (T, U, K) in brief contexts
- Example: `interface DeliverableEvidenceDocument`, `type EvidenceType`

## Code Style

**Formatting:**
- Standard TypeScript/Next.js setup (eslint-config-next) with Next.js 14.2.10
- No explicit `.prettierrc` or custom ESLint config in repo root (uses Next.js defaults)
- 2-space indentation (inferred from codebase)
- Semicolons required at end of statements
- Imports organized and sorted

**Linting:**
- Tool: `eslint` via `next lint` command
- Config: `eslint-config-next` (Next.js built-in linter)
- Run: `pnpm lint` or `npm run lint`

## Import Organization

**Order:**
1. Node.js built-in modules (e.g., `import { randomUUID } from "node:crypto"`)
2. External dependencies (e.g., `date-fns`, `zod`, `@prisma/client`)
3. Next.js modules (e.g., `next/cache`, `next/navigation`)
4. Internal absolute imports using `@/` alias (e.g., `@/lib/auth`, `@/components/ui/button`)
5. Local relative imports (rarely used due to `@/` alias availability)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Always use `@/` imports for any file within `src/` directory
- Example: `import { requireAdminUser } from "@/lib/auth"` not `import { requireAdminUser } from "../../../lib/auth"`

**Barrel Files:**
- Not enforced; imports pull directly from specific modules
- Common pattern: `src/lib/` functions exported directly from their files

## Error Handling

**Patterns:**
- Custom error classes for domain-specific errors (e.g., `StorageConfigurationError`, `ValidationError` in `src/lib/env.ts`)
- Error classes extend `Error` and set `this.name` property
- Constructor may accept options object for metadata (e.g., `providerAttempts` in `StorageConfigurationError`)
- Example:
  ```typescript
  export class StorageConfigurationError extends Error {
    providerAttempts?: StorageProviderType[];

    constructor(message: string, options?: { providerAttempts?: StorageProviderType[] }) {
      super(message);
      this.name = "StorageConfigurationError";
      if (options?.providerAttempts?.length) {
        this.providerAttempts = options.providerAttempts;
      }
    }
  }
  ```

- Auth/validation errors: throw generic `Error` with descriptive message (e.g., `throw new Error("User must be authenticated")`)
- API/storage errors: throw custom domain error classes
- Server actions: throw errors with user-friendly messages
- Try-catch in client components: catch errors, set to state, display in UI

## Logging

**Framework:** `console` (no explicit logging library)

**Patterns:**
- Client components: `console.error()` for caught exceptions (e.g., `console.error(error)`)
- Server code: `console.error()` for errors during operations
- Debug logging: not observed in codebase (assume debug logging not used in production)
- No centralized logging infrastructure detected

## Comments

**When to Comment:**
- Complex algorithms or non-obvious logic
- Regex patterns explaining what they match
- Todo/fixme comments using `TODO:` or `FIXME:` syntax (minimal observed in codebase)
- Parameter objects and destructuring in function signatures documented by type names

**JSDoc/TSDoc:**
- Not enforced in codebase
- Type annotations serve as primary documentation
- Interface/type definitions explain parameters and return values

## Function Design

**Size:**
- Functions kept concise and focused on single responsibility
- Utility functions 5-40 lines typical
- Complex logic broken into smaller helper functions
- Example: `parseFilename()` is 3 lines, `normaliseFileName()` is 15 lines

**Parameters:**
- Small number of direct parameters preferred
- Object destructuring for multiple related params (e.g., `{ skillId, userId, action, payload }`)
- Type-safe parameter interfaces for complex functions
- Example: `logActivity({ skillId, userId, action, payload }: LogActivityParams)`

**Return Values:**
- Typed explicitly (TypeScript strict mode)
- Nullable types: `SomeType | null` for optional returns
- Functions return data directly or throw errors (no null/undefined for error cases)
- Example: `function findDocumentEvidence(items: DeliverableEvidenceItem[]): DeliverableEvidenceItem | null`

## Module Design

**Exports:**
- Named exports preferred for utility functions
- Example: `export function getStorageEnv()`, `export const DEFAULT_DELIVERABLE_TEMPLATES`
- Mix of named exports and type exports in same file

**Barrel Files:**
- Not enforced; each file exports its own functionality
- Example: `src/lib/deliverables.ts` exports all deliverable-related functions directly

## React Component Patterns

**Functional Components:**
- Default: React functional components with hooks
- Use `"use client"` directive for client-side components
- Props destructured in parameters with interface type
- Example:
  ```typescript
  interface NavLinkProps {
    href: string;
    label: string;
  }

  export function NavLink({ href, label }: NavLinkProps) {
    const pathname = usePathname();
    const isActive = pathname === href;
    // component logic
  }
  ```

**Hooks:**
- `useState` for local state
- `usePathname()` from Next.js for routing info
- Hooks at top level of component

**Server Components:**
- Default App Router behavior (no `"use client"` directive)
- Async functions supported
- Direct database queries via Prisma

**Styling:**
- Tailwind CSS utility classes primary method
- `cn()` utility from `src/lib/utils.ts` for conditional classes (uses clsx + tailwind-merge)
- Example: `className={cn("base-styles", isActive ? "active-styles" : "inactive-styles")}`

---

*Convention analysis: 2026-02-01*

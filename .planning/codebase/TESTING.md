# Testing Patterns

**Analysis Date:** 2026-02-01

## Test Framework

**Runner:**
- `vitest` version 1.6.0
- Config: `vitest.config.ts` at project root
- Environment: Node.js (`environment: "node"`)
- Path alias support enabled (`@` resolves to `./src`)

**Assertion Library:**
- Vitest built-in `expect()` function
- No separate assertion library needed

**Run Commands:**
```bash
pnpm test              # Run all tests
pnpm test --watch     # Watch mode
pnpm test --coverage  # Coverage report (if configured)
```

## Test File Organization

**Location:**
- Co-located pattern: tests live in `__tests__` subdirectory alongside source code
- Examples:
  - Source: `src/lib/env.ts` → Test: `src/lib/__tests__/env.test.ts`
  - Source: `src/lib/storage/client.ts` → Test: `src/lib/storage/__tests__/client.test.ts`
  - Source: `src/app/api/storage/health/route.ts` → Test: `src/app/api/storage/health/__tests__/route.test.ts`

**Naming:**
- Pattern: `[sourceFileName].test.ts` or `[sourceFileName].test.tsx`
- All test files use `.test.ts` extension (not `.spec.ts`)
- Example: `env.test.ts`, `client.test.ts`, `route.test.ts`

**Structure:**
```
src/
├── lib/
│   ├── env.ts
│   └── __tests__/
│       └── env.test.ts
├── app/api/storage/health/
│   ├── route.ts
│   └── __tests__/
│       └── route.test.ts
└── server/reports/
    ├── globalReportData.ts
    └── __tests__/
        └── globalReportData.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("feature or function name", () => {
  // Setup
  beforeEach(() => {
    // Reset state before each test
    vi.resetModules();
    delete process.env.SOME_VAR;
  });

  // Tests
  it("should do something", () => {
    expect(value).toBe(expected);
  });

  it("should handle error case", () => {
    expect(() => functionCall()).toThrow(CustomError);
  });
});
```

**Patterns:**
- `describe()` wraps related tests
- `beforeEach()` resets environment state (process.env, module caches)
- `afterEach()` cleanup if needed (typically mirrors `beforeEach()`)
- `it()` defines individual test cases with descriptive names
- Test names are descriptive present-tense statements ("should do X", "reports Y")

**Example from `src/lib/__tests__/env.test.ts`:**
```typescript
describe("getStorageEnv", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
    delete process.env.FILE_STORAGE_ENDPOINT;
  });

  it("evaluates environment variables at call time", async () => {
    const { getStorageEnv } = await import("../env");
    expect(() => getStorageEnv()).toThrow(StorageConfigurationError);
  });
});
```

## Mocking

**Framework:** `vi` from vitest

**Patterns:**

Module mocking/resetting:
```typescript
vi.resetModules();  // Reset all module caches between tests
```

Dynamic imports for environment-dependent code:
```typescript
it("test that depends on env state", async () => {
  process.env.SOME_VAR = "value";
  // Import AFTER setting env to get fresh state
  const { getConfigFromEnv } = await import("../module");
  expect(getConfigFromEnv()).toEqual(...);
});
```

**What to Mock:**
- Environment variables (via `process.env` deletion and reassignment)
- Module imports (via `vi.resetModules()` + dynamic `import()`)
- External API calls if integrating with external services

**What NOT to Mock:**
- Prisma operations in tests (tests use real data structures, not mocked)
- Utility functions (test their real behavior)
- Type checking (rely on TypeScript)
- Helper functions (test behavior with real functions)

## Fixtures and Factories

**Test Data:**
Factory functions create test objects with sensible defaults:

```typescript
function createDeliverable(params: {
  id: string;
  skillId: string;
  dueOffsetDays: number;
  state?: DeliverableState;
  now: Date;
  isHidden?: boolean;
}): DeliverableWithStatus {
  const dueDate = addDays(params.now, params.dueOffsetDays);
  const isOverdue = params.dueOffsetDays < 0 && params.state !== DeliverableState.Validated;

  return {
    id: params.id,
    skillId: params.skillId,
    key: params.id,
    templateKey: null,
    label: `Deliverable ${params.id}`,
    dueDate,
    state: params.state ?? DeliverableState.NotStarted,
    updatedAt: params.now,
    createdAt: params.now,
    isHidden: params.isHidden ?? false,
    overdueByDays: isOverdue ? Math.abs(params.dueOffsetDays) : 0,
    isOverdue
  } satisfies DeliverableWithStatus;
}
```

**Location:**
- Factory functions defined at top of test file before test suite
- No separate fixtures directory; factories are inline helpers

## Coverage

**Requirements:** No coverage target enforced (not configured in `vitest.config.ts`)

**View Coverage:**
```bash
pnpm test --coverage  # Generate coverage report (if vitest coverage plugin installed)
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Approach: Test with various inputs and edge cases
- Example: `src/lib/__tests__/deliverables-evidence.test.ts` tests pure helper functions
- No database access, direct assertion on return values
- Test cases:
  - Happy path with valid inputs
  - Error cases with invalid inputs
  - Edge cases (empty arrays, null values, boundary conditions)

**Integration Tests:**
- Scope: API routes and server functions
- Approach: Test actual request/response flow with real Prisma operations
- Example: `src/app/api/storage/health/__tests__/route.test.ts` tests the GET handler
- Set up environment variables, call handler with Request object, assert response
- May use environment-based configuration (like storage provider setup)

**E2E Tests:**
- Framework: Not used
- Status: Not detected in codebase

## Common Patterns

**Async Testing:**
```typescript
it("creates a presigned upload when configuration is present", async () => {
  process.env.FILE_STORAGE_BUCKET = "test-bucket";
  process.env.FILE_STORAGE_REGION = "us-east-1";
  process.env.FILE_STORAGE_ACCESS_KEY_ID = "test";
  process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";

  const result = await createPresignedUpload({
    key: "deliverables/skill/example.txt",
    contentType: "image/png",
    contentLength: 1024
  });

  expect(result.uploadUrl).toContain("test-bucket");
});
```

**Error Testing:**
```typescript
it("throws a configuration error when required values are missing", async () => {
  expect(() => getFileUploadPolicy()).not.toThrow();
  await expect(
    createPresignedUpload({
      key: "test",
      contentType: "image/png",
      contentLength: 1
    })
  ).rejects.toThrow(StorageConfigurationError);
});
```

**Testing with Environment State:**
```typescript
it("evaluates environment variables at call time", async () => {
  const { getStorageEnv } = await import("../env");

  // First state: missing env vars should throw
  expect(() => getStorageEnv()).toThrow(StorageConfigurationError);

  // Second state: with env vars set
  process.env.FILE_STORAGE_BUCKET = "bucket";
  process.env.FILE_STORAGE_REGION = "us-east-1";
  process.env.FILE_STORAGE_ACCESS_KEY_ID = "key";
  process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";

  // Now it should not throw
  expect(() => getStorageEnv()).not.toThrow();

  // Cleanup
  delete process.env.FILE_STORAGE_BUCKET;
  // ... etc
});
```

**Immutability Testing:**
```typescript
it("does not mutate the original evidence array so callers can roll back on failure", () => {
  const original = createDocumentEvidenceRecord({...});
  const before: DeliverableEvidenceItem[] = [original];
  const copy = [...before];

  upsertDocumentEvidenceItem({ items: before, next: createDocumentEvidenceRecord({...}) });

  expect(before).toEqual(copy);  // Verify original array unchanged
});
```

**Response Assertion:**
```typescript
it("reports not configured when required variables are missing", async () => {
  const response = await GET(new Request("http://localhost/api/storage/health"));
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload).toEqual({
    ok: false,
    reason: "not_configured",
    provider: "aws-s3",
    runtime: "nodejs",
    diagnostic: "not_configured",
    source: "storage/health"
  });
});
```

## Test Helpers & Utilities

**Module Reset Function:**
- Functions marked with double underscore prefix for test-only exports
- Example: `export function __resetEnvCachesForTests()` in `src/lib/env.ts`
- Called in `beforeEach()` to reset cached state between tests
- Pattern: `__reset*ForTests()` naming convention

**Environment Cleanup:**
- Always cleanup process.env in `afterEach()` to prevent test pollution
- Reset vitest modules with `vi.resetModules()` in `beforeEach()`
- Example from `src/lib/storage/__tests__/client.test.ts`:
  ```typescript
  afterEach(() => {
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    // ... cleanup all test env vars
  });
  ```

---

*Testing analysis: 2026-02-01*

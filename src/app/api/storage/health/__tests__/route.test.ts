import { beforeEach, describe, expect, it } from "vitest";

const { GET } = await import("../route");
const { __resetEnvCachesForTests } = await import("@/lib/env");

describe("GET /api/storage/health", () => {
  beforeEach(() => {
    __resetEnvCachesForTests();
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
    delete process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";
  });

  afterEach(() => {
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
    delete process.env.NEXT_RUNTIME;
  });

  it("reports not configured when required variables are missing", async () => {
    const response = await GET(new Request("http://localhost/api/storage/health"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: false,
      reason: "not_configured",
      provider: "aws-s3",
      env: "local",
      runtime: "nodejs",
      diagnostic: "not_configured",
      source: "storage/health",
    });
  });

  it("reports ok when configuration is present", async () => {
    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "id";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";

    const response = await GET(new Request("http://localhost/api/storage/health"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      provider: "aws-s3",
      env: "local",
      runtime: "nodejs",
      diagnostic: "configured",
      source: "storage/health",
    });
  });

  it("reports edge runtime inheritance when the route is forced to edge", async () => {
    process.env.NEXT_RUNTIME = "edge";

    const response = await GET(new Request("http://localhost/api/storage/health"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: false,
      reason: "edge_runtime_inherited",
      provider: "aws-s3",
      env: "local",
      runtime: "edge",
      diagnostic: "edge_runtime",
      source: "storage/health",
    });
  });

  it("returns diagnostic details when requested", async () => {
    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "id";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";

    const response = await GET(new Request("http://localhost/api/storage/health?details=1"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.details).toBeTruthy();
    expect(payload.details?.bucket).toBe("bucket");
    expect(payload.details?.region).toBe("us-east-1");
    expect(payload.provider).toBe("aws-s3");
    expect(payload.env).toBe("local");
    expect(payload.runtime).toBe("nodejs");
    expect(payload.diagnostic).toBe("configured");
    expect(payload.source).toBe("storage/health");
  });
});

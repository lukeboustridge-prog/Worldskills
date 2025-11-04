import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyBlobSupport = vi.fn();

vi.mock("@/lib/storage/blob", () => ({
  verifyVercelBlobSupport: mockVerifyBlobSupport
}));

const { GET } = await import("../route");
const { __resetEnvCachesForTests } = await import("@/lib/env");

describe("GET /api/storage/health", () => {
  beforeEach(() => {
    __resetEnvCachesForTests();
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.NEXT_RUNTIME = "nodejs";
    mockVerifyBlobSupport.mockReset();
    mockVerifyBlobSupport.mockResolvedValue({ status: "error", code: "missing_token" });
  });

  afterEach(() => {
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.NEXT_RUNTIME;
  });

  it("reports not configured when required variables are missing", async () => {
    const response = await GET(new Request("http://localhost/api/storage/health"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, must-revalidate");
    const payload = await response.json();
    expect(payload).toEqual({
      ok: false,
      reason: "missing_blob_token",
      provider: "aws-s3",
      env: "local",
      runtime: "nodejs",
      diagnostic: "missing_blob_token",
      source: "storage/health"
    });
  });

  it("reports ok when configuration is present", async () => {
    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "id";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";
    process.env.BLOB_READ_WRITE_TOKEN = "token";
    mockVerifyBlobSupport.mockResolvedValue({ status: "ok", provider: "vercel-blob" });

    const response = await GET(new Request("http://localhost/api/storage/health"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      provider: "vercel-blob",
      env: "local",
      runtime: "nodejs",
      diagnostic: "blob_verified",
      source: "storage/health"
    });
  });

  it("reports runtime mismatch when the blob helper is unavailable", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "token";
    mockVerifyBlobSupport.mockResolvedValue({
      status: "error",
      code: "runtime_unavailable",
      message: "Blob upload helper is unavailable in the current runtime"
    });

    const response = await GET(new Request("http://localhost/api/storage/health"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: false,
      reason: "blob_helper_not_available_in_runtime",
      provider: "vercel-blob",
      env: "local",
      runtime: "nodejs",
      diagnostic: "blob_helper_runtime",
      source: "storage/health"
    });
  });

  it("falls back to s3 when blob helper is unavailable but s3 is configured", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "token";
    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "key";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";
    mockVerifyBlobSupport.mockResolvedValue({
      status: "error",
      code: "runtime_unavailable",
      message: "Blob upload helper is unavailable in the current runtime"
    });

    const response = await GET(new Request("http://localhost/api/storage/health"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      provider: "aws-s3",
      env: "local",
      runtime: "nodejs",
      diagnostic: "blob_runtime_fallback",
      source: "storage/health",
      note: "blob_runtime_unavailable_fell_back_to_s3"
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
      source: "storage/health"
    });
  });

  it("can return diagnostic details when requested", async () => {
    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "id";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";
    process.env.BLOB_READ_WRITE_TOKEN = "token";
    mockVerifyBlobSupport.mockResolvedValue({ status: "ok", provider: "vercel-blob" });

    const response = await GET(new Request("http://localhost/api/storage/health?details=1"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.details).toBeTruthy();
    expect(payload.details.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "bucket", present: true }),
        expect.objectContaining({ id: "region", present: true }),
        expect.objectContaining({ id: "accessKeyId", present: true }),
        expect.objectContaining({ id: "secretAccessKey", present: true })
      ])
    );
    expect(payload.details.bucket).toBe("bucket");
    expect(payload.details.region).toBe("us-east-1");
    expect(payload.provider).toBe("vercel-blob");
    expect(payload.env).toBe("local");
    expect(payload.runtime).toBe("nodejs");
    expect(payload.diagnostic).toBe("blob_verified");
    expect(payload.source).toBe("storage/health");
  });
});

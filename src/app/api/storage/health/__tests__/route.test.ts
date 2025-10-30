import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyBlobAccess = vi.fn();

vi.mock("@/lib/storage/blob", () => ({
  verifyBlobAccess: mockVerifyBlobAccess
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
    mockVerifyBlobAccess.mockReset();
    mockVerifyBlobAccess.mockResolvedValue({ status: "missing_token" });
  });

  afterEach(() => {
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
  });

  it("reports not configured when required variables are missing", async () => {
    const response = await GET(new Request("http://localhost/api/storage/health"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, must-revalidate");
    const payload = await response.json();
    expect(payload).toEqual({
      ok: false,
      reason: "not_configured",
      provider: "aws-s3",
      env: "local",
      runtime: "nodejs",
      diagnostic: "missing_blob_token"
    });
  });

  it("reports ok when configuration is present", async () => {
    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "id";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";
    mockVerifyBlobAccess.mockResolvedValue({ status: "verified" });

    const response = await GET(new Request("http://localhost/api/storage/health"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      provider: "aws-s3",
      env: "local",
      runtime: "nodejs",
      diagnostic: "blob_verified"
    });
  });

  it("can return diagnostic details when requested", async () => {
    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "id";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";
    mockVerifyBlobAccess.mockResolvedValue({ status: "verified" });

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
    expect(payload.provider).toBe("aws-s3");
    expect(payload.env).toBe("local");
    expect(payload.runtime).toBe("nodejs");
    expect(payload.diagnostic).toBe("blob_verified");
  });
});

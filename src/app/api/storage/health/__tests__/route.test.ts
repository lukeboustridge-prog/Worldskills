import { beforeEach, describe, expect, it } from "vitest";

import { GET } from "../route";
import { __resetEnvCachesForTests } from "@/lib/env";

describe("GET /api/storage/health", () => {
  beforeEach(() => {
    __resetEnvCachesForTests();
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
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
    const payload = await response.json();
    expect(payload).toEqual({ ok: false, reason: "not_configured" });
  });

  it("reports ok when configuration is present", async () => {
    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "id";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";

    const response = await GET(new Request("http://localhost/api/storage/health"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ ok: true });
  });

  it("can return diagnostic details when requested", async () => {
    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "id";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";

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
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { StorageConfigurationError } from "../env";

describe("getStorageEnv", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN;
  });

  it("evaluates environment variables at call time", async () => {
    const { getStorageEnv } = await import("../env");

    expect(() => getStorageEnv()).toThrow(StorageConfigurationError);

    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "key";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";

    expect(() => getStorageEnv()).not.toThrow();

    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
  });

  it("reports vercel blob provider when tokens are present", async () => {
    const { getStorageDiagnostics, __resetEnvCachesForTests } = await import("../env");

    process.env.BLOB_READ_WRITE_TOKEN = "token";
    process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN = "token-public";

    const diagnostics = getStorageDiagnostics();
    expect(diagnostics.provider).toBe("vercel-blob");
    expect(diagnostics.blobTokenPresent).toBe(true);
    expect(diagnostics.nextPublicBlobTokenPresent).toBe(true);
    expect(diagnostics.ok).toBe(false);

    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN;
    __resetEnvCachesForTests();
  });
});

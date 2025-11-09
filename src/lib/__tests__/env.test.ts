import { beforeEach, describe, expect, it, vi } from "vitest";

import { StorageConfigurationError } from "../env";

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

  it("detects cloudflare r2 provider when endpoint matches", async () => {
    const { getStorageDiagnostics, __resetEnvCachesForTests } = await import("../env");

    process.env.FILE_STORAGE_BUCKET = "bucket";
    process.env.FILE_STORAGE_REGION = "auto";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "key";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";
    process.env.FILE_STORAGE_ENDPOINT = "https://example.r2.cloudflarestorage.com";

    const diagnostics = getStorageDiagnostics();
    expect(diagnostics.provider).toBe("cloudflare-r2");
    expect(diagnostics.ok).toBe(true);
    expect(diagnostics.missing).toHaveLength(0);

    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
    delete process.env.FILE_STORAGE_ENDPOINT;
    __resetEnvCachesForTests();
  });
});

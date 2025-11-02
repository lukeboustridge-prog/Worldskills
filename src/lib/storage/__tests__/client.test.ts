import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  __resetEnvCachesForTests,
  getFileUploadPolicy,
  StorageConfigurationError
} from "@/lib/env";
import { createPresignedUpload, __resetStorageClientForTests } from "@/lib/storage/client";

describe("storage configuration", () => {
  beforeEach(() => {
    __resetEnvCachesForTests();
    __resetStorageClientForTests();
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
    delete process.env.FILE_STORAGE_ENDPOINT;
    delete process.env.FILE_STORAGE_FORCE_PATH_STYLE;
    delete process.env.FILE_MAX_MB;
    delete process.env.FILE_ALLOWED_MIME;
  });

  afterEach(() => {
    delete process.env.FILE_STORAGE_BUCKET;
    delete process.env.FILE_STORAGE_REGION;
    delete process.env.FILE_STORAGE_ACCESS_KEY_ID;
    delete process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
    delete process.env.FILE_STORAGE_ENDPOINT;
    delete process.env.FILE_STORAGE_FORCE_PATH_STYLE;
    delete process.env.FILE_MAX_MB;
    delete process.env.FILE_ALLOWED_MIME;
  });

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

  it("creates a presigned upload when configuration is present", async () => {
    process.env.FILE_STORAGE_BUCKET = "test-bucket";
    process.env.FILE_STORAGE_REGION = "us-east-1";
    process.env.FILE_STORAGE_ACCESS_KEY_ID = "test";
    process.env.FILE_STORAGE_SECRET_ACCESS_KEY = "secret";
    process.env.FILE_ALLOWED_MIME = "image/png";
    process.env.FILE_MAX_MB = "10";

    const policy = getFileUploadPolicy();
    expect(policy.allowedMimeTypes).toContain("image/png");
    expect(policy.maxBytes).toBe(10 * 1024 * 1024);

    const result = await createPresignedUpload({
      key: "deliverables/skill/example.txt",
      contentType: "image/png",
      contentLength: 1024,
      checksum: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    });

    expect(result.url).toContain("test-bucket");
    expect(result.key).toBe("deliverables/skill/example.txt");
    expect(result.headers["Content-Type"]).toBe("image/png");
    expect(result.headers["x-amz-checksum-sha256"]).toBe(
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    );
  });
});

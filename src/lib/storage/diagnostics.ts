// lib/storage/diagnostics.ts

export type StorageProviderType =
  | "vercel-blob"
  | "aws-s3"
  | "cloudflare-r2"
  | "supabase"
  | "minio"
  | "custom";

export type StorageDiagnostics = {
  ok: boolean;
  provider: StorageProviderType;
  bucket?: string;
  reason?: string;
};

/**
 * Report what storage we THINK is active based on env.
 * This is used only for surfacing messages to the UI / logs.
 */
export function getStorageDiagnostics(): StorageDiagnostics {
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();

  // if we have a blob token, prefer that
  if (hasBlobToken) {
    return {
      ok: true,
      provider: "vercel-blob",
      // some projects store blob bucket name here; if you have one, add it:
      bucket: process.env.FILE_STORAGE_BUCKET || undefined
    };
  }

  // else, try to infer S3-ish provider from env
  const bucket = process.env.FILE_STORAGE_BUCKET;
  const endpoint = process.env.FILE_STORAGE_ENDPOINT?.toLowerCase();
  let provider: StorageProviderType = "aws-s3";

  if (endpoint?.includes("r2.cloudflarestorage") || endpoint?.includes("cloudflare")) {
    provider = "cloudflare-r2";
  } else if (endpoint?.includes("supabase")) {
    provider = "supabase";
  } else if (endpoint?.includes("minio")) {
    provider = "minio";
  } else if (endpoint && !endpoint.includes("amazonaws")) {
    provider = "custom";
  }

  if (!bucket) {
    return {
      ok: false,
      provider,
      reason: "No Blob token and no FILE_STORAGE_BUCKET was set."
    };
  }

  return {
    ok: true,
    provider,
    bucket
  };
}

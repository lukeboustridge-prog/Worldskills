// src/lib/storage/diagnostics.ts

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
 * Response shape the UI consumes from /api/storage/health.
 * provider is optional because some client code fabricates an error object.
 */
export type StorageHealthResponse = {
  ok: boolean;
  provider?: StorageProviderType;
  reason?: string;
  note?: string;
  env?: string;
  runtime?: string;
  source?: string;
  diagnostic?: string;
  bucket?: string;
  [key: string]: unknown;
};

/**
 * What the storage debug panel wants:
 * - top-level provider (for formatProvider(...))
 * - top-level ok
 * - a payload with the original response
 * - receivedAt timestamp
 */
export type StorageDiagnosticsSnapshot = {
  provider?: StorageProviderType;
  ok?: boolean;
  payload: StorageHealthResponse;
  receivedAt: number;
};

export function getStorageDiagnostics(): StorageDiagnostics {
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (hasBlobToken) {
    return {
      ok: true,
      provider: "vercel-blob",
      // if you store the blob bucket name in env, surface it
      bucket: process.env.FILE_STORAGE_BUCKET || undefined
    };
  }

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

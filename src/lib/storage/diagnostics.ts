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
 * This is what the UI uses when it pings /api/storage/health
 * and also what our API can return.
 *
 * provider is optional because some client code creates a synthetic
 * “error” payload like { ok: false, reason: "error" }.
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
 * The admin / storage debug view wanted this shape.
 * It’s basically “what we last checked” + a timestamp.
 */
export type StorageDiagnosticsSnapshot = {
  payload: StorageHealthResponse;
  receivedAt: number;
};

export function getStorageDiagnostics(): StorageDiagnostics {
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();

  // if a Vercel Blob token exists, report that as the active provider
  if (hasBlobToken) {
    return {
      ok: true,
      provider: "vercel-blob",
      // if you want to surface the blob bucket name, reuse this var
      bucket: process.env.FILE_STORAGE_BUCKET || undefined
    };
  }

  // otherwise, try to infer S3-like provider
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


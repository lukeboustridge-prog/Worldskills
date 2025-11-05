// src/lib/storage/diagnostics.ts

export type StorageProviderType =
  | "vercel-blob"
  | "aws-s3"
  | "cloudflare-r2"
  | "supabase"
  | "minio"
  | "custom";

export type StorageRequirement = {
  key: string;
  label: string;
  present: boolean;
  optional?: boolean;
};

export type StorageDiagnostics = {
  ok: boolean;
  provider: StorageProviderType;
  bucket?: string;
  reason?: string;
  // we always return this from getStorageDiagnostics()
  requirements: StorageRequirement[];
};

/**
 * Looser shape – used in uploads UI, sometimes they only send { ok: false, reason: '...' }
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
  // uploads UI might omit this
  requirements?: StorageRequirement[];
  [key: string]: unknown;
};

/**
 * Debug panel shape – make it VERY permissive because the panel sometimes does:
 * setDiagnostics({ ...payload.details, ok: payload.ok })
 * which can be as small as { ok: true }.
 */
export type StorageDiagnosticsSnapshot = {
  provider?: StorageProviderType;
  ok?: boolean;
  requirements?: StorageRequirement[];
  payload?: StorageHealthResponse;
  receivedAt?: number;
  [key: string]: unknown;
};

export function getStorageDiagnostics(): StorageDiagnostics {
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const bucket = process.env.FILE_STORAGE_BUCKET;
  const endpoint = process.env.FILE_STORAGE_ENDPOINT?.toLowerCase();

  const requirements: StorageRequirement[] = [
    {
      key: "blob_token",
      label: "Vercel Blob token (BLOB_READ_WRITE_TOKEN)",
      present: hasBlobToken,
      optional: false
    },
    {
      key: "s3_bucket",
      label: "S3 / compatible bucket (FILE_STORAGE_BUCKET)",
      present: !!bucket,
      optional: true // because we prefer Blob now
    }
  ];

  if (hasBlobToken) {
    return {
      ok: true,
      provider: "vercel-blob",
      bucket: bucket || undefined,
      requirements
    };
  }

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
      reason: "No Blob token and no FILE_STORAGE_BUCKET was set.",
      requirements
    };
  }

  return {
    ok: true,
    provider,
    bucket,
    requirements
  };
}

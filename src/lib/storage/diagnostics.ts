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
 * This matches what the dashboard's document-evidence-manager.tsx
 * was importing as StorageHealthResponse.
 *
 * Keep it broad so the API can add fields without breaking the app.
 */
export type StorageHealthResponse = {
  ok: boolean;
  provider: StorageProviderType;
  note?: string;
  env?: string;
  runtime?: string;
  source?: string;
  diagnostic?: string;
  bucket?: string;
  // allow extra fields
  [key: string]: unknown;
};

export function getStorageDiagnostics(): StorageDiagnostics {
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (hasBlobToken) {
    return {
      ok: true,
      provider: "vercel-blob",
      // some projects surface the blob bucket name here; reuse the existing var if present
      bucket: process.env.FILE_STORAGE_BUCKET || undefined
    };
  }

  // infer S3-like provider
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

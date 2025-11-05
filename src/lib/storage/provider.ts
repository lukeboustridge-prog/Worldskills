// lib/storage/provider.ts

export type StorageMode = "auto" | "blob" | "s3";

/**
 * Decide which storage mode to run in.
 *
 * Priority:
 * 1. explicit STORAGE_PROVIDER=s3|blob
 * 2. if we have a Vercel Blob token → blob
 * 3. otherwise → auto
 */
export function getStorageMode(): StorageMode {
  const explicit = process.env.STORAGE_PROVIDER?.trim()?.toLowerCase();

  if (explicit === "s3") return "s3";
  if (explicit === "blob") return "blob";

  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (hasBlobToken) {
    return "blob";
  }

  return "auto";
}

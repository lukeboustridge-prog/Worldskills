export type StorageMode = "auto" | "blob" | "s3";

export function getStorageMode(): StorageMode {
  const explicit = process.env.STORAGE_PROVIDER?.trim()?.toLowerCase();

  // explicit override first
  if (explicit === "s3") return "s3";
  if (explicit === "blob") return "blob";

  // if we have a blob token, prefer blob
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return "blob";
  }

  // otherwise let client.ts decide
  return "auto";
}

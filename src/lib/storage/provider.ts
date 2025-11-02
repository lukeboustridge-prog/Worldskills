export type StorageProviderPreference = "auto" | "blob" | "s3";

export function getStorageMode(): StorageProviderPreference {
  const raw = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (raw === "blob" || raw === "s3") {
    return raw;
  }
  return "auto";
}

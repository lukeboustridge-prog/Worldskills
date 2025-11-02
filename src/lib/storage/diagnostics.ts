export type StorageHealthReason =
  | "not_configured"
  | "error"
  | "missing_blob_token"
  | "blob_unreachable"
  | "blob_helper_not_available_in_runtime";

export type StorageProviderType =
  | "aws-s3"
  | "cloudflare-r2"
  | "minio"
  | "supabase"
  | "vercel-blob"
  | "custom"
  | "unknown";

export interface StorageRequirementStatus {
  id: "bucket" | "region" | "accessKeyId" | "secretAccessKey";
  label: string;
  keys: string[];
  present: boolean;
  resolvedKey?: string;
  optional?: boolean;
}

export interface StorageDiagnosticsDetails {
  requirements: StorageRequirementStatus[];
  present: string[];
  missing: string[];
  bucket?: string;
  region?: string;
  endpoint?: string;
  provider: StorageProviderType;
  forcePathStyle: boolean;
  blobTokenPresent: boolean;
  nextPublicBlobTokenPresent: boolean;
}

export type StorageDiagnosticsSnapshot = StorageDiagnosticsDetails & { ok: boolean };

export interface StorageHealthDetails extends StorageDiagnosticsDetails {
  checkedAt: string;
}

export type StorageHealthDiagnostic =
  | "missing_blob_token"
  | "blob_verified"
  | "blob_unreachable"
  | "blob_helper_runtime"
  | "exception";

export interface StorageHealthResponse {
  ok: boolean;
  reason?: StorageHealthReason;
  provider?: StorageProviderType;
  env?: string;
  runtime?: "nodejs" | "edge";
  diagnostic?: StorageHealthDiagnostic;
  details?: StorageHealthDetails;
  source?: string;
}

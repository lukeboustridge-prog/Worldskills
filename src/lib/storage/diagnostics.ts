export type StorageHealthReason =
  | "not_configured"
  | "error"
  | "edge_runtime_inherited"
  | "storage_not_available";

export type StorageProviderType =
  | "aws-s3"
  | "cloudflare-r2"
  | "minio"
  | "supabase"
  | "custom"
  | "unknown";

export interface StorageRequirementStatus {
  id: "bucket" | "region" | "accessKeyId" | "secretAccessKey";
  label: string;
  keys: string[];
  present: boolean;
  resolvedKey?: string;
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
}

export type StorageDiagnosticsSnapshot = StorageDiagnosticsDetails & { ok: boolean };

export interface StorageHealthDetails extends StorageDiagnosticsDetails {
  checkedAt: string;
}

export type StorageHealthDiagnostic =
  | "not_configured"
  | "configured"
  | "edge_runtime"
  | "storage_unreachable"
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
  note?: string;
}

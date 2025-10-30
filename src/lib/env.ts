import { z } from "zod";

import type {
  StorageDiagnosticsDetails,
  StorageDiagnosticsSnapshot,
  StorageProviderType,
  StorageRequirementStatus
} from "./storage/diagnostics";

const TRUE_VALUES = new Set(["1", "true", "TRUE", "True"]);

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

type StorageEnvConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle: boolean;
};

export type FileUploadPolicy = {
  maxBytes: number;
  allowedMimeTypes: readonly string[];
};

const DEFAULT_MAX_MB = 25;
const DEFAULT_ALLOWED_MIME =
  "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/jpeg,image/png";

let uploadPolicyCache: FileUploadPolicy | null = null;

const STORAGE_REQUIREMENTS: Array<{
  id: StorageRequirementStatus["id"];
  label: string;
  keys: string[];
  missingMessage: string;
}> = [
  {
    id: "bucket",
    label: "FILE_STORAGE_BUCKET",
    keys: [
      "FILE_STORAGE_BUCKET",
      "AWS_S3_BUCKET",
      "AWS_S3_BUCKET_NAME",
      "AWS_BUCKET",
      "AWS_BUCKET_NAME",
      "S3_BUCKET",
      "S3_BUCKET_NAME",
      "S3_UPLOAD_BUCKET",
      "STORAGE_BUCKET",
      "R2_BUCKET_NAME"
    ],
    missingMessage: "FILE_STORAGE_BUCKET must be configured for document evidence uploads."
  },
  {
    id: "region",
    label: "FILE_STORAGE_REGION",
    keys: [
      "FILE_STORAGE_REGION",
      "AWS_REGION",
      "AWS_DEFAULT_REGION",
      "AWS_S3_REGION",
      "AWS_BUCKET_REGION",
      "S3_REGION",
      "S3_UPLOAD_REGION",
      "STORAGE_REGION",
      "R2_REGION"
    ],
    missingMessage: "FILE_STORAGE_REGION must be configured for document evidence uploads."
  },
  {
    id: "accessKeyId",
    label: "FILE_STORAGE_ACCESS_KEY_ID",
    keys: [
      "FILE_STORAGE_ACCESS_KEY_ID",
      "AWS_ACCESS_KEY_ID",
      "AWS_S3_ACCESS_KEY_ID",
      "S3_ACCESS_KEY_ID",
      "S3_KEY",
      "S3_UPLOAD_KEY",
      "STORAGE_ACCESS_KEY_ID",
      "R2_ACCESS_KEY_ID"
    ],
    missingMessage:
      "Storage credentials are required. Set FILE_STORAGE_ACCESS_KEY_ID and FILE_STORAGE_SECRET_ACCESS_KEY."
  },
  {
    id: "secretAccessKey",
    label: "FILE_STORAGE_SECRET_ACCESS_KEY",
    keys: [
      "FILE_STORAGE_SECRET_ACCESS_KEY",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_S3_SECRET_ACCESS_KEY",
      "S3_SECRET_ACCESS_KEY",
      "S3_SECRET",
      "S3_UPLOAD_SECRET",
      "STORAGE_SECRET_ACCESS_KEY",
      "R2_SECRET_ACCESS_KEY"
    ],
    missingMessage:
      "Storage credentials are required. Set FILE_STORAGE_ACCESS_KEY_ID and FILE_STORAGE_SECRET_ACCESS_KEY."
  }
];

const STORAGE_OPTIONAL_ENDPOINT_KEYS = [
  "FILE_STORAGE_ENDPOINT",
  "AWS_S3_ENDPOINT",
  "AWS_S3_ENDPOINT_URL",
  "S3_ENDPOINT",
  "S3_UPLOAD_ENDPOINT",
  "STORAGE_ENDPOINT",
  "R2_ENDPOINT",
  "R2_URL"
];

const STORAGE_OPTIONAL_FORCE_PATH_STYLE_KEYS = [
  "FILE_STORAGE_FORCE_PATH_STYLE",
  "AWS_S3_FORCE_PATH_STYLE",
  "S3_FORCE_PATH_STYLE",
  "STORAGE_FORCE_PATH_STYLE"
];

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

function pickEnvValue(keys: string[]): { key: string; value?: string } {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim() !== "") {
      return { key, value: value.trim() };
    }
  }
  return { key: keys[0] };
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return TRUE_VALUES.has(value);
}

function parseUploadPolicy(): FileUploadPolicy {
  if (uploadPolicyCache) {
    return uploadPolicyCache;
  }

  const maxMbRaw = readEnv("FILE_MAX_MB");
  const parsedMax = Number(maxMbRaw);
  const maxMb = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : DEFAULT_MAX_MB;

  const allowedRaw = readEnv("FILE_ALLOWED_MIME");
  const allowedValues = (allowedRaw ?? DEFAULT_ALLOWED_MIME)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const policy: FileUploadPolicy = {
    maxBytes: Math.round(maxMb * 1024 * 1024),
    allowedMimeTypes: Object.freeze([...new Set(allowedValues)])
  };

  uploadPolicyCache = policy;
  return policy;
}

export function getFileUploadPolicy(): FileUploadPolicy {
  return parseUploadPolicy();
}

export function getStorageEnv(): StorageEnvConfig {
  const { config, errors } = resolveStorageConfig();

  if (!config) {
    throw new StorageConfigurationError(errors[0] ?? "Document storage is not configured");
  }

  return config;
}

function resolveStorageConfig(): {
  config: StorageEnvConfig | null;
  diagnostics: StorageDiagnosticsDetails;
  errors: string[];
} {
  const present: string[] = [];
  const missing: string[] = [];
  const errors: string[] = [];
  const requirements: StorageRequirementStatus[] = [];

  const resolvedValues: Partial<Record<StorageRequirementStatus["id"], { value: string; key: string }>> = {};

  for (const requirement of STORAGE_REQUIREMENTS) {
    const candidate = pickEnvValue(requirement.keys);
    const presentValue = candidate.value;
    if (presentValue) {
      present.push(candidate.key);
      resolvedValues[requirement.id] = { value: presentValue, key: candidate.key };
      requirements.push({
        id: requirement.id,
        label: requirement.label,
        keys: requirement.keys,
        present: true,
        resolvedKey: candidate.key
      });
    } else {
      missing.push(requirement.label);
      errors.push(requirement.missingMessage);
      requirements.push({
        id: requirement.id,
        label: requirement.label,
        keys: requirement.keys,
        present: false
      });
    }
  }

  const endpointCandidate = pickEnvValue(STORAGE_OPTIONAL_ENDPOINT_KEYS);
  const endpoint = endpointCandidate.value;
  if (endpoint) {
    present.push(endpointCandidate.key);
  }

  const forcePathStyleCandidate = pickEnvValue(STORAGE_OPTIONAL_FORCE_PATH_STYLE_KEYS);
  const forcePathStyleValue = forcePathStyleCandidate.value;
  if (forcePathStyleValue) {
    present.push(forcePathStyleCandidate.key);
  }

  const forcePathStyle = parseBoolean(forcePathStyleValue);

  const blobToken = readEnv("BLOB_READ_WRITE_TOKEN");
  const nextPublicBlobToken = readEnv("NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN");

  const config: StorageEnvConfig | null = missing.length
    ? null
    : {
        bucket: resolvedValues.bucket!.value,
        region: resolvedValues.region!.value,
        accessKeyId: resolvedValues.accessKeyId!.value,
        secretAccessKey: resolvedValues.secretAccessKey!.value,
        endpoint,
        forcePathStyle
      };

  const provider = blobToken ? "vercel-blob" : detectStorageProvider(endpoint);

  return {
    config,
    diagnostics: {
      requirements,
      present,
      missing,
      bucket: resolvedValues.bucket?.value,
      region: resolvedValues.region?.value,
      endpoint,
      provider,
      forcePathStyle,
      blobTokenPresent: Boolean(blobToken),
      nextPublicBlobTokenPresent: Boolean(nextPublicBlobToken)
    },
    errors
  };
}

function detectStorageProvider(endpoint?: string): StorageProviderType {
  if (!endpoint) {
    return "aws-s3";
  }

  const normalized = endpoint.toLowerCase();
  if (normalized.includes("amazonaws")) {
    return "aws-s3";
  }
  if (normalized.includes("r2.cloudflarestorage") || normalized.includes("cloudflare")) {
    return "cloudflare-r2";
  }
  if (normalized.includes("supabase")) {
    return "supabase";
  }
  if (normalized.includes("minio")) {
    return "minio";
  }
  return "custom";
}

export function getStorageDiagnostics(): StorageDiagnosticsSnapshot {
  const { diagnostics, config } = resolveStorageConfig();
  return {
    ...diagnostics,
    ok: Boolean(config)
  };
}

export function getRequiredEnv(key: string, message: string) {
  const value = readEnv(key);
  if (!value) {
    throw new Error(message);
  }
  return value;
}

export function parseJsonEnv<T>(key: string, schema: z.ZodType<T>): T {
  const value = readEnv(key);
  if (!value) {
    throw new Error(`${key} is not defined`);
  }

  const parsed = schema.safeParse(JSON.parse(value));
  if (!parsed.success) {
    throw new Error(`${key} did not match the expected shape`);
  }
  return parsed.data;
}

export function __resetEnvCachesForTests() {
  uploadPolicyCache = null;
}

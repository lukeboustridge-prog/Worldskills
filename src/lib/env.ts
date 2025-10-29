import { z } from "zod";

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

let storageConfigCache: StorageEnvConfig | null = null;
let uploadPolicyCache: FileUploadPolicy | null = null;

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return TRUE_VALUES.has(value);
}

function parseRequiredString(value: string | undefined, message: string) {
  if (!value) {
    throw new StorageConfigurationError(message);
  }
  return value;
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
  if (storageConfigCache) {
    return storageConfigCache;
  }

  const bucket = parseRequiredString(
    readEnv(
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
    ),
    "FILE_STORAGE_BUCKET must be configured for document evidence uploads."
  );

  const region = parseRequiredString(
    readEnv(
      "FILE_STORAGE_REGION",
      "AWS_REGION",
      "AWS_DEFAULT_REGION",
      "AWS_S3_REGION",
      "AWS_BUCKET_REGION",
      "S3_REGION",
      "S3_UPLOAD_REGION",
      "STORAGE_REGION",
      "R2_REGION"
    ),
    "FILE_STORAGE_REGION must be configured for document evidence uploads."
  );

  const accessKeyId = parseRequiredString(
    readEnv(
      "FILE_STORAGE_ACCESS_KEY_ID",
      "AWS_ACCESS_KEY_ID",
      "AWS_S3_ACCESS_KEY_ID",
      "S3_ACCESS_KEY_ID",
      "S3_KEY",
      "S3_UPLOAD_KEY",
      "STORAGE_ACCESS_KEY_ID",
      "R2_ACCESS_KEY_ID"
    ),
    "Storage credentials are required. Set FILE_STORAGE_ACCESS_KEY_ID and FILE_STORAGE_SECRET_ACCESS_KEY."
  );

  const secretAccessKey = parseRequiredString(
    readEnv(
      "FILE_STORAGE_SECRET_ACCESS_KEY",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_S3_SECRET_ACCESS_KEY",
      "S3_SECRET_ACCESS_KEY",
      "S3_SECRET",
      "S3_UPLOAD_SECRET",
      "STORAGE_SECRET_ACCESS_KEY",
      "R2_SECRET_ACCESS_KEY"
    ),
    "Storage credentials are required. Set FILE_STORAGE_ACCESS_KEY_ID and FILE_STORAGE_SECRET_ACCESS_KEY."
  );

  const endpoint = readEnv(
    "FILE_STORAGE_ENDPOINT",
    "AWS_S3_ENDPOINT",
    "AWS_S3_ENDPOINT_URL",
    "S3_ENDPOINT",
    "S3_UPLOAD_ENDPOINT",
    "STORAGE_ENDPOINT",
    "R2_ENDPOINT",
    "R2_URL"
  );

  const forcePathStyle = parseBoolean(
    readEnv(
      "FILE_STORAGE_FORCE_PATH_STYLE",
      "AWS_S3_FORCE_PATH_STYLE",
      "S3_FORCE_PATH_STYLE",
      "STORAGE_FORCE_PATH_STYLE"
    )
  );

  storageConfigCache = {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint,
    forcePathStyle
  };

  return storageConfigCache;
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
  storageConfigCache = null;
  uploadPolicyCache = null;
}

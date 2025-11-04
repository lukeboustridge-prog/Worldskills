import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle: boolean;
};

let resolvedConfig: StorageConfig | null = null;
let client: S3Client | null = null;

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

const TRUE_VALUES = new Set(["1", "true", "TRUE", "True"]);

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

function parseBoolean(value: string | undefined) {
  if (!value) {
    return false;
  }
  return TRUE_VALUES.has(value);
}

function getConfig(): StorageConfig {
  if (resolvedConfig) {
    return resolvedConfig;
  }

  const bucket = readEnv(
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
  );
  const region = readEnv(
    "FILE_STORAGE_REGION",
    "AWS_REGION",
    "AWS_DEFAULT_REGION",
    "AWS_S3_REGION",
    "AWS_BUCKET_REGION",
    "S3_REGION",
    "S3_UPLOAD_REGION",
    "STORAGE_REGION",
    "R2_REGION"
  );
  const accessKeyId = readEnv(
    "FILE_STORAGE_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
    "AWS_S3_ACCESS_KEY_ID",
    "S3_ACCESS_KEY_ID",
    "S3_KEY",
    "S3_UPLOAD_KEY",
    "STORAGE_ACCESS_KEY_ID",
    "R2_ACCESS_KEY_ID"
  );
  const secretAccessKey = readEnv(
    "FILE_STORAGE_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_S3_SECRET_ACCESS_KEY",
    "S3_SECRET_ACCESS_KEY",
    "S3_SECRET",
    "S3_UPLOAD_SECRET",
    "STORAGE_SECRET_ACCESS_KEY",
    "R2_SECRET_ACCESS_KEY"
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

  if (!bucket) {
    throw new StorageConfigurationError(
      "FILE_STORAGE_BUCKET must be configured for document evidence uploads."
    );
  }

  if (!region) {
    throw new StorageConfigurationError(
      "FILE_STORAGE_REGION must be configured for document evidence uploads."
    );
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new StorageConfigurationError(
      "Storage credentials are required. Set FILE_STORAGE_ACCESS_KEY_ID and FILE_STORAGE_SECRET_ACCESS_KEY."
    );
  }

  resolvedConfig = {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint,
    forcePathStyle
  };

  return resolvedConfig;
}

function getClient() {
  const config = getConfig();

  if (!client) {
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  return client;
}

function sanitiseKey(key: string) {
  const trimmed = key.replace(/^\/+/, "");
  if (trimmed.includes("..")) {
    throw new Error("Storage keys must not contain relative path segments.");
  }
  return trimmed;
}

export async function createPresignedUpload(params: {
  key: string;
  contentType: string;
  contentLength: number;
  checksum: string;
  expiresIn?: number;
}) {
  const { key, contentType, contentLength, checksum, expiresIn = 300 } = params;
  const client = getClient();
  const { bucket } = getConfig();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: sanitiseKey(key),
    ContentType: contentType,
    ContentLength: contentLength,
    ChecksumSHA256: checksum
  });

  const url = await getSignedUrl(client, command, { expiresIn });

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  return {
    uploadUrl: url,
    expiresAt,
    headers: {
      "Content-Type": contentType,
      "x-amz-checksum-sha256": checksum
    }
  };
}

export async function headStoredObject(key: string) {
  const client = getClient();
  const { bucket } = getConfig();
  const command = new HeadObjectCommand({ Bucket: bucket, Key: sanitiseKey(key) });
  return client.send(command);
}

export async function deleteStoredObject(key: string) {
  const client = getClient();
  const { bucket } = getConfig();
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: sanitiseKey(key) });
  await client.send(command);
}

export async function createPresignedDownload(params: {
  key: string;
  expiresIn?: number;
  fileName?: string;
}) {
  const { key, expiresIn = 120, fileName } = params;
  const client = getClient();
  const { bucket } = getConfig();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: sanitiseKey(key),
    ResponseContentDisposition: fileName
      ? `attachment; filename="${fileName.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      : undefined
  });

  const url = await getSignedUrl(client, command, { expiresIn });

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  return {
    downloadUrl: url,
    expiresAt
  };
}

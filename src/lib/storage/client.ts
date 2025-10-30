import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getStorageEnv, StorageConfigurationError } from "@/lib/env";

let cachedClient: S3Client | null = null;

function sanitiseKey(key: string) {
  const trimmed = key.replace(/^\/+/, "");
  if (trimmed.includes("..")) {
    throw new Error("Storage keys must not contain relative path segments.");
  }
  return trimmed;
}

export function getStorageClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getStorageEnv();

  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });

  return cachedClient;
}

export async function createPresignedUpload(params: {
  key: string;
  contentType: string;
  contentLength: number;
  checksum?: string;
  expiresIn?: number;
}) {
  const { key, contentType, contentLength, checksum, expiresIn = 300 } = params;
  const client = getStorageClient();
  const { bucket } = getStorageEnv();

  const normalisedKey = sanitiseKey(key);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: normalisedKey,
    ContentType: contentType,
    ContentLength: contentLength,
    ChecksumSHA256: checksum
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const headers: Record<string, string> = {
    "Content-Type": contentType
  };

  if (checksum) {
    headers["x-amz-checksum-sha256"] = checksum;
  }

  return {
    url,
    key: normalisedKey,
    expiresAt,
    headers
  };
}

export async function headStoredObject(key: string) {
  const client = getStorageClient();
  const { bucket } = getStorageEnv();
  const command = new HeadObjectCommand({ Bucket: bucket, Key: sanitiseKey(key) });
  return client.send(command);
}

export async function deleteStoredObject(key: string) {
  const client = getStorageClient();
  const { bucket } = getStorageEnv();
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: sanitiseKey(key) });
  await client.send(command);
}

export async function createPresignedDownload(params: {
  key: string;
  expiresIn?: number;
  fileName?: string;
}) {
  const { key, expiresIn = 120, fileName } = params;
  const client = getStorageClient();
  const { bucket } = getStorageEnv();

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

export function __resetStorageClientForTests() {
  cachedClient = null;
}

export { StorageConfigurationError };

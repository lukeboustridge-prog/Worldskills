import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getStorageEnv, StorageConfigurationError } from "@/lib/env";
import type { StorageProviderType } from "@/lib/storage/diagnostics";

let cachedClient: S3Client | null = null;
let cachedProvider: StorageProviderType | null = null;

function detectProviderFromEndpoint(endpoint?: string): StorageProviderType {
  if (!endpoint) {
    return "aws-s3";
  }

  const normalised = endpoint.toLowerCase();

  if (normalised.includes("amazonaws")) {
    return "aws-s3";
  }

  if (normalised.includes("r2.cloudflarestorage") || normalised.includes("cloudflare")) {
    return "cloudflare-r2";
  }

  if (normalised.includes("supabase")) {
    return "supabase";
  }

  if (normalised.includes("minio")) {
    return "minio";
  }

  return "custom";
}

function sanitiseKey(key: string) {
  const trimmed = key.replace(/^\/+/, "");
  if (trimmed.includes("..")) {
    throw new Error("Storage keys must not contain relative path segments.");
  }
  return trimmed;
}

function getClient() {
  const config = getStorageEnv();

  if (!cachedClient) {
    const client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    // AWS SDK v3 adds a flexible checksum middleware by default.
    // R2 does not like the extra checksum query params, so remove it.
    try {
      client.middlewareStack.remove("flexibleChecksumsMiddleware");
    } catch {
      // ignore if not present
    }
    try {
      client.middlewareStack.remove("flexibleChecksumsMiddlewareOptions");
    } catch {
      // ignore if not present
    }

    cachedClient = client;
    cachedProvider = detectProviderFromEndpoint(config.endpoint);
  }

  return {
    client: cachedClient,
    config,
    provider: cachedProvider ?? detectProviderFromEndpoint(config.endpoint),
  };
}

export async function createPresignedUpload(params: {
  key: string;
  contentType: string;
  contentLength: number;
  checksum?: string; // ignored for R2
  expiresIn?: number;
}) {
  const { key, contentType, contentLength, expiresIn = 300 } = params;

  const { client, config, provider } = getClient();

  const normalisedKey = sanitiseKey(key);

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: normalisedKey,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };

  return {
    provider,
    uploadUrl: url,
    key: normalisedKey,
    expiresAt,
    headers,
  };
}

export async function headStoredObject(key: string) {
  const { client, config } = getClient();

  const command = new HeadObjectCommand({
    Bucket: config.bucket,
    Key: sanitiseKey(key),
  });

  return client.send(command);
}

export async function deleteStoredObject(key: string) {
  const { client, config } = getClient();

  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: sanitiseKey(key),
  });

  await client.send(command);
}

export async function createPresignedDownload(params: {
  key: string;
  expiresIn?: number;
  fileName?: string;
  disposition?: "attachment" | "inline";
}) {
  const { key, expiresIn = 120, fileName, disposition = "attachment" } = params;

  const { client, config } = getClient();

  const contentDisposition = fileName
    ? `${disposition}; filename="${fileName.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(
        fileName,
      )}`
    : undefined;

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: sanitiseKey(key),
    ResponseContentDisposition: contentDisposition,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  return {
    downloadUrl: url,
    expiresAt,
  };
}

export function __resetStorageClientForTests() {
  cachedClient = null;
  cachedProvider = null;
}

export { StorageConfigurationError };

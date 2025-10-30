import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { del as blobDelete, head as blobHead } from "@vercel/blob";
// @ts-ignore - type definitions are provided by the package but not bundled here.
import { generateUploadURL } from "@vercel/blob/server";

import { getStorageDiagnostics, getStorageEnv, StorageConfigurationError } from "@/lib/env";
import type { StorageProviderType } from "@/lib/storage/diagnostics";

let cachedClient: S3Client | null = null;
let cachedProvider: ActiveStorage | null = null;

type ActiveStorage =
  | {
      kind: "vercel-blob";
      token: string;
      bucket?: string;
    }
  | {
      kind: "s3";
      provider: StorageProviderType;
      config: ReturnType<typeof getStorageEnv>;
    };

function sanitiseKey(key: string) {
  const trimmed = key.replace(/^\/+/, "");
  if (trimmed.includes("..")) {
    throw new Error("Storage keys must not contain relative path segments.");
  }
  return trimmed;
}

function resolveActiveStorage(): ActiveStorage {
  if (cachedProvider) {
    return cachedProvider;
  }

  const diagnostics = getStorageDiagnostics();
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (blobToken) {
    cachedProvider = {
      kind: "vercel-blob",
      token: blobToken,
      bucket: diagnostics.bucket
    };
    return cachedProvider;
  }

  const config = getStorageEnv();
  cachedProvider = {
    kind: "s3",
    provider: diagnostics.provider,
    config
  };
  return cachedProvider;
}

function getBlobPublicBase(bucket?: string) {
  if (bucket) {
    return `https://${bucket}.public.blob.vercel-storage.com`;
  }
  return "https://blob.vercel-storage.com";
}

function getStorageClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const storage = resolveActiveStorage();
  if (storage.kind !== "s3") {
    throw new StorageConfigurationError("S3 client requested but Blob storage is active");
  }

  cachedClient = new S3Client({
    region: storage.config.region,
    endpoint: storage.config.endpoint,
    forcePathStyle: storage.config.forcePathStyle,
    credentials: {
      accessKeyId: storage.config.accessKeyId,
      secretAccessKey: storage.config.secretAccessKey
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
  const storage = resolveActiveStorage();
  const { key, contentType, contentLength, checksum, expiresIn = 300 } = params;

  if (storage.kind === "vercel-blob") {
    const safeKey = sanitiseKey(key);
    const headers: Record<string, string> = { "Content-Type": contentType };

    // generateUploadURL reads the Blob token from the environment. We still
    // provide a pathname so uploaded files remain grouped per deliverable.
    const blobResult: any = await (generateUploadURL as any)({
      access: "public",
      // ensure deterministic paths for deliverables so we can clean up later.
      pathname: safeKey,
      // cap uploads to the negotiated content length.
      contentType,
      contentLength
    });

    const uploadUrl: string = blobResult?.url ?? blobResult?.uploadUrl;
    const pathname: string = blobResult?.pathname ?? safeKey;
    const expiresAt: string =
      blobResult?.expiration ?? blobResult?.expiresAt ?? new Date(Date.now() + expiresIn * 1000).toISOString();

    if (!uploadUrl || !pathname) {
      throw new Error("Blob upload URL was not returned by the storage provider");
    }

    return {
      provider: "vercel-blob" as StorageProviderType,
      uploadUrl,
      key: pathname,
      expiresAt,
      headers
    };
  }

  const client = getStorageClient();
  const { bucket } = storage.config;

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
    provider: storage.provider,
    uploadUrl: url,
    key: normalisedKey,
    expiresAt,
    headers
  };
}

export async function headStoredObject(key: string) {
  const storage = resolveActiveStorage();

  if (storage.kind === "vercel-blob") {
    const safeKey = sanitiseKey(key);
    const result: any = await blobHead(safeKey, { token: storage.token });

    return {
      ContentLength: result?.size ?? result?.contentLength ?? null,
      ChecksumSHA256: result?.checksumSha256 ?? result?.checksumSHA256 ?? null
    };
  }

  const client = getStorageClient();
  const { bucket } = storage.config;
  const command = new HeadObjectCommand({ Bucket: bucket, Key: sanitiseKey(key) });
  return client.send(command);
}

export async function deleteStoredObject(key: string) {
  const storage = resolveActiveStorage();

  if (storage.kind === "vercel-blob") {
    await blobDelete(sanitiseKey(key), { token: storage.token });
    return;
  }

  const client = getStorageClient();
  const { bucket } = storage.config;
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: sanitiseKey(key) });
  await client.send(command);
}

export async function createPresignedDownload(params: {
  key: string;
  expiresIn?: number;
  fileName?: string;
}) {
  const { key, expiresIn = 120, fileName } = params;
  const storage = resolveActiveStorage();

  if (storage.kind === "vercel-blob") {
    const safeKey = sanitiseKey(key);
    const info: any = await blobHead(safeKey, { token: storage.token });
    const baseUrl = info?.downloadUrl ?? info?.url ?? `${getBlobPublicBase(storage.bucket)}/${safeKey}`;
    const downloadUrl = new URL(baseUrl);
    if (fileName) {
      downloadUrl.searchParams.set("download", fileName);
    }

    return {
      downloadUrl: downloadUrl.toString(),
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    };
  }

  const client = getStorageClient();
  const { bucket } = storage.config;

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
  cachedProvider = null;
}

export { StorageConfigurationError };

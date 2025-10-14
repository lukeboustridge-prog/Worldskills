import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const storageBucket = process.env.FILE_STORAGE_BUCKET;
const storageRegion = process.env.FILE_STORAGE_REGION;
const storageAccessKeyId = process.env.FILE_STORAGE_ACCESS_KEY_ID;
const storageSecretAccessKey = process.env.FILE_STORAGE_SECRET_ACCESS_KEY;
const storageEndpoint = process.env.FILE_STORAGE_ENDPOINT;
const storageForcePathStyle = process.env.FILE_STORAGE_FORCE_PATH_STYLE === "true";

if (!storageBucket) {
  throw new Error("FILE_STORAGE_BUCKET must be configured for document evidence uploads.");
}

if (!storageRegion) {
  throw new Error("FILE_STORAGE_REGION must be configured for document evidence uploads.");
}

if (!storageAccessKeyId || !storageSecretAccessKey) {
  throw new Error("Storage credentials are required. Set FILE_STORAGE_ACCESS_KEY_ID and FILE_STORAGE_SECRET_ACCESS_KEY.");
}

const STORAGE_BUCKET: string = storageBucket;
const STORAGE_REGION: string = storageRegion;
const STORAGE_ACCESS_KEY_ID: string = storageAccessKeyId;
const STORAGE_SECRET_ACCESS_KEY: string = storageSecretAccessKey;
const STORAGE_ENDPOINT: string | undefined = storageEndpoint;
const STORAGE_FORCE_PATH_STYLE: boolean = storageForcePathStyle;

let client: S3Client | null = null;

function getClient() {
  if (!client) {
    client = new S3Client({
      region: STORAGE_REGION,
      endpoint: STORAGE_ENDPOINT,
      forcePathStyle: STORAGE_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: STORAGE_ACCESS_KEY_ID,
        secretAccessKey: STORAGE_SECRET_ACCESS_KEY
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

  const command = new PutObjectCommand({
    Bucket: STORAGE_BUCKET,
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
  const command = new HeadObjectCommand({ Bucket: STORAGE_BUCKET, Key: sanitiseKey(key) });
  return client.send(command);
}

export async function deleteStoredObject(key: string) {
  const client = getClient();
  const command = new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: sanitiseKey(key) });
  await client.send(command);
}

export async function createPresignedDownload(params: {
  key: string;
  expiresIn?: number;
  fileName?: string;
}) {
  const { key, expiresIn = 120, fileName } = params;
  const client = getClient();

  const command = new GetObjectCommand({
    Bucket: STORAGE_BUCKET,
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

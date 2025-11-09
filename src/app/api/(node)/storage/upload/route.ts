import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIME_TYPES, validateDocumentEvidenceInput } from "@/lib/deliverables";
import { getStorageEnv, StorageConfigurationError } from "@/lib/env";
import { canManageSkill } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normaliseFileName } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
};

const MIME_EXTENSION_FALLBACKS: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png"
};

function resolveMimeType(file: File) {
  if (file.type) {
    return file.type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) {
    return "";
  }

  return MIME_EXTENSION_FALLBACKS[extension] ?? "";
}

function sanitiseKey(key: string) {
  const trimmed = key.replace(/^\/+/, "");
  if (trimmed.includes("..")) {
    throw new Error("Storage keys must not contain relative path segments.");
  }
  return trimmed;
}

function buildStorageKey(params: { deliverableId: string; skillId: string; filename: string }) {
  const safeName = normaliseFileName(params.filename);
  const slug = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  return `deliverables/${params.skillId}/${params.deliverableId}/${slug}-${safeName}`;
}

function encodeStorageKey(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

let cachedClient: S3Client | null = null;

function getClient() {
  const config = getStorageEnv();

  if (!cachedClient) {
    const client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });

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
  }

  return { client: cachedClient!, config };
}

function buildObjectUrl(config: ReturnType<typeof getStorageEnv>, key: string) {
  const encodedKey = encodeStorageKey(key);
  if (config.endpoint) {
    const base = config.endpoint.replace(/\/+$/, "");

    if (config.forcePathStyle) {
      return `${base}/${config.bucket}/${encodedKey}`;
    }

    try {
      const url = new URL(base.startsWith("http") ? base : `https://${base}`);
      return `${url.protocol}//${config.bucket}.${url.host}/${encodedKey}`;
    } catch {
      return `${base}/${config.bucket}/${encodedKey}`;
    }
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodedKey}`;
}

export async function POST(request: NextRequest) {
  const env = process.env.VERCEL_ENV ?? "local";
  console.log("[storage/upload] hit", { env });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid form data submitted."
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const deliverableIdEntry = formData.get("deliverableId");
  const skillIdEntry = formData.get("skillId");
  const fileEntry = formData.get("file");

  const deliverableId = typeof deliverableIdEntry === "string" ? deliverableIdEntry.trim() : "";
  const skillId = typeof skillIdEntry === "string" ? skillIdEntry.trim() : "";

  if (!deliverableId || !skillId) {
    return NextResponse.json(
      {
        error: "Deliverable and skill identifiers are required to upload a file."
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      {
        error: "Select a file to upload before continuing."
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const file = fileEntry;
  const fileName = file.name || "document";
  const mimeType = resolveMimeType(file) || "";
  const fileSize = file.size;

  try {
    validateDocumentEvidenceInput({ mimeType, fileSize });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "That file isn't supported.";
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const user = await requireUser();

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      id: true,
      skillId: true,
      skill: {
        select: {
          saId: true,
          scmId: true
        }
      }
    }
  });

  if (!deliverable) {
    return NextResponse.json({ error: "Deliverable not found." }, { status: 404, headers: NO_STORE_HEADERS });
  }

  if (deliverable.skillId !== skillId) {
    return NextResponse.json(
      { error: "Deliverable does not belong to the requested skill." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!canManageSkill(user, { saId: deliverable.skill.saId, scmId: deliverable.skill.scmId })) {
    return NextResponse.json(
      { error: "You do not have permission to upload documents or images for this skill." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const storageKey = buildStorageKey({
    deliverableId: deliverable.id,
    skillId: deliverable.skillId,
    filename: fileName
  });

  let client: S3Client;
  let config: ReturnType<typeof getStorageEnv>;
  try {
    const resolved = getClient();
    client = resolved.client;
    config = resolved.config;
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      console.error("[storage/upload] configuration error", error);
      return NextResponse.json(
        {
          error:
            "Document storage is not configured yet. Please contact the administrator to enable uploads.",
          details: error.message,
          maxBytes: DOCUMENT_MAX_BYTES,
          allowedMimeTypes: DOCUMENT_MIME_TYPES
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    throw error;
  }

  const normalisedKey = sanitiseKey(storageKey);

  let body: Buffer;
  try {
    body = Buffer.from(await file.arrayBuffer());
  } catch (cause) {
    console.error("[storage/upload] failed to read file", cause);
    return NextResponse.json(
      {
        error: "We couldn't read the uploaded file. Please try again.",
        maxBytes: DOCUMENT_MAX_BYTES,
        allowedMimeTypes: DOCUMENT_MIME_TYPES
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: normalisedKey,
    Body: body,
    ContentLength: body.byteLength,
    ContentType: mimeType
  });

  try {
    await client.send(command);
  } catch (error) {
    console.error("[storage/upload] upload failed", error);
    return NextResponse.json(
      {
        error: "Upload service is not available. Please try again shortly.",
        maxBytes: DOCUMENT_MAX_BYTES,
        allowedMimeTypes: DOCUMENT_MIME_TYPES
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const url = buildObjectUrl(config, normalisedKey);

  return NextResponse.json(
    {
      key: normalisedKey,
      bucket: config.bucket,
      url,
      maxBytes: DOCUMENT_MAX_BYTES,
      allowedMimeTypes: DOCUMENT_MIME_TYPES
    },
    { headers: NO_STORE_HEADERS }
  );
}

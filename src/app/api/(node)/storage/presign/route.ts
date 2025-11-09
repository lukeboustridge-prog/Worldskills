import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSkill } from "@/lib/permissions";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  validateDocumentEvidenceInput
} from "@/lib/deliverables";
import { normaliseFileName } from "@/lib/utils";
import { createPresignedUpload, StorageConfigurationError } from "@/lib/storage/client";
import type { StorageProviderType } from "@/lib/storage/diagnostics";
import { ValidationError, getStorageDiagnostics } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
};

function resolveProviderHint(current?: StorageProviderType) {
  if (current) {
    return current;
  }
  try {
    return getStorageDiagnostics().provider;
  } catch {
    return undefined;
  }
}

const payloadSchema = z.object({
  deliverableId: z.string().min(1, "Deliverable id is required"),
  skillId: z.string().min(1, "Skill id is required"),
  filename: z.string().min(1, "File name is required"),
  contentType: z.string().min(1, "File type is required"),
  byteSize: z.number().int().positive("File size must be positive"),
  checksum: z
    .string()
    .min(44, "Checksum is required")
    .regex(/^[A-Za-z0-9+/=]+$/, "Checksum must be base64 encoded")
    .optional()
});

type NormalisedPayload = z.infer<typeof payloadSchema>;

type NormalisedResult =
  | { success: true; data: NormalisedPayload }
  | { success: false; error: string };

function readStringValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return undefined;
}

function readNumericValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function normalisePayload(body: unknown): NormalisedResult {
  if (!body || typeof body !== "object") {
    return {
      success: false,
      error: "Deliverable, skill, file name, file size, and type are required to upload."
    };
  }

  const source = body as Record<string, unknown>;

  const deliverableId = readStringValue(source, [
    "deliverableId",
    "deliverableID",
    "deliverable_id"
  ]);
  const skillId = readStringValue(source, ["skillId", "skillID", "skill_id"]);
  const filename = readStringValue(source, ["filename", "fileName", "name"]);
  const contentType = readStringValue(source, [
    "contentType",
    "mimeType",
    "type"
  ]);
  const byteSize = readNumericValue(source, ["byteSize", "fileSize", "size"]);
  const checksum = readStringValue(source, [
    "checksum",
    "checksumSha256",
    "checksumSHA256",
    "checksum_sha256",
    "sha256"
  ]);

  const candidate: Partial<NormalisedPayload> = {
    deliverableId: deliverableId ?? "",
    skillId: skillId ?? "",
    filename: filename ?? "",
    contentType: contentType ?? "",
    byteSize: byteSize ?? Number.NaN,
    checksum: checksum
  };

  const parsed = payloadSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map((issue) => issue.message).join(" \u2022 ")
    };
  }

  return { success: true, data: parsed.data };
}

function buildStorageKey(params: { deliverableId: string; skillId: string; filename: string }) {
  const safeName = normaliseFileName(params.filename);
  const slug = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  return `deliverables/${params.skillId}/${params.deliverableId}/${slug}-${safeName}`;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  const env = process.env.VERCEL_ENV ?? "local";
  console.log("[storage/presign] hit", {
    env
  });

  let providerHint: StorageProviderType | undefined;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const draftBody =
    body && typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const { filename, contentType, byteSize } = draftBody as {
    filename?: unknown;
    contentType?: unknown;
    byteSize?: unknown;
  };

  console.info("[storage/presign] incoming", {
    filename,
    contentType,
    byteSize,
    maxMb: process.env.FILE_MAX_MB
  });

  const maxMb = Number(process.env.FILE_MAX_MB ?? 25);
  const maxBytes = maxMb * 1024 * 1024;

  let numericByteSize: number | null = null;
  if (typeof byteSize === "number" && Number.isFinite(byteSize)) {
    numericByteSize = byteSize;
  } else if (typeof byteSize === "string" && byteSize.trim() !== "") {
    const parsed = Number(byteSize);
    if (Number.isFinite(parsed)) {
      numericByteSize = parsed;
    }
  }

  if (numericByteSize === null) {
    return NextResponse.json(
      {
        error: "invalid_size",
        message: "Server did not receive a valid file size from the browser.",
        receivedByteSize: byteSize ?? null
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (numericByteSize > maxBytes) {
    return NextResponse.json(
      {
        error: "file_too_large",
        message: `File is too large. Max allowed is ${maxMb} MB.`,
        receivedByteSize: numericByteSize,
        maxBytes
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  draftBody.byteSize = numericByteSize;
  body = draftBody;

  const normalised = normalisePayload(body);

  if (!normalised.success) {
    return NextResponse.json(
      {
        error: normalised.error
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const user = await requireUser();

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: normalised.data.deliverableId },
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

  if (deliverable.skillId !== normalised.data.skillId) {
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

  try {
    try {
      validateDocumentEvidenceInput({
        mimeType: normalised.data.contentType,
        fileSize: normalised.data.byteSize
      });
    } catch (cause) {
      throw new ValidationError(
        cause instanceof Error
          ? cause.message
          : "That file isn't supported. Upload a PDF, Word document, or image."
      );
    }

    const storageKey = buildStorageKey({
      deliverableId: deliverable.id,
      skillId: deliverable.skillId,
      filename: normalised.data.filename
    });

    const presigned = await createPresignedUpload({
      key: storageKey,
      contentType: normalised.data.contentType,
      contentLength: normalised.data.byteSize,
      checksum: normalised.data.checksum
    });

    providerHint = presigned.provider;
    console.log("[storage/presign] presign-success", { env, provider: providerHint });

    const requiredHeaders =
      presigned.headers && typeof presigned.headers === "object"
        ? presigned.headers
        : undefined;

    return NextResponse.json(
      {
        uploadUrl: presigned.uploadUrl,
        key: presigned.key,
        expiresAt: presigned.expiresAt,
        headers: presigned.headers,
        requiredHeaders,
        provider: presigned.provider,
        maxBytes: DOCUMENT_MAX_BYTES,
        allowedMimeTypes: DOCUMENT_MIME_TYPES
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const provider = resolveProviderHint(providerHint);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: error.message,
          provider: provider ?? null,
          env
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (error instanceof StorageConfigurationError) {
      console.error("[storage/presign] configuration error", {
        message: error.message,
        stack: error.stack,
        provider,
        env,
        providerAttempts: error.providerAttempts
      });
      return NextResponse.json(
        {
          error: "storage_not_configured",
          message:
            "Document storage is not configured yet. Please contact the administrator to enable uploads.",
          provider: provider ?? null,
          env,
          details: { providerAttempts: error.providerAttempts ?? [] }
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    console.error("[storage/presign] failed", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      provider,
      env
    });
    const message =
      error instanceof Error
        ? error.message
        : "We couldn't prepare the upload. Please try again shortly.";
    return NextResponse.json(
      {
        error: "presign_failed",
        message,
        provider: provider ?? null,
        env
      },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}

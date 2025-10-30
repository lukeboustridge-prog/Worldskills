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
import {
  createPresignedUpload,
  StorageConfigurationError
} from "@/lib/storage/client";
import { ValidationError } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
};

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

function buildStorageKey(params: { deliverableId: string; skillId: string; filename: string }) {
  const safeName = normaliseFileName(params.filename);
  const slug = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  return `deliverables/${params.skillId}/${params.deliverableId}/${slug}-${safeName}`;
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.errors.map((issue) => issue.message).join(" \u2022 ")
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const user = await requireUser();

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: parsed.data.deliverableId },
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

  if (deliverable.skillId !== parsed.data.skillId) {
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
        mimeType: parsed.data.contentType,
        fileSize: parsed.data.byteSize
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
      filename: parsed.data.filename
    });

    const presigned = await createPresignedUpload({
      key: storageKey,
      contentType: parsed.data.contentType,
      contentLength: parsed.data.byteSize,
      checksum: parsed.data.checksum
    });

    return NextResponse.json(
      {
        uploadUrl: presigned.uploadUrl,
        key: presigned.key,
        expiresAt: presigned.expiresAt,
        headers: presigned.headers,
        provider: presigned.provider,
        maxBytes: DOCUMENT_MAX_BYTES,
        allowedMimeTypes: DOCUMENT_MIME_TYPES
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (error instanceof StorageConfigurationError) {
      console.error("Document storage is not configured", error);
      return NextResponse.json(
        {
          error: "Document storage is not configured yet. Please contact the administrator to enable uploads."
        },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    console.error("Failed to create presigned upload", error);
    return NextResponse.json(
      { error: "We couldn't prepare the upload. Please try again shortly." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

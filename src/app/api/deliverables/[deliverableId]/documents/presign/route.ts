import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  validateDocumentEvidenceInput,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES
} from "@/lib/deliverables";
import { normaliseFileName } from "@/lib/utils";
import { createPresignedUpload, StorageConfigurationError } from "@/lib/storage/client";
import { canManageSkill } from "@/lib/permissions";
import { getStorageMode } from "@/lib/storage/provider";
import { verifyVercelBlobSupport } from "@/lib/storage/blob";
import type { BlobVerificationResult } from "@/lib/storage/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  skillId: z.string().min(1, "Skill id is required"),
  fileName: z.string().min(1, "Choose a file to upload"),
  mimeType: z.string().min(1, "File type is required"),
  fileSize: z.number().int().positive("File size must be positive"),
  checksum: z
    .string()
    .min(44, "Checksum is required")
    .regex(/^[A-Za-z0-9+/=]+$/, "Checksum must be base64 encoded")
});

function buildStorageKey(params: { skillId: string; deliverableId: string; fileName: string }) {
  const safeName = normaliseFileName(params.fileName);
  const slug = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  return `deliverables/${params.skillId}/${params.deliverableId}/${slug}-${safeName}`;
}

export async function POST(request: NextRequest, { params }: { params: { deliverableId: string } }) {
  const user = await requireUser();

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.errors.map((issue) => issue.message).join(" \u2022 ")
      },
      { status: 400 }
    );
  }

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: params.deliverableId },
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
    return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });
  }

  if (deliverable.skillId !== parsed.data.skillId) {
    return NextResponse.json({ error: "Deliverable does not belong to the requested skill." }, { status: 400 });
  }

  if (!canManageSkill(user, { saId: deliverable.skill.saId, scmId: deliverable.skill.scmId })) {
    return NextResponse.json({ error: "You do not have permission to upload documents or images for this skill." }, { status: 403 });
  }

  validateDocumentEvidenceInput({
    mimeType: parsed.data.mimeType,
    fileSize: parsed.data.fileSize
  });

  const storageKey = buildStorageKey({
    skillId: deliverable.skillId,
    deliverableId: deliverable.id,
    fileName: parsed.data.fileName
  });

  const mode = getStorageMode();
  const blobVerification: BlobVerificationResult | null =
    mode === "s3" ? null : await verifyVercelBlobSupport();
  const preferS3Fallback =
    mode === "auto" && blobVerification?.status === "error" && blobVerification.code === "runtime_unavailable";

  let upload;
  try {
    upload = await createPresignedUpload(
      {
        key: storageKey,
        contentType: parsed.data.mimeType,
        contentLength: parsed.data.fileSize,
        checksum: parsed.data.checksum
      },
      preferS3Fallback ? { preferS3: true } : undefined
    );
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      console.error("Document storage is not configured", error);
      return NextResponse.json(
        {
          error:
            "Document storage is not configured yet. Please contact the administrator to enable uploads."
        },
        { status: 503 }
      );
    }

    console.error("Failed to create presigned upload", error);
    return NextResponse.json(
      { error: "We couldn't prepare the upload. Please try again shortly." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    uploadUrl: upload.uploadUrl,
    headers: upload.headers,
    expiresAt: upload.expiresAt,
    storageKey: upload.key,
    provider: upload.provider,
    maxBytes: DOCUMENT_MAX_BYTES,
    allowedMimeTypes: DOCUMENT_MIME_TYPES
  });
}

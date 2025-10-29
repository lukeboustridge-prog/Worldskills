import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createDocumentEvidenceRecord,
  findDocumentEvidence,
  normaliseEvidenceItems,
  serialiseEvidenceItems,
  upsertDocumentEvidenceItem,
  validateDocumentEvidenceInput
} from "@/lib/deliverables";
import {
  deleteStoredObject,
  headStoredObject,
  StorageConfigurationError
} from "@/lib/storage";
import { canManageSkill } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const payloadSchema = z.object({
  skillId: z.string().min(1, "Skill id is required"),
  storageKey: z.string().min(1, "Storage key is required"),
  fileName: z.string().min(1, "File name is required"),
  mimeType: z.string().min(1, "File type is required"),
  fileSize: z.number().int().positive("File size must be positive"),
  checksum: z
    .string()
    .min(44, "Checksum is required")
    .regex(/^[A-Za-z0-9+/=]+$/, "Checksum must be base64 encoded"),
  replaceEvidenceId: z.string().optional()
});

function ensureKeyForDeliverable(storageKey: string, skillId: string, deliverableId: string) {
  const expectedPrefix = `deliverables/${skillId}/${deliverableId}/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    throw new Error("Storage key does not match this deliverable.");
  }
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
      evidenceItems: true,
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
    return NextResponse.json({ error: "You do not have permission to manage documents for this skill." }, { status: 403 });
  }

  validateDocumentEvidenceInput({
    mimeType: parsed.data.mimeType,
    fileSize: parsed.data.fileSize
  });

  try {
    ensureKeyForDeliverable(parsed.data.storageKey, deliverable.skillId, deliverable.id);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  let metadata;
  try {
    metadata = await headStoredObject(parsed.data.storageKey);
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

    return NextResponse.json(
      { error: "We couldn't confirm the uploaded file. Try uploading again." },
      { status: 400 }
    );
  }

  if (metadata.ContentLength != null && metadata.ContentLength !== parsed.data.fileSize) {
    return NextResponse.json({ error: "Uploaded file size didn't match. Please try again." }, { status: 400 });
  }

  const remoteChecksum = metadata.ChecksumSHA256;
  if (remoteChecksum && remoteChecksum !== parsed.data.checksum) {
    return NextResponse.json({ error: "Upload checksum mismatch. Please upload the file again." }, { status: 400 });
  }

  const evidenceItems = normaliseEvidenceItems(deliverable.evidenceItems);
  const existing = findDocumentEvidence(evidenceItems);
  const nextVersion = existing ? (existing.version ?? 1) + 1 : 1;

  const documentRecord = createDocumentEvidenceRecord({
    storageKey: parsed.data.storageKey,
    fileName: parsed.data.fileName,
    fileSize: parsed.data.fileSize,
    mimeType: parsed.data.mimeType,
    checksum: parsed.data.checksum,
    version: nextVersion
  });

  const upserted = upsertDocumentEvidenceItem({
    items: evidenceItems,
    next: documentRecord,
    replaceId: parsed.data.replaceEvidenceId ?? undefined
  });

  const payload = serialiseEvidenceItems(upserted.items);

  await prisma.deliverable.update({
    where: { id: deliverable.id },
    data: {
      evidenceItems: payload,
      updatedBy: user.id
    }
  });

  await logActivity({
    skillId: deliverable.skillId,
    userId: user.id,
    action: upserted.removed ? "DeliverableDocumentReplaced" : "DeliverableDocumentUploaded",
    payload: {
      deliverableId: deliverable.id,
      documentId: documentRecord.id,
      fileName: documentRecord.fileName,
      storageKey: documentRecord.storageKey
    }
  });

  revalidatePath(`/skills/${deliverable.skillId}`);
  revalidatePath("/dashboard");

  let warning: string | null = null;
  if (upserted.removed) {
    try {
      await deleteStoredObject(upserted.removed.storageKey);
    } catch (error) {
      warning = "The previous document could not be removed. We'll clean it up shortly.";
      console.error("Failed to delete replaced document", error);
    }
  }

  return NextResponse.json({
    evidence: documentRecord,
    warning
  });
}

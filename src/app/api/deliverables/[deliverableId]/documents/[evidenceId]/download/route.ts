import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isDocumentEvidence,
  normaliseEvidenceItems,
  type DeliverableEvidenceDocument
} from "@/lib/deliverables";
import { canViewSkill } from "@/lib/permissions";
import { createPresignedDownload, StorageConfigurationError } from "@/lib/storage";
import { normaliseFileName } from "@/lib/utils";

const DOWNLOAD_TTL_SECONDS = Number(process.env.FILE_DOWNLOAD_TTL_SECONDS ?? 120);

export async function GET(request: NextRequest, { params }: { params: { deliverableId: string; evidenceId: string } }) {
  const user = await requireUser();

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: params.deliverableId },
    select: {
      id: true,
      label: true,
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

  if (!canViewSkill(user, { saId: deliverable.skill.saId, scmId: deliverable.skill.scmId })) {
    return NextResponse.json({ error: "You do not have access to this document." }, { status: 403 });
  }

  const evidenceItems = normaliseEvidenceItems(deliverable.evidenceItems);
  const document = evidenceItems.find(
    (item): item is DeliverableEvidenceDocument =>
      isDocumentEvidence(item) && item.id === params.evidenceId
  );

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (document.status === "processing") {
    return NextResponse.json({ error: "This document is still being scanned and isn't available yet." }, { status: 423 });
  }

  if (document.status === "blocked") {
    return NextResponse.json({ error: "This document is unavailable pending review." }, { status: 423 });
  }

  const fileName = normaliseFileName(document.fileName || deliverable.label);

  let download;
  try {
    download = await createPresignedDownload({
      key: document.storageKey,
      expiresIn: DOWNLOAD_TTL_SECONDS,
      fileName
    });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      console.error("Document storage is not configured", error);
      return NextResponse.json(
        {
          error:
            "Document storage is not configured yet. Please contact the administrator to enable downloads."
        },
        { status: 503 }
      );
    }

    console.error("Failed to create document download link", error);
    return NextResponse.json(
      { error: "We couldn't fetch the document right now. Please try again shortly." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(download.downloadUrl, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

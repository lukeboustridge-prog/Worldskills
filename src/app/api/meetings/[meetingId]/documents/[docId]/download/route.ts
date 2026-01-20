import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewSkill } from "@/lib/permissions";
import { createPresignedDownload, StorageConfigurationError } from "@/lib/storage/client";
import { normaliseFileName } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOWNLOAD_TTL_SECONDS = Number(process.env.FILE_DOWNLOAD_TTL_SECONDS ?? 120);

interface MeetingDocument {
  id: string;
  fileName: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

function normaliseMeetingDocuments(value: unknown): MeetingDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : null;
      const fileName = typeof record.fileName === "string" ? record.fileName : null;
      const storageKey = typeof record.storageKey === "string" ? record.storageKey : null;
      const fileSize = typeof record.fileSize === "number" ? record.fileSize : 0;
      const mimeType = typeof record.mimeType === "string" ? record.mimeType : "application/octet-stream";
      const uploadedAt = typeof record.uploadedAt === "string" ? record.uploadedAt : new Date().toISOString();

      if (!id || !fileName || !storageKey) {
        return null;
      }

      return { id, fileName, storageKey, fileSize, mimeType, uploadedAt };
    })
    .filter((item): item is MeetingDocument => item !== null);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { meetingId: string; docId: string } }
) {
  const user = await requireUser();

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId },
    select: {
      id: true,
      title: true,
      skillId: true,
      documents: true,
      skill: {
        select: {
          saId: true,
          scmId: true,
        },
      },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  if (!canViewSkill(user, { saId: meeting.skill.saId, scmId: meeting.skill.scmId })) {
    return NextResponse.json({ error: "You do not have access to this document." }, { status: 403 });
  }

  const documents = normaliseMeetingDocuments(meeting.documents);
  const document = documents.find((doc) => doc.id === params.docId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const fileName = normaliseFileName(document.fileName || meeting.title);

  let download;
  try {
    download = await createPresignedDownload({
      key: document.storageKey,
      expiresIn: DOWNLOAD_TTL_SECONDS,
      fileName,
    });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      console.error("Document storage is not configured", error);
      return NextResponse.json(
        {
          error:
            "Document storage is not configured yet. Please contact the administrator to enable downloads.",
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
      "Cache-Control": "no-store",
    },
  });
}

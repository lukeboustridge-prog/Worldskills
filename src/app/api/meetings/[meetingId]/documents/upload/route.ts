import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSkill } from "@/lib/permissions";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  validateDocumentEvidenceInput,
} from "@/lib/deliverables";
import { normaliseFileName } from "@/lib/utils";
import { getStorageEnv } from "@/lib/env";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

function buildStorageKey(params: { meetingId: string; skillId: string; filename: string }) {
  const safeName = normaliseFileName(params.filename);
  const slug = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  return `meetings/${params.skillId}/${params.meetingId}/${slug}-${safeName}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    const form = await req.formData();

    const skillId = form.get("skillId")?.toString() ?? "";
    const file = form.get("file") as File | null;

    if (!skillId || !file) {
      return NextResponse.json(
        { error: "bad_request", message: "Skill and file are required." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const user = await requireUser();

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.meetingId },
      select: {
        id: true,
        skillId: true,
        skill: {
          select: {
            saId: true,
            scmId: true,
            teamMembers: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: "not_found", message: "Meeting not found." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    if (meeting.skillId !== skillId) {
      return NextResponse.json(
        { error: "bad_request", message: "Meeting does not belong to the requested skill." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (
      !canManageSkill(user, {
        saId: meeting.skill.saId,
        scmId: meeting.skill.scmId,
        teamMemberIds: meeting.skill.teamMembers.map((member) => member.userId),
      })
    ) {
      return NextResponse.json(
        { error: "forbidden", message: "You do not have permission to upload for this skill." },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    if (buf.byteLength > DOCUMENT_MAX_BYTES) {
      return NextResponse.json(
        {
          error: "file_too_large",
          message: `File is too large. Max allowed is ${DOCUMENT_MAX_BYTES} bytes.`,
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    try {
      validateDocumentEvidenceInput({
        mimeType: file.type,
        fileSize: buf.byteLength,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "File type not supported.";
      return NextResponse.json(
        {
          error: "validation_error",
          message,
          allowedMimeTypes: DOCUMENT_MIME_TYPES,
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    let storage;
    try {
      storage = getStorageEnv();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Storage configuration is missing.";
      return NextResponse.json(
        {
          error: "storage_not_configured",
          message,
        },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    const key = buildStorageKey({
      meetingId: params.meetingId,
      skillId,
      filename: file.name,
    });

    const client = new S3Client({
      region: storage.region,
      endpoint: storage.endpoint,
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
    });

    const put = new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: buf,
      ContentType: file.type || "application/octet-stream",
    });

    await client.send(put);

    return NextResponse.json(
      {
        key,
        fileName: file.name,
        fileSize: buf.byteLength,
        mimeType: file.type || "application/octet-stream",
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (err: unknown) {
    console.error("[meetings/documents/upload] failed", err);
    const message = err instanceof Error ? err.message : "Upload failed on the server.";
    return NextResponse.json(
      {
        error: "upload_failed",
        message,
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import { getCurrentUser } from "@/lib/auth";
import { getStorageEnv, getFileUploadPolicy } from "@/lib/env";
import { normaliseFileName } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

function buildStorageKey(params: { skillId: string; userId: string; filename: string }) {
  const safeName = normaliseFileName(params.filename);
  const timestamp = Date.now();
  const slug = randomUUID().slice(0, 8);
  return `messages/${params.skillId}/${params.userId}/${timestamp}-${slug}-${safeName}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "unauthorized", message: "You must be logged in to upload attachments." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const skillId = form.get("skillId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "bad_request", message: "File is required." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!skillId) {
      return NextResponse.json(
        { error: "bad_request", message: "Skill ID is required." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    const policy = getFileUploadPolicy();

    if (buf.byteLength > policy.maxBytes) {
      return NextResponse.json(
        {
          error: "file_too_large",
          message: `File is too large. Maximum allowed is ${Math.round(policy.maxBytes / 1024 / 1024)}MB.`,
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!policy.allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: "invalid_file_type",
          message: "File type not supported. Upload a PDF, Word, Excel, CSV, or image file.",
          allowedMimeTypes: policy.allowedMimeTypes,
        },
        { status: 400, headers: NO_STORE_HEADERS }
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
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const key = buildStorageKey({
      skillId,
      userId: user.id,
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
        storageKey: key,
        fileName: file.name,
        fileSize: buf.byteLength,
        mimeType: file.type || "application/octet-stream",
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    console.error("[messages/attachments/upload] failed", err);
    const message = err instanceof Error ? err.message : "Upload failed on the server.";
    return NextResponse.json(
      {
        error: "upload_failed",
        message,
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

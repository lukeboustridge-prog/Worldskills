import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { attachmentId: string } }
) {
  try {
    const user = await requireUser();

    const attachment = await prisma.emailAttachment.findUnique({
      where: { id: params.attachmentId },
      include: {
        email: {
          include: {
            recipients: true,
          },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "not_found", message: "Attachment not found." },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    // Access check: user must be sender or recipient
    const isSender = attachment.email.senderId === user.id;
    const isRecipient = attachment.email.recipients.some(
      (r) => r.userId === user.id || r.recipientEmail === user.email
    );

    if (!isSender && !isRecipient && !user.isAdmin) {
      return NextResponse.json(
        { error: "forbidden", message: "You do not have permission to access this attachment." },
        { status: 403, headers: NO_STORE_HEADERS }
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

    const client = new S3Client({
      region: storage.region,
      endpoint: storage.endpoint,
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
    });

    const command = new GetObjectCommand({
      Bucket: storage.bucket,
      Key: attachment.storageKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
    });

    // Generate presigned URL valid for 5 minutes
    const url = await getSignedUrl(client, command, { expiresIn: 300 });

    return NextResponse.json(
      {
        url,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    console.error("[emails/attachments/download] failed", err);
    const message = err instanceof Error ? err.message : "Failed to get download URL.";
    return NextResponse.json(
      {
        error: "download_failed",
        message,
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

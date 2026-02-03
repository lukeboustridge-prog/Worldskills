import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageEnv } from "@/lib/env";
import { Role } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { attachmentId: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attachment = await prisma.messageAttachment.findUnique({
      where: { id: params.attachmentId },
      include: {
        message: {
          include: {
            skill: {
              include: {
                teamMembers: { select: { userId: true } },
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this skill's messages
    const skill = attachment.message.skill;
    const teamMemberIds = skill.teamMembers.map((m) => m.userId);
    const hasAccess =
      user.isAdmin ||
      user.role === Role.Secretariat ||
      user.id === skill.saId ||
      user.id === skill.scmId ||
      teamMemberIds.includes(user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You do not have access to this attachment" },
        { status: 403 }
      );
    }

    const storage = getStorageEnv();

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
      ResponseContentDisposition: `attachment; filename="${attachment.fileName}"`,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Message attachment download error:", error);
    return NextResponse.json(
      { error: "Failed to get download URL" },
      { status: 500 }
    );
  }
}

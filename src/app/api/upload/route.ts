import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fileEntry = form.get("file");

  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json({ error: "File upload payload missing" }, { status: 400 });
  }

  const file = fileEntry as File;
  const buf = Buffer.from(await file.arrayBuffer());
  const key = `${Date.now()}-${file.name}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: buf,
      ContentType: file.type,
    })
  );

  return NextResponse.json({
    key,
    url: `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET}/${key}`,
  });
}

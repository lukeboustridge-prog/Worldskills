import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/uploadToR2";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fileEntry = form.get("file");

  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json({ error: "File upload payload missing" }, { status: 400 });
  }

  const file = fileEntry as File;
  const buf = Buffer.from(await file.arrayBuffer());
  const result = await uploadToR2(file.name, buf, file.type);

  return NextResponse.json(result);
}

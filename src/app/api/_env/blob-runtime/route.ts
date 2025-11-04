import { NextResponse } from "next/server";

import { probeBlobUploadHelper } from "@/lib/storage/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
};

export async function GET() {
  const env = process.env.VERCEL_ENV ?? "local";
  const probe = await probeBlobUploadHelper();

  return NextResponse.json(
    {
      env,
      runtime,
      hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
      canUseBlobHelper: probe.ok,
      time: new Date().toISOString()
    },
    {
      headers: {
        "Content-Type": "application/json",
        ...NO_STORE_HEADERS
      }
    }
  );
}

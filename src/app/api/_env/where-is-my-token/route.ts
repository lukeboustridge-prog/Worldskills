import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
};

function readEnv(key: string, fallback: string) {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
}

export async function GET() {
  const payload = {
    env: readEnv("VERCEL_ENV", "local"),
    nodeEnv: readEnv("NODE_ENV", "unknown"),
    runtime,
    hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
    hasNextPublicBlob: Boolean(process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN?.trim()),
    vercelUrl: process.env.VERCEL_URL?.trim() ?? null,
    buildId: process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? null,
    time: new Date().toISOString()
  };

  return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
}

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
    hasStorageBucket: Boolean(process.env.FILE_STORAGE_BUCKET?.trim()),
    hasStorageAccessKey: Boolean(process.env.FILE_STORAGE_ACCESS_KEY_ID?.trim()),
    hasStorageSecret: Boolean(process.env.FILE_STORAGE_SECRET_ACCESS_KEY?.trim()),
    vercelUrl: process.env.VERCEL_URL?.trim() ?? null,
    buildId: process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? null,
    time: new Date().toISOString()
  };

  return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
}

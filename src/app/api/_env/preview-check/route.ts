import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getEnvironmentName() {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV;
  }
  return "local";
}

export async function GET() {
  const environmentName = getEnvironmentName();
  if (environmentName === "production" || process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const payload: {
    env: string;
    runtime: "node";
    hasStorageBucket: boolean;
    hasStorageAccessKey: boolean;
    hasStorageSecret: boolean;
    projectProductionUrl?: string;
    deploymentUrl?: string;
  } = {
    env: environmentName,
    runtime: "node",
    hasStorageBucket: Boolean(process.env.FILE_STORAGE_BUCKET),
    hasStorageAccessKey: Boolean(process.env.FILE_STORAGE_ACCESS_KEY_ID),
    hasStorageSecret: Boolean(process.env.FILE_STORAGE_SECRET_ACCESS_KEY)
  };

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    payload.projectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  }

  if (process.env.VERCEL_URL) {
    payload.deploymentUrl = process.env.VERCEL_URL;
  }

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

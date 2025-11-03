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
    hasBlobToken: boolean;
    hasNextPublicBlob: boolean;
    projectProductionUrl?: string;
    deploymentUrl?: string;
  } = {
    env: environmentName,
    runtime: "node",
    hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasNextPublicBlob: Boolean(process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN)
  };

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    payload.projectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  }

  if (process.env.VERCEL_URL) {
    payload.deploymentUrl = process.env.VERCEL_URL;
  }

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

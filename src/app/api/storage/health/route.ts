import { NextResponse } from "next/server";

import { getStorageDiagnostics } from "@/lib/env";
import type {
  StorageHealthDiagnostic,
  StorageHealthResponse
} from "@/lib/storage/diagnostics";
import { verifyBlobAccess } from "@/lib/storage/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
  Pragma: "no-cache",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
};

function getEnvironmentName() {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV;
  }
  return "local";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeDetails = url.searchParams.get("details") === "1";
    const diagnostics = getStorageDiagnostics();

    // The health endpoint favours Vercel Blob whenever a token is present.
    // If the blob token verifies we report ready regardless of S3 credentials;
    // otherwise we fall back to the legacy S3 checks so existing deployments
    // keep working without Blob.
    const blobVerification = await verifyBlobAccess();

    const environmentName = getEnvironmentName();
    const includeEnvironment = environmentName !== "production";

    let diagnosticCode: StorageHealthDiagnostic;
    let body: StorageHealthResponse;

    if (blobVerification.status === "verified") {
      diagnosticCode = "blob_verified";
      body = { ok: true, provider: "vercel-blob" };
    } else if (blobVerification.status === "error") {
      diagnosticCode = "blob_unreachable";
      console.warn("Vercel Blob token could not be verified", blobVerification.message);
      body = { ok: false, reason: "blob_unreachable", provider: "vercel-blob" };
    } else {
      diagnosticCode = "missing_blob_token";
      if (diagnostics.ok) {
        body = { ok: true, provider: diagnostics.provider };
      } else {
        if (diagnostics.missing.length > 0) {
          console.info("Document storage missing environment keys", diagnostics.missing);
        }
        body = {
          ok: false,
          reason: "missing_blob_token",
          provider: diagnostics.provider
        };
      }
    }

    if (includeEnvironment) {
      body.env = environmentName;
      body.runtime = runtime;
      body.diagnostic = diagnosticCode;
      body.source = "storage/health";
    }

    if (includeDetails) {
      const { ok: _ok, ...details } = diagnostics;
      body.details = { ...details, checkedAt: new Date().toISOString() };
    }

    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Unexpected storage health failure", error);
    const environmentName = getEnvironmentName();
    const includeEnvironment = environmentName !== "production";
    const payload: StorageHealthResponse = { ok: false, reason: "error" };
    if (includeEnvironment) {
      payload.env = environmentName;
      payload.runtime = runtime;
      payload.diagnostic = "exception";
      payload.source = "storage/health";
    }
    return NextResponse.json(payload, { status: 500, headers: NO_STORE_HEADERS });
  }
}

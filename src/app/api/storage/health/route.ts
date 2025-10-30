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

    const environmentName = getEnvironmentName();
    const includeEnvironment = environmentName !== "production";

    let diagnosticCode: StorageHealthDiagnostic | undefined;
    if (includeEnvironment) {
      const verification = await verifyBlobAccess();
      switch (verification.status) {
        case "verified":
          diagnosticCode = "blob_verified";
          break;
        case "error":
          diagnosticCode = "blob_unreachable";
          console.warn("Vercel Blob token could not be verified", verification.message);
          break;
        case "missing_token":
        default:
          diagnosticCode = "missing_blob_token";
          break;
      }
    }

    if (!diagnostics.ok) {
      if (diagnostics.missing.length > 0) {
        console.info("Document storage missing environment keys", diagnostics.missing);
      }

      const body: StorageHealthResponse = {
        ok: false,
        reason: "not_configured",
        provider: diagnostics.provider
      };
      if (includeEnvironment) {
        body.env = environmentName;
        body.runtime = runtime;
        if (diagnosticCode) {
          body.diagnostic = diagnosticCode;
        }
      }
      if (includeDetails) {
        const { ok: _ok, ...details } = diagnostics;
        body.details = { ...details, checkedAt: new Date().toISOString() };
      }

      return NextResponse.json(body, { headers: NO_STORE_HEADERS });
    }

    const body: StorageHealthResponse = { ok: true, provider: diagnostics.provider };
    if (includeEnvironment) {
      body.env = environmentName;
      body.runtime = runtime;
      if (diagnosticCode) {
        body.diagnostic = diagnosticCode;
      }
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
    }
    return NextResponse.json(payload, { status: 500, headers: NO_STORE_HEADERS });
  }
}

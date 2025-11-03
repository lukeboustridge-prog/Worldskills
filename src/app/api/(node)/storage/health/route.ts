import { NextResponse } from "next/server";

import { getStorageDiagnostics } from "@/lib/env";
import type {
  StorageHealthDiagnostic,
  StorageHealthReason,
  StorageHealthResponse
} from "@/lib/storage/diagnostics";
import { getStorageMode } from "@/lib/storage/provider";
import type { BlobVerificationError, BlobVerificationResult } from "@/lib/storage/blob";
import { verifyVercelBlobSupport } from "@/lib/storage/blob";

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

type BlobErrorResult = BlobVerificationError;

function mapBlobErrorToReason(result: BlobErrorResult): StorageHealthReason {
  switch (result.code) {
    case "missing_token":
      return "missing_blob_token";
    case "runtime_unavailable":
      return "blob_helper_not_available_in_runtime";
    default:
      return "blob_unreachable";
  }
}

function mapBlobErrorToDiagnostic(result: BlobErrorResult): StorageHealthDiagnostic {
  switch (result.code) {
    case "missing_token":
      return "missing_blob_token";
    case "runtime_unavailable":
      return "blob_helper_runtime";
    default:
      return "blob_unreachable";
  }
}

function mapBlobErrorToFallbackNote(result: BlobErrorResult): string | undefined {
  switch (result.code) {
    case "runtime_unavailable":
      return "blob_runtime_unavailable_fell_back_to_s3";
    case "other":
      return "blob_unreachable_fell_back_to_s3";
    default:
      return undefined;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeDetails = url.searchParams.get("details") === "1";
    const diagnostics = getStorageDiagnostics();
    const mode = getStorageMode();

    const runtimeEnvironment = (process.env.NEXT_RUNTIME ?? "nodejs").toLowerCase();
    const runtimeLabel: "nodejs" | "edge" = runtimeEnvironment === "edge" ? "edge" : "nodejs";

    if (process.env.NODE_ENV !== "production") {
      console.info("[storage/runtime]", {
        nodeEnv: process.env.NODE_ENV ?? "development",
        vercelEnv: process.env.VERCEL_ENV ?? "local",
        runtime: runtimeLabel
      });
    }

    // The health endpoint favours Vercel Blob whenever a token is present.
    // If the blob token verifies we report ready regardless of S3 credentials;
    // otherwise we fall back to the legacy S3 checks so existing deployments
    // keep working without Blob.
    if (runtimeLabel !== "nodejs") {
      const environmentName = getEnvironmentName();
      const includeEnvironment = environmentName !== "production";
      const payload: StorageHealthResponse = {
        ok: false,
        reason: "edge_runtime_inherited",
        provider: diagnostics.provider
      };
      if (includeEnvironment) {
        payload.env = environmentName;
        payload.runtime = runtimeLabel;
        payload.diagnostic = "edge_runtime";
        payload.source = "storage/health";
      }
      return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
    }

    const blobVerification: BlobVerificationResult =
      mode === "s3"
        ? { status: "error", code: "missing_token" }
        : await verifyVercelBlobSupport();

    const environmentName = getEnvironmentName();
    const includeEnvironment = environmentName !== "production";

    let diagnosticCode: StorageHealthDiagnostic;
    let body: StorageHealthResponse;

    if (mode === "s3") {
      if (diagnostics.ok) {
        diagnosticCode = "missing_blob_token";
        body = { ok: true, provider: diagnostics.provider };
      } else {
        if (diagnostics.missing.length > 0) {
          console.info("Document storage missing environment keys", diagnostics.missing);
        }
        diagnosticCode = "missing_blob_token";
        body = {
          ok: false,
          reason: "not_configured",
          provider: diagnostics.provider
        };
      }
    } else if (blobVerification.status === "ok") {
      diagnosticCode = "blob_verified";
      body = { ok: true, provider: "vercel-blob" };
    } else {
      const reason = mapBlobErrorToReason(blobVerification);
      const failureDiagnostic = mapBlobErrorToDiagnostic(blobVerification);

      if (blobVerification.code === "missing_token" && diagnostics.missing.length > 0) {
        console.info("Document storage missing environment keys", diagnostics.missing);
      } else if (blobVerification.code === "runtime_unavailable") {
        console.warn(
          "Vercel Blob helper unavailable in this runtime",
          blobVerification.message ?? "Blob upload helper is unavailable in the current runtime"
        );
      } else if (blobVerification.code === "other") {
        console.warn(
          "Vercel Blob token could not be verified",
          blobVerification.message ?? "Unknown blob verification error"
        );
      }

      if (mode === "blob") {
        diagnosticCode = failureDiagnostic;
        body = {
          ok: false,
          reason,
          provider: "vercel-blob"
        };
      } else if (diagnostics.ok) {
        diagnosticCode =
          blobVerification.code === "runtime_unavailable"
            ? "blob_runtime_fallback"
            : blobVerification.code === "missing_token"
            ? "missing_blob_token"
            : "blob_unreachable";

        body = {
          ok: true,
          provider: diagnostics.provider
        };

        const note = mapBlobErrorToFallbackNote(blobVerification);
        if (note) {
          body.note = note;
        }
      } else {
        diagnosticCode = failureDiagnostic;
        body = {
          ok: false,
          reason,
          provider: "vercel-blob"
        };
      }
    }

    if (includeEnvironment) {
      body.env = environmentName;
      body.runtime = runtimeLabel;
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
      payload.runtime = (process.env.NEXT_RUNTIME ?? "nodejs").toLowerCase() === "edge" ? "edge" : "nodejs";
      payload.diagnostic = "exception";
      payload.source = "storage/health";
    }
    return NextResponse.json(payload, { status: 500, headers: NO_STORE_HEADERS });
  }
}

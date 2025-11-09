import { NextResponse } from "next/server";

import { getStorageDiagnostics } from "@/lib/env";
import type {
  StorageHealthDiagnostic,
  StorageHealthReason,
  StorageHealthResponse
} from "@/lib/storage/diagnostics";

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

    const runtimeEnvironment = (process.env.NEXT_RUNTIME ?? "nodejs").toLowerCase();
    const runtimeLabel: "nodejs" | "edge" = runtimeEnvironment === "edge" ? "edge" : "nodejs";

    if (process.env.NODE_ENV !== "production") {
      console.info("[storage/runtime]", {
        nodeEnv: process.env.NODE_ENV ?? "development",
        vercelEnv: process.env.VERCEL_ENV ?? "local",
        runtime: runtimeLabel
      });
    }

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

    const environmentName = getEnvironmentName();
    const includeEnvironment = environmentName !== "production";

    let diagnosticCode: StorageHealthDiagnostic;
    let body: StorageHealthResponse;

    if (!diagnostics.ok) {
      if (diagnostics.missing.length > 0) {
        console.info("Document storage missing environment keys", diagnostics.missing);
      }

      diagnosticCode = "not_configured";
      body = {
        ok: false,
        reason: "not_configured",
        provider: diagnostics.provider
      };
    } else {
      diagnosticCode = "configured";
      body = { ok: true, provider: diagnostics.provider };
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

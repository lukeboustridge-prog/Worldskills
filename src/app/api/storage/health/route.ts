import { NextResponse } from "next/server";

import { getStorageDiagnostics } from "@/lib/env";
import type { StorageHealthResponse } from "@/lib/storage/diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      }
      if (includeDetails) {
        const { ok: _ok, ...details } = diagnostics;
        body.details = { ...details, checkedAt: new Date().toISOString() };
      }

      return NextResponse.json(body);
    }

    const body: StorageHealthResponse = { ok: true, provider: diagnostics.provider };
    if (includeEnvironment) {
      body.env = environmentName;
    }
    if (includeDetails) {
      const { ok: _ok, ...details } = diagnostics;
      body.details = { ...details, checkedAt: new Date().toISOString() };
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("Unexpected storage health failure", error);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}

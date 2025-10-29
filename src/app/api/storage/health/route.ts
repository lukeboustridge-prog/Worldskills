import { NextResponse } from "next/server";

import { getStorageDiagnostics } from "@/lib/env";
import type { StorageHealthResponse } from "@/lib/storage/diagnostics";

export async function GET(request?: Request) {
  try {
    const url = new URL(request?.url ?? "http://localhost/api/storage/health");
    const includeDetails = url.searchParams.get("details") === "1";
    const diagnostics = getStorageDiagnostics();

    if (!diagnostics.ok) {
      if (diagnostics.missing.length > 0) {
        console.info("Document storage missing environment keys", diagnostics.missing);
      }

      const body: StorageHealthResponse = { ok: false, reason: "not_configured" };
      if (includeDetails) {
        const { ok: _ok, ...details } = diagnostics;
        body.details = { ...details, checkedAt: new Date().toISOString() };
      }

      return NextResponse.json(body);
    }

    const body: StorageHealthResponse = { ok: true };
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

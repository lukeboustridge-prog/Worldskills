import { NextResponse } from "next/server";

import { getStorageEnv, StorageConfigurationError } from "@/lib/env";

export async function GET() {
  try {
    getStorageEnv();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, reason: "not_configured" });
    }

    console.error("Unexpected storage health failure", error);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}

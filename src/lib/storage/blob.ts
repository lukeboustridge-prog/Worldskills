import { list } from "@vercel/blob";

import { probeBlobUploadHelper } from "./client";

export type BlobVerificationResult =
  | { status: "ok"; provider: "vercel-blob" }
  | { status: "error"; code: "runtime_unavailable" | "missing_token" | "other"; message?: string };

export async function verifyVercelBlobSupport(): Promise<BlobVerificationResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    return { status: "error", code: "missing_token" };
  }

  try {
    await attemptMinimalBlobOp(token);
    return { status: "ok", provider: "vercel-blob" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown blob verification error";
    const normalised = message.toLowerCase();

    let code: BlobVerificationResult["code"] = "other";
    if (
      normalised.includes("unavailable in the current runtime") ||
      normalised.includes("blob upload helper is unavailable")
    ) {
      code = "runtime_unavailable";
    }

    return { status: "error", code, message };
  }
}

async function attemptMinimalBlobOp(token: string) {
  const helperProbe = await probeBlobUploadHelper();

  if (!helperProbe.ok) {
    throw helperProbe.error ?? new Error("Blob upload helper is unavailable in the current runtime");
  }

  await list({ token, limit: 1 });
}

// Backwards compatibility for existing imports that still reference verifyBlobAccess.
export const verifyBlobAccess = verifyVercelBlobSupport;

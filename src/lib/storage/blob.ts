import { list } from "@vercel/blob";

import { probeBlobUploadHelper } from "./client";

export type BlobVerificationStatus =
  | { status: "missing_token" }
  | { status: "verified" }
  | { status: "error"; message: string };

export async function verifyBlobAccess(): Promise<BlobVerificationStatus> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    return { status: "missing_token" };
  }

  try {
    const helperProbe = await probeBlobUploadHelper();

    if (!helperProbe.ok) {
      const message =
        helperProbe.error instanceof Error
          ? helperProbe.error.message
          : "Blob upload helper is unavailable";
      return { status: "error", message };
    }

    await list({ token, limit: 1 });
    return { status: "verified" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error verifying Vercel Blob access";
    return { status: "error", message };
  }
}

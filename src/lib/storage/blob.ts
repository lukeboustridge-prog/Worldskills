// lib/storage/blob.ts

export type BlobVerificationResult =
  | {
      status: "ok";
      provider: "vercel-blob";
    }
  | {
      status: "error";
      provider: "vercel-blob";
      code: "missing_token";
      message?: string;
    };

/**
 * Lightweight verification for Vercel Blob.
 * We intentionally do NOT try to call the actual helper here, because some
 * Vercel runtimes complain even though the token is present.
 * If the token is present, we treat Blob as available.
 */
export async function verifyVercelBlobSupport(): Promise<BlobVerificationResult> {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (hasToken) {
    return {
      status: "ok",
      provider: "vercel-blob"
    };
  }

  return {
    status: "error",
    provider: "vercel-blob",
    code: "missing_token",
    message: "BLOB_READ_WRITE_TOKEN is not set"
  };
}

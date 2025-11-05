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

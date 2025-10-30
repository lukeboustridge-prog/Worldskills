import { createClient } from "@vercel/blob";

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
    const client = createClient({ token });
    await client.list({ limit: 1 });
    return { status: "verified" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error verifying Vercel Blob access";
    return { status: "error", message };
  }
}

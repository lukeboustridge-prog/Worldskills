import { PutObjectCommand } from "@aws-sdk/client-s3";

import { BUCKET, r2 } from "./r2";

export async function uploadToR2(
  filename: string,
  body: Buffer | Uint8Array,
  contentType?: string
) {
  const key = `${Date.now()}-${filename}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );

  return {
    key,
    url: `${process.env.R2_ENDPOINT}/${BUCKET}/${key}`,
  };
}

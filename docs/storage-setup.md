# Document storage configuration

The document evidence uploader relies on an S3-compatible bucket. Configure the following environment variables in Vercel (and `.env.local` for local development) before enabling uploads.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `FILE_STORAGE_BUCKET` | ✅ | Name of the bucket that will store document evidence. |
| `FILE_STORAGE_REGION` | ✅ | AWS region (or provider region) where the bucket lives. |
| `FILE_STORAGE_ACCESS_KEY_ID` | ✅ | Access key with permission to write to the bucket. |
| `FILE_STORAGE_SECRET_ACCESS_KEY` | ✅ | Secret for the access key. |
| `FILE_STORAGE_ENDPOINT` | ⬜️ | Custom endpoint for S3-compatible providers (MinIO, Cloudflare R2, Supabase, etc.). Leave unset for AWS. |
| `FILE_STORAGE_FORCE_PATH_STYLE` | ⬜️ | Set to `true` when the provider requires path-style URLs. |
| `FILE_MAX_MB` | ⬜️ | Maximum upload size in megabytes (defaults to `25`). |
| `FILE_ALLOWED_MIME` | ⬜️ | Comma-separated list of allowed MIME types (defaults to `application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/jpeg,image/png`). |

If you are using [Vercel Blob](https://vercel.com/docs/storage/vercel-blob), set `BLOB_READ_WRITE_TOKEN` (and optionally `NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN` for client-side uploads). When these tokens are present the application will ignore the S3-specific keys above because Blob manages the backing bucket automatically.

The `/api/storage/health` endpoint checks the configuration. The upload UI only enables the dropzone when this route returns `{ ok: true }`.

## Minimum AWS IAM policy

Grant the application credentials least-privilege access to the bucket. Replace `<bucket-name>` with your bucket and update the prefix if you change the key layout.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::<bucket-name>/deliverables/*"
    }
  ]
}
```

## S3 CORS configuration

Allow the app origin to perform presigned uploads. Update `https://worldskillsskilladvisors.vercel.app` to match your production domain and add any local origins needed for development.

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://worldskillsskilladvisors.vercel.app</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>300</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

## Vercel setup checklist

1. Open your project in the Vercel dashboard.
2. Navigate to **Settings → Environment Variables**.
3. Add the required keys (`FILE_STORAGE_BUCKET`, `FILE_STORAGE_REGION`, `FILE_STORAGE_ACCESS_KEY_ID`, `FILE_STORAGE_SECRET_ACCESS_KEY`).
4. Add optional overrides (`FILE_STORAGE_ENDPOINT`, `FILE_STORAGE_FORCE_PATH_STYLE`, `FILE_MAX_MB`, `FILE_ALLOWED_MIME`) if you need them.
5. Redeploy the project so the new variables are available.
6. Verify the configuration by visiting `/api/storage/health`; the response should be `{ "ok": true }` and include `runtime: "nodejs"` and `diagnostic: "blob_verified"` in Preview/Development builds when Vercel Blob is in use.

Once these values are present, document uploads, downloads, and bulk validations will work across the application.

## Debugging tips

- Administrators can review the live configuration at `/storage-debug`, which calls the same health endpoint used by the uploader
  and highlights any missing environment variables.
- Hit `/api/_env/where-is-my-token` on any deployment to confirm the Blob token is visible to that environment. The JSON payload
  is cache-busted so you can refresh after updating variables.
- Set `NEXT_PUBLIC_DEBUG_STORAGE=true` in local development to surface additional console logs and inline diagnostics while
  testing the deliverable uploader.

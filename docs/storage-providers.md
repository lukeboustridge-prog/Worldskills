# Storage provider selection

The document uploader now exclusively targets an S3-compatible bucket (Cloudflare R2 in production). The `STORAGE_PROVIDER` environment variable lets you force the behaviour when testing different environments.

| Value | Behaviour |
| --- | --- |
| `auto` (default) | Use the configured S3 credentials. |
| `s3` | Explicitly require the S3 configuration. |

When running on Vercel you may need to set `STORAGE_PROVIDER=s3` temporarily if your project forces API routes to the Edge runtime.

# Storage provider selection

The document uploader can talk to either Vercel Blob or an S3-compatible bucket. By default the application auto-detects what is
available, but you can override this behaviour with the `STORAGE_PROVIDER` environment variable.

| Value | Behaviour |
| --- | --- |
| `auto` (default) | Attempt to use Vercel Blob when a `BLOB_READ_WRITE_TOKEN` is present. If the Blob helper is unavailable in the current runtime, the app automatically falls back to the S3 configuration. |
| `blob` | Require Vercel Blob. Uploads fail when the Blob helper is not available or the token is missing. |
| `s3` | Always use the S3 configuration and ignore Blob tokens, even if they are set. |

When running on Vercel you may need to set `STORAGE_PROVIDER=s3` temporarily if your project forces API routes to the Edge runtime.
Once Node.js runtimes are available, switch back to `auto` so previews can use Vercel Blob automatically.

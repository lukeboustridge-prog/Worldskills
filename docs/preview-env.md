# Preview environment storage diagnostics

When document storage credentials are updated in Vercel you must ensure the Preview environment receives the same values. Use the helpers below to confirm the configuration.

## Required variables

| Key | Scope | Description |
| --- | --- | --- |
| `FILE_STORAGE_BUCKET` | Preview & Production | S3 bucket name used for evidence uploads |
| `FILE_STORAGE_REGION` | Preview & Production | S3 region |
| `FILE_STORAGE_ACCESS_KEY_ID` | Preview & Production | Access key allowed to put/get objects |
| `FILE_STORAGE_SECRET_ACCESS_KEY` | Preview & Production | Secret key paired with the access key |
| `FILE_STORAGE_ENDPOINT` | Optional | Custom S3 endpoint (R2/MinIO/Supabase) |
| `FILE_STORAGE_FORCE_PATH_STYLE` | Optional | Set to `true` for path-style S3 endpoints |

## Update steps

1. In Vercel, open **Settings → Environment Variables** for the project that hosts `worldskillsskilladvisors`.
2. Add or update each key above for the **Preview** environment (duplicate Production values if necessary).
3. Trigger a new Preview deployment (push a commit or use “Redeploy with latest code”). The new build will pick up the refreshed variables.

## Verify the deployment

1. Load the Preview URL and open `https://<preview-domain>/api/storage/health?details=1`.
   - The response should include `{ "ok": true, "diagnostic": "configured" }` along with the active provider (for R2 it should report `cloudflare-r2`).
2. (Optional) `https://<preview-domain>/api/_env/preview-check` remains available for local debugging; it returns similar information but is hidden in production.
3. If values are still missing, confirm you are looking at the correct Vercel project and that the Preview redeploy completed after the variables were saved.

## Runtime note

The storage endpoints run in the **Node.js runtime**, which guarantees access to the S3-compatible credentials used for R2 uploads. No Edge configuration is required.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const body = {
    env: process.env.VERCEL_ENV || "local",
    nodeEnv: process.env.NODE_ENV || "unknown",
    runtime: "nodejs" as const,
    hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasNextPublicBlob: Boolean(process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN),
    vercelUrl: process.env.VERCEL_URL || null,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    time: new Date().toISOString()
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store"
    }
  });
}

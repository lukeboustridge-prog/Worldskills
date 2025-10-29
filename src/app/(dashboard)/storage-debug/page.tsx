import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getStorageDiagnostics } from "@/lib/env";

import { StorageDebugPanel } from "./storage-debug-panel";

export const metadata = {
  title: "Storage debug"
};

export default async function StorageDebugPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.isAdmin) {
    redirect("/dashboard");
  }

  const diagnostics = getStorageDiagnostics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storage diagnostics</h1>
        <p className="text-sm text-muted-foreground">
          Verify the S3-compatible configuration used for document evidence uploads. Only administrators can view this page.
        </p>
      </div>

      <StorageDebugPanel initialDiagnostics={diagnostics} />

      <Card>
        <CardHeader>
          <CardTitle>Runbook quick reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Ensure the following environment variables are set in Vercel (or your local <code>.env.local</code>) for successful uploads:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code>FILE_STORAGE_BUCKET</code>
            </li>
            <li>
              <code>FILE_STORAGE_REGION</code>
            </li>
            <li>
              <code>FILE_STORAGE_ACCESS_KEY_ID</code>
            </li>
            <li>
              <code>FILE_STORAGE_SECRET_ACCESS_KEY</code>
            </li>
            <li>
              Optional overrides: <code>FILE_STORAGE_ENDPOINT</code>, <code>FILE_STORAGE_FORCE_PATH_STYLE</code>
            </li>
          </ul>
          <p>
            After updating the variables, redeploy the application and use the “Recheck storage health” button above to confirm the configuration.
          </p>
          <p>
            For full setup steps and IAM/CORS examples see <code>docs/storage-setup.md</code> in the repository.
          </p>
          <div>
            <Button asChild variant="link" className="px-0 text-primary">
              <a href="/api/storage/health?details=1" target="_blank" rel="noreferrer">
                View raw health payload
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

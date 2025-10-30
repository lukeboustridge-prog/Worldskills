"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StorageDiagnosticsSnapshot, StorageHealthResponse } from "@/lib/storage/diagnostics";

interface StorageDebugPanelProps {
  initialDiagnostics: StorageDiagnosticsSnapshot;
}

function formatProvider(provider: StorageDiagnosticsSnapshot["provider"]) {
  switch (provider) {
    case "aws-s3":
      return "AWS S3";
    case "cloudflare-r2":
      return "Cloudflare R2";
    case "minio":
      return "MinIO";
    case "supabase":
      return "Supabase Storage";
    case "vercel-blob":
      return "Vercel Blob";
    case "custom":
      return "Custom endpoint";
    default:
      return "Unknown";
  }
}

export function StorageDebugPanel({ initialDiagnostics }: StorageDebugPanelProps) {
  const [diagnostics, setDiagnostics] = useState<StorageDiagnosticsSnapshot>(initialDiagnostics);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<StorageHealthResponse | null>(null);

  const statusLabel = diagnostics.ok
    ? "Ready"
    : diagnostics.missing.length > 0
      ? "Not configured"
      : "Unknown";
  const statusClass = diagnostics.ok
    ? "text-emerald-600"
    : diagnostics.missing.length > 0
      ? "text-amber-600"
      : "text-destructive";

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/storage/health?details=1", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Health request failed with status ${response.status}`);
      }
      const payload: StorageHealthResponse = await response.json();
      setLastPayload(payload);
      if (!payload.details) {
        throw new Error("Health response was missing diagnostics details.");
      }
      setDiagnostics({ ...payload.details, ok: payload.ok });
      setLastCheckedAt(payload.details.checkedAt ?? new Date().toISOString());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown error while checking storage health.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runCheck().catch(() => {
      // Errors are surfaced through state; no additional handling required here.
    });
  }, [runCheck]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Storage health</CardTitle>
          <p className={`text-sm font-medium ${statusClass}`}>{statusLabel}</p>
          <p className="text-xs text-muted-foreground">
            {lastCheckedAt ? `Last checked ${new Date(lastCheckedAt).toLocaleString()}` : "Waiting for health check…"}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={runCheck} disabled={loading} className="mt-2 sm:mt-0">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…
            </span>
          ) : (
            "Recheck storage health"
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Bucket</p>
            <p className="text-sm font-medium text-foreground">{diagnostics.bucket ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Region</p>
            <p className="text-sm font-medium text-foreground">{diagnostics.region ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Provider</p>
            <p className="text-sm font-medium text-foreground">{formatProvider(diagnostics.provider)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Path style</p>
            <p className="text-sm font-medium text-foreground">
              {diagnostics.forcePathStyle ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Blob token</p>
            <p className="text-sm font-medium text-foreground">
              {diagnostics.blobTokenPresent ? "Present" : "Missing"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">NEXT_PUBLIC blob token</p>
            <p className="text-sm font-medium text-foreground">
              {diagnostics.nextPublicBlobTokenPresent ? "Present" : "Missing"}
            </p>
          </div>
        </div>

        {diagnostics.endpoint ? (
          <p className="text-xs text-muted-foreground">Endpoint: {diagnostics.endpoint}</p>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Required environment keys</p>
          <ul className="space-y-2">
            {diagnostics.requirements.map((requirement) => (
              <li
                key={requirement.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{requirement.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {requirement.present
                      ? `Resolved via ${requirement.resolvedKey}`
                      : `Checks: ${requirement.keys.join(", ")}`}
                  </p>
                </div>
                <Badge
                  variant={requirement.present ? "outline" : "destructive"}
                  className={
                    requirement.present
                      ? "border-emerald-200 bg-emerald-500/10 text-emerald-600"
                      : "border-destructive/40 bg-destructive/10 text-destructive"
                  }
                >
                  {requirement.present ? "Present" : "Missing"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>

        {lastPayload ? (
          <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 p-3 text-xs text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">Last payload</p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
              {JSON.stringify(lastPayload, null, 2)}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

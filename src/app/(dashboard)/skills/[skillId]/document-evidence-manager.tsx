"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Eye, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  DeliverableEvidenceDocument,
  formatFileSize,
  isRetryableDocumentUploadError
} from "@/lib/deliverables";
import type { StorageHealthResponse } from "@/lib/storage/diagnostics";

interface DocumentEvidenceManagerProps {
  deliverableId: string;
  skillId: string;
  evidence: DeliverableEvidenceDocument | null;
  canEdit: boolean;
  showUploader: boolean;
}

const MIME_EXTENSION_FALLBACKS: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png"
};

const NOT_CONFIGURED_MESSAGE =
  "Document storage is not configured yet. Please contact the administrator to enable uploads.";

const UNREACHABLE_MESSAGE =
  "We couldn't confirm document storage is available right now. Try again later or contact the administrator.";

const RUNTIME_UNAVAILABLE_MESSAGE =
  "Document uploads are disabled in this deployment environment. Redeploy the app with the Node.js runtime or contact the administrator.";

type StorageHealthSnapshot = {
  payload: StorageHealthResponse;
  receivedAt: number;
};

const STORAGE_DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG_STORAGE === "true";
const SHOW_READY_HINT =
  process.env.NODE_ENV !== "production" || STORAGE_DEBUG_ENABLED;
const SHOW_STATUS_DEBUG =
  process.env.NODE_ENV !== "production" || STORAGE_DEBUG_ENABLED;
const SHOW_UPLOAD_DEBUG = process.env.NODE_ENV !== "production";

type UploadDebugInfo = {
  endpoint: string;
  status: number;
  statusText: string;
  body: unknown;
};

async function computeChecksum(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function resolveMimeType(file: File) {
  if (file.type) {
    return file.type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) {
    return "";
  }

  return MIME_EXTENSION_FALLBACKS[extension] ?? "";
}

export function DocumentEvidenceManager({
  deliverableId,
  skillId,
  evidence,
  canEdit,
  showUploader
}: DocumentEvidenceManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingReplaceId = useRef<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "preparing" | "uploading" | "committing">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<"checking" | "ready" | "not-configured" | "error">(
    "checking"
  );
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [lastHealthCheck, setLastHealthCheck] = useState<StorageHealthSnapshot | null>(null);
  const [storageStatusSource, setStorageStatusSource] = useState<"initial" | "health" | "upload">(
    "initial"
  );
  const [uploadDebug, setUploadDebug] = useState<UploadDebugInfo | null>(null);

  const disabled = status !== "idle";
  const hasEvidence = Boolean(evidence);
  const shouldRender = hasEvidence || showUploader || !canEdit;
  const uploadDisabled = disabled || storageStatus !== "ready";

  const resetNotices = () => {
    setError(null);
    setWarning(null);
    setSuccess(null);
    setUploadDebug(null);
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function checkStorage() {
      if (STORAGE_DEBUG_ENABLED) {
        console.info("[storage] Starting document storage health check");
      }
      try {
        const response = await fetch(
          STORAGE_DEBUG_ENABLED ? "/api/storage/health?details=1" : "/api/storage/health",
          { cache: "no-store", signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error("Storage health check failed");
        }

        const payload: StorageHealthResponse = await response.json();
        if (STORAGE_DEBUG_ENABLED) {
          console.info("[storage] Document storage health response", payload);
        }
        if (cancelled) {
          return;
        }

        setLastHealthCheck({ payload, receivedAt: Date.now() });
        setStorageStatusSource("health");

        let nextStatus: typeof storageStatus;
        let nextNotice: string | null = null;

        if (payload.ok) {
          nextStatus = "ready";
        } else {
          switch (payload.reason) {
            case "not_configured":
              nextStatus = "not-configured";
              nextNotice = NOT_CONFIGURED_MESSAGE;
              break;
            case "edge_runtime_inherited":
              nextStatus = "error";
              nextNotice = RUNTIME_UNAVAILABLE_MESSAGE;
              break;
            case "storage_not_available":
            case "error":
            default:
              nextStatus = "error";
              nextNotice = UNREACHABLE_MESSAGE;
              break;
          }
        }

        setStorageStatus(nextStatus);
        setStorageNotice(nextNotice);
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        console.error("Failed to verify storage configuration", error);
        setStorageStatus("error");
        setStorageNotice(UNREACHABLE_MESSAGE);
        setLastHealthCheck({ payload: { ok: false, reason: "error" }, receivedAt: Date.now() });
        if (STORAGE_DEBUG_ENABLED) {
          console.error("[storage] Document storage health check failed", error);
        }
        setStorageStatusSource("health");
      }
    }

    checkStorage();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const storageReady = storageStatus === "ready";

  const handleUpload = useCallback(
    async (file: File, replaceId?: string | null) => {
      resetNotices();
      setProgress(0);

      if (!storageReady) {
        const notReadyMessage =
          storageStatus === "not-configured"
            ? NOT_CONFIGURED_MESSAGE
            : storageStatus === "error"
              ? storageNotice ?? UNREACHABLE_MESSAGE
              : storageNotice ?? NOT_CONFIGURED_MESSAGE;
        setError(notReadyMessage);
        return;
      }

      const mimeType = resolveMimeType(file);
      if (!mimeType) {
        setError("We couldn't determine the file type. Please upload a supported document or image.");
        return;
      }

      if (!DOCUMENT_MIME_TYPES.includes(mimeType as (typeof DOCUMENT_MIME_TYPES)[number])) {
        setError("That file type isn't supported. Upload a PDF, Word document, or image.");
        return;
      }

      if (file.size > DOCUMENT_MAX_BYTES) {
        setError(
          `The file is larger than the ${formatFileSize(DOCUMENT_MAX_BYTES)} limit. Choose a smaller upload.`
        );
        return;
      }

      setStatus("preparing");

      let checksum: string;
      try {
        checksum = await computeChecksum(file);
      } catch (cause) {
        setStatus("idle");
        setError("We couldn't read the file. Try again or choose a different document or image.");
        return;
      }

      let uploadedKey: string | null = null;
      try {
        setStatus("uploading");
        setProgress(0);

        const formData = new FormData();
        formData.set("deliverableId", deliverableId);
        formData.set("skillId", skillId);
        formData.set("file", file);

        const response = await fetch(`/api/storage/upload`, {
          method: "POST",
          body: formData
        });

        const responseText = await response.text();
        let responseData: unknown = null;

        if (responseText) {
          try {
            responseData = JSON.parse(responseText);
          } catch (parseError) {
            console.warn("[document-evidence] Failed to parse upload response", parseError);
          }
        }

        const parsedData =
          responseData && typeof responseData === "object"
            ? (responseData as Record<string, unknown>)
            : null;

        const debugPayload: UploadDebugInfo = {
          endpoint: "/api/storage/upload",
          status: response.status,
          statusText: response.statusText,
          body: parsedData ?? responseText
        };
        setUploadDebug(debugPayload);

        if (!response.ok) {
          const fallbackError =
            parsedData && typeof parsedData["error"] === "string"
              ? (parsedData["error"] as string)
              : null;

          let fallback: string;
          if (response.status === 503) {
            fallback = fallbackError ?? NOT_CONFIGURED_MESSAGE;
            setStorageStatus("not-configured");
            setStorageStatusSource("upload");
            setStorageNotice(fallback);
          } else if (response.status >= 500) {
            fallback = fallbackError ?? "Upload service is not available. Please try again shortly.";
            setStorageStatus("error");
            setStorageStatusSource("upload");
            setStorageNotice(fallback);
          } else {
            fallback = fallbackError ?? "We couldn't upload the file.";
          }

          throw new Error(fallback);
        }

        if (!parsedData) {
          throw new Error("We couldn't upload the file. Please try again shortly.");
        }

        const keyValue = parsedData["key"];
        if (typeof keyValue !== "string" || keyValue.length === 0) {
          throw new Error("We couldn't confirm the uploaded file. Please try again shortly.");
        }

        uploadedKey = keyValue;
        setProgress(100);
      } catch (cause) {
        setStatus("idle");
        console.error("Document upload failed", cause);
        const message =
          cause instanceof Error
            ? cause.message
            : "We couldn't upload the file. Check your connection and try again.";
        setError(message);

        if (!uploadDebug) {
          setUploadDebug({
            endpoint: "/api/storage/upload",
            status: 0,
            statusText: "exception",
            body: cause instanceof Error ? cause.message : cause
          });
        }

        if (message.includes("not configured")) {
          setStorageStatus("not-configured");
          setStorageStatusSource("upload");
          setStorageNotice(message);
        }

        if (isRetryableDocumentUploadError(cause)) {
          setWarning("The connection dropped during upload. You can retry without losing progress.");
        }

        return;
      }

      if (!uploadedKey) {
        setStatus("idle");
        setError("We couldn't confirm the uploaded file. Please try again shortly.");
        return;
      }

      setStatus("committing");

      try {
        const response = await fetch(`/api/deliverables/${deliverableId}/documents/commit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillId,
            storageKey: uploadedKey,
            fileName: file.name,
            mimeType,
            fileSize: file.size,
            checksum,
            replaceEvidenceId: replaceId ?? undefined
          })
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "We couldn't save the file." }));
          throw new Error(data.error ?? "We couldn't save the file.");
        }

        const result = await response.json();
        if (result.warning) {
          setWarning(result.warning as string);
        }

        setSuccess("Document or image uploaded successfully.");
        router.refresh();
      } catch (cause) {
        const fallbackCommitMessage =
          cause instanceof Error && cause.message
            ? cause.message
            : "File uploaded but could not be saved. Contact the administrator if this continues.";
        setError(fallbackCommitMessage);
        setStatus("idle");
        return;
      }

      setStatus("idle");
    },
    [deliverableId, router, skillId, storageNotice, storageReady]
  );

  const onFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      const replaceId = pendingReplaceId.current;
      pendingReplaceId.current = null;
      await handleUpload(file, replaceId);
    },
    [handleUpload]
  );

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (!canEdit || !showUploader) {
        return;
      }
      const file = event.dataTransfer.files?.[0];
      if (!file) {
        return;
      }
      await handleUpload(file, evidence?.id ?? null);
    },
    [canEdit, showUploader, handleUpload, evidence?.id]
  );

  const onReplaceClick = () => {
    if (!evidence) {
      return;
    }
    pendingReplaceId.current = evidence.id;
    fileInputRef.current?.click();
  };

  const onUploadClick = () => {
    pendingReplaceId.current = evidence?.id ?? null;
    fileInputRef.current?.click();
  };

  const onRemove = async () => {
    if (!evidence) {
      return;
    }

    if (!window.confirm("Remove the uploaded file from this deliverable?")) {
      return;
    }

    resetNotices();
    setStatus("committing");

    try {
      const response = await fetch(
        `/api/deliverables/${deliverableId}/documents/${evidence.id}?skillId=${skillId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "We couldn't remove the file." }));
        throw new Error(data.error ?? "We couldn't remove the file.");
      }

      const data = await response.json();
      if (data.warning) {
        setWarning(data.warning as string);
      }

      setSuccess("Document or image removed.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Something went wrong while removing the file."
      );
    } finally {
      setStatus("idle");
    }
  };

  const storageDebugSourceLabel =
    storageStatusSource === "health"
      ? "/api/storage/health"
      : storageStatusSource === "upload"
        ? "upload flow"
        : "initial";

  const dropHandlers = showUploader && canEdit && storageReady
    ? {
        onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          if (!isDragging) {
            setIsDragging(true);
          }
        },
        onDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          setIsDragging(false);
        },
        onDrop
      }
    : undefined;

  if (!shouldRender) {
    return null;
  }

  const computedStorageNotice =
    storageStatus === "not-configured"
      ? storageNotice ?? NOT_CONFIGURED_MESSAGE
      : storageStatus === "error"
        ? storageNotice ?? UNREACHABLE_MESSAGE
        : null;

  return (
    <div className="space-y-3 rounded-md border border-dashed border-muted-foreground/40 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium">Document or image evidence</p>
          {evidence ? (
            <>
              <p className="text-sm text-muted-foreground">
                {evidence.fileName} · {formatFileSize(evidence.fileSize)} · Uploaded {" "}
                {format(new Date(evidence.addedAt), "d MMM yyyy 'at' HH:mm")}
              </p>
              {evidence.status === "processing" ? (
                <p className="text-xs text-muted-foreground">Scanning in progress. The file will be available shortly.</p>
              ) : null}
              {evidence.status === "blocked" ? (
                <p className="text-xs text-destructive">Download is temporarily disabled while we investigate a potential issue with this file.</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No document or image uploaded yet.</p>
          )}
        </div>
        {canEdit && evidence ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              aria-label="View file"
              disabled={evidence.status === "blocked"}
            >
              <a
                href={`/api/deliverables/${deliverableId}/documents/${evidence.id}/download?preview=true`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye className="mr-1 h-4 w-4" />
                View
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              aria-label="Download file"
              disabled={evidence.status === "blocked"}
            >
              <a href={`/api/deliverables/${deliverableId}/documents/${evidence.id}/download`}>
                Download
              </a>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onReplaceClick}
              disabled={disabled}
              aria-label="Replace file"
            >
              {status === "uploading" || status === "committing" ? "Replacing…" : "Replace"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onRemove}
              disabled={disabled}
              aria-label="Remove file"
            >
              Remove
            </Button>
          </div>
        ) : (
          evidence ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                aria-label="View file"
                disabled={evidence.status === "blocked"}
              >
                <a
                  href={`/api/deliverables/${deliverableId}/documents/${evidence.id}/download?preview=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Eye className="mr-1 h-4 w-4" />
                  View
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                aria-label="Download file"
                disabled={evidence.status === "blocked"}
              >
                <a href={`/api/deliverables/${deliverableId}/documents/${evidence.id}/download`}>
                  Download
                </a>
              </Button>
            </div>
          ) : null
        )}
      </div>

      {canEdit && showUploader ? (
        <div
          {...dropHandlers}
          className={`flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center transition ${
            isDragging
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/40 bg-muted/10"
          }`}
        >
          <p className="text-sm font-medium">
            {hasEvidence ? "Drop a file to replace the upload" : "Drop a document or image to upload"}
          </p>
          <p className="text-xs text-muted-foreground">
            Supported types: PDF, Word documents, JPEG, PNG · Max size {formatFileSize(DOCUMENT_MAX_BYTES)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUploadClick}
            disabled={uploadDisabled}
            aria-label={hasEvidence ? "Replace file" : "Upload file"}
          >
            {storageStatus === "checking"
              ? "Checking storage…"
              : hasEvidence
                ? "Replace file"
                : "Upload file"}
          </Button>
          {SHOW_READY_HINT && storageReady && lastHealthCheck?.payload.provider ? (
            <p className="text-xs text-muted-foreground" data-storage-status="ready-hint">
              Storage ready ({lastHealthCheck.payload.provider})
            </p>
          ) : null}
          {storageStatus === "checking" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Checking storage configuration…
            </p>
          ) : null}
          {SHOW_STATUS_DEBUG ? (
            <p className="text-xs text-muted-foreground" data-storage-status-debug>
              Storage status: {storageStatus}
              {lastHealthCheck?.payload.provider
                ? ` (${lastHealthCheck.payload.provider}${lastHealthCheck.payload.note ? `, note: ${lastHealthCheck.payload.note}` : ""})`
                : ""} (from {storageDebugSourceLabel})
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive" aria-live="polite">{error}</p> : null}
      {!error && computedStorageNotice && storageStatus !== "ready" ? (
        <p
          className={`text-sm ${
            storageStatus === "not-configured"
              ? "text-amber-600"
              : storageStatus === "error"
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
          aria-live="polite"
        >
          {computedStorageNotice}
        </p>
      ) : null}
      {warning ? <p className="text-sm text-amber-600" aria-live="polite">{warning}</p> : null}
      {success ? <p className="text-sm text-emerald-600" aria-live="polite">{success}</p> : null}

      {status === "uploading" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            />
          </div>
        </div>
      ) : null}

      {status === "preparing" || status === "committing" ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {status === "preparing" ? "Preparing upload…" : "Saving file…"}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={DOCUMENT_MIME_TYPES.join(",")}
        className="sr-only"
        onChange={onFileSelected}
        disabled={uploadDisabled}
      />

      {STORAGE_DEBUG_ENABLED && lastHealthCheck ? (
        <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 p-3 text-left text-xs text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Storage diagnostics</p>
          <p className="mb-2">Last check: {new Date(lastHealthCheck.receivedAt).toLocaleString()}</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
            {JSON.stringify(lastHealthCheck.payload, null, 2)}
          </pre>
        </div>
      ) : null}
      {SHOW_UPLOAD_DEBUG && uploadDebug ? (
        <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 p-3 text-left text-xs text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Upload debug</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
            {JSON.stringify(uploadDebug, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

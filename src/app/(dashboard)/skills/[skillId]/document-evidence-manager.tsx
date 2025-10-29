"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  DeliverableEvidenceDocument,
  formatFileSize,
  isRetryableDocumentUploadError
} from "@/lib/deliverables";

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

interface UploadHeaders {
  [key: string]: string;
}

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

async function uploadWithProgress(params: {
  url: string;
  file: File;
  headers: UploadHeaders;
  onProgress: (value: number) => void;
}) {
  const { url, file, headers, onProgress } = params;

  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);

    Object.entries(headers).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    request.onerror = () => {
      reject(new Error("Network error while uploading the file."));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${request.status}.`));
      }
    };

    request.send(file);
  });
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

  const disabled = status !== "idle";
  const hasEvidence = Boolean(evidence);
  const shouldRender = hasEvidence || showUploader || !canEdit;

  const resetNotices = () => {
    setError(null);
    setWarning(null);
    setSuccess(null);
  };

  useEffect(() => {
    let cancelled = false;

    async function checkStorage() {
      try {
        const response = await fetch("/api/storage/health", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Storage health check failed");
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        if (payload.ok) {
          setStorageStatus("ready");
          setStorageNotice(null);
        } else if (payload.reason === "not_configured") {
          setStorageStatus("not-configured");
          setStorageNotice(
            "Document storage is not configured yet. Please contact the administrator to enable uploads."
          );
        } else {
          setStorageStatus("error");
          setStorageNotice(
            "We couldn't confirm document storage is available right now. Try again later or contact the administrator."
          );
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to verify storage configuration", error);
        setStorageStatus("error");
        setStorageNotice(
          "We couldn't confirm document storage is available right now. Try again later or contact the administrator."
        );
      }
    }

    checkStorage();

    return () => {
      cancelled = true;
    };
  }, []);

  const storageReady = storageStatus === "ready";

  const handleUpload = useCallback(
    async (file: File, replaceId?: string | null) => {
      resetNotices();
      setProgress(0);

      if (!storageReady) {
        setError(
          storageNotice ??
            "Document storage is not configured yet. Please contact the administrator to enable uploads."
        );
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

      let presigned;
      try {
        const response = await fetch(`/api/storage/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliverableId,
            skillId,
            filename: file.name,
            contentType: mimeType,
            byteSize: file.size,
            checksum
          })
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "We couldn't start the upload." }));
          if (response.status === 503) {
            setStorageStatus("not-configured");
            setStorageNotice(
              data.error ??
                "Document storage is not configured yet. Please contact the administrator to enable uploads."
            );
          }
          throw new Error(data.error ?? "We couldn't start the upload.");
        }

        presigned = await response.json();
        if (!presigned?.url || !presigned?.key) {
          throw new Error("We couldn't prepare the upload. Please try again shortly.");
        }
      } catch (cause) {
        setStatus("idle");
        const message =
          cause instanceof Error
            ? cause.message
            : "We couldn't prepare the upload. Check your connection and try again.";
        setError(message);

        if (
          message.includes("not configured") &&
          storageStatus !== "not-configured"
        ) {
          setStorageStatus("not-configured");
          setStorageNotice(message);
        }
        return;
      }

      setStatus("uploading");

      try {
        await uploadWithProgress({
          url: presigned.url,
          file,
          headers: presigned.headers as UploadHeaders,
          onProgress: setProgress
        });
      } catch (cause) {
        setStatus("idle");
        setError(
          cause instanceof Error
            ? cause.message
            : "The upload was interrupted. Please try again."
        );
        if (isRetryableDocumentUploadError(cause)) {
          setWarning("The connection dropped during upload. You can retry without losing progress.");
        }
        return;
      }

      setStatus("committing");

      try {
        const response = await fetch(`/api/deliverables/${deliverableId}/documents/commit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillId,
            storageKey: presigned.key,
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
        setError(
          cause instanceof Error ? cause.message : "We couldn't save the file. Please try again."
        );
        setStatus("idle");
        return;
      }

      setStatus("idle");
    },
    [deliverableId, router, skillId, storageNotice, storageReady, storageStatus]
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
            disabled={disabled || !storageReady}
            aria-label={hasEvidence ? "Replace file" : "Upload file"}
          >
            {hasEvidence ? "Replace file" : "Upload file"}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive" aria-live="polite">{error}</p> : null}
      {!error && storageNotice ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {storageNotice}
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
        disabled={!storageReady}
      />
    </div>
  );
}

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

function parseFilename(header: string | null) {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match ? match[1] : null;
}

export function GlobalReportButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/reports/global");
      if (!response.ok) {
        throw new Error("Failed to generate report");
      }
      const blob = await response.blob();
      const filename =
        parseFilename(response.headers.get("content-disposition")) ??
        `WorldSkills_SA_Global_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      setError("Could not generate report. Please try again or contact support.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <Button onClick={handleClick} disabled={isLoading} variant="outline">
        {isLoading ? "Generating…" : "Export global report (PDF)"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

"use client";

import { AlertTriangle } from "lucide-react";

import type { SimilarSection } from "@/lib/wsos-sections";
import { cn } from "@/lib/utils";

interface DuplicateWarningProps {
  similar: SimilarSection[];
  className?: string;
}

export function DuplicateWarning({ similar, className }: DuplicateWarningProps) {
  if (similar.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-md border border-amber-500 bg-amber-50 p-4 dark:bg-amber-950",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-amber-800 dark:text-amber-200">
            Similar sections found
          </h4>
          <ul className="mt-2 space-y-1">
            {similar.map((section) => (
              <li
                key={section.id}
                className="text-sm text-amber-700 dark:text-amber-300"
              >
                {section.name}{" "}
                <span className="text-amber-600 dark:text-amber-400">
                  ({Math.round(section.similarity * 100)}% similar)
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Consider using an existing section instead of creating a duplicate.
          </p>
        </div>
      </div>
    </div>
  );
}

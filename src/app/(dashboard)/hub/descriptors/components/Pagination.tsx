"use client";

import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}

export function Pagination({ currentPage, totalPages, hasMore }: PaginationProps) {
  const [, setPage] = useQueryState("page", {
    defaultValue: "1",
    shallow: false,
  });

  if (totalPages <= 1) return null;

  const maxPage = Math.min(totalPages, 20); // Limit deep pagination

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage(String(currentPage - 1))}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>

      <span className="text-sm text-muted-foreground px-4">
        Page {currentPage} of {maxPage}
        {totalPages > 20 && " (limited)"}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage(String(currentPage + 1))}
        disabled={!hasMore || currentPage >= maxPage}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

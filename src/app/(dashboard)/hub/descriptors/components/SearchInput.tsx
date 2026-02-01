"use client";

import { useQueryState } from "nuqs";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SearchInput() {
  const [query, setQuery] = useQueryState("q", {
    defaultValue: "",
    shallow: false, // Trigger server re-render
    throttleMs: 0, // We handle debounce ourselves
  });

  const handleSearch = useDebouncedCallback((value: string) => {
    setQuery(value || null); // null removes param from URL
  }, 300);

  const handleClear = () => {
    setQuery(null);
    // Also clear the input field
    const input = document.querySelector<HTMLInputElement>('input[type="search"]');
    if (input) input.value = "";
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search descriptors by keyword..."
        defaultValue={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-10 pr-10"
      />
      {query && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear search</span>
        </Button>
      )}
    </div>
  );
}

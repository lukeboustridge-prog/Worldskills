"use client";

import { useState } from "react";
import { ResourceCategory, type ResourceLink } from "@prisma/client";
import { Search, ExternalLink } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  [ResourceCategory.GUIDANCE]: "Guidance",
  [ResourceCategory.TEMPLATE]: "Template",
  [ResourceCategory.BEST_PRACTICE]: "Best Practice",
  [ResourceCategory.ONBOARDING]: "Onboarding",
  [ResourceCategory.POLICY]: "Policy",
};

interface KBSearchProps {
  resources: ResourceLink[];
}

export function KBSearch({ resources }: KBSearchProps) {
  const [query, setQuery] = useState("");

  const filteredResources =
    query.trim().length > 0
      ? resources.filter((resource) => {
          const searchLower = query.toLowerCase();
          return (
            resource.title.toLowerCase().includes(searchLower) ||
            resource.description?.toLowerCase().includes(searchLower)
          );
        })
      : [];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search resources..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {query.trim().length > 0 && (
        <Card>
          <CardContent className="py-4">
            {filteredResources.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No resources found matching "{query}"
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredResources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted"
                    >
                      <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{resource.title}</p>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[resource.category]}
                          </Badge>
                        </div>
                        {resource.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                            {resource.description}
                          </p>
                        )}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

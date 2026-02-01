import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface SimilarDescriptor {
  id: string;
  code: string;
  criterionName: string;
  skillName: string;
  similarity: number;
}

interface DuplicateWarningProps {
  similar: SimilarDescriptor[];
}

export function DuplicateWarning({ similar }: DuplicateWarningProps) {
  if (!similar || similar.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-500 bg-amber-50 p-4 dark:bg-amber-950">
      <h3 className="font-medium text-amber-900 dark:text-amber-100">
        Similar descriptors found
      </h3>
      <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
        Review these similar descriptors to avoid duplicates:
      </p>
      <ul className="mt-3 space-y-2">
        {similar.map((s) => (
          <li key={s.id} className="flex items-start gap-2 text-sm">
            <Badge variant="outline">{s.code}</Badge>
            <div className="flex-1">
              <Link
                href={`/settings/descriptors/${s.id}/edit`}
                className="font-medium hover:underline"
              >
                {s.criterionName}
              </Link>
              <p className="text-muted-foreground">
                {s.skillName} ({Math.round(s.similarity * 100)}% similar)
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Facets {
  skillAreas: Array<{ name: string; count: number }>;
  categories: Array<{ name: string; count: number }>;
  qualities: Array<{ name: string; count: number }>;
}

export function FilterPanel({ facets }: { facets: Facets }) {
  const [skill, setSkill] = useQueryState("skill", { shallow: false });
  const [category, setCategory] = useQueryState("category", { shallow: false });
  const [quality, setQuality] = useQueryState("quality", { shallow: false });

  const hasFilters = skill || category || quality;

  const clearAll = () => {
    setSkill(null);
    setCategory(null);
    setQuality(null);
  };

  return (
    <div className="space-y-6">
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={clearAll} className="w-full">
          Clear all filters
        </Button>
      )}

      <FilterSection
        title="Skill Area"
        items={facets.skillAreas.slice(0, 10)}
        activeValue={skill}
        onSelect={(value) => setSkill(value === skill ? null : value)}
      />

      <FilterSection
        title="Category"
        items={facets.categories.slice(0, 10)}
        activeValue={category}
        onSelect={(value) => setCategory(value === category ? null : value)}
      />

      <FilterSection
        title="Quality"
        items={facets.qualities}
        activeValue={quality}
        onSelect={(value) => setQuality(value === quality ? null : value)}
      />
    </div>
  );
}

function FilterSection({
  title,
  items,
  activeValue,
  onSelect,
}: {
  title: string;
  items: Array<{ name: string; count: number }>;
  activeValue: string | null;
  onSelect: (value: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="space-y-1">
        {items.map(({ name, count }) => (
          <Button
            key={name}
            variant={activeValue === name ? "default" : "ghost"}
            size="sm"
            className="w-full justify-between text-left h-auto py-2"
            onClick={() => onSelect(name)}
          >
            <span className="truncate">{name}</span>
            <Badge variant="outline" className="ml-2">
              {count}
            </Badge>
          </Button>
        ))}
      </div>
    </div>
  );
}

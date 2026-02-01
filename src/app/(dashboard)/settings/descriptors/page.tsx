import { QualityIndicator } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdminUser } from "@/lib/auth";
import { getAllDescriptors, getDescriptorFilterOptions } from "@/lib/descriptors";
import { DeleteConfirmation } from "@/components/descriptors/delete-confirmation";

const QUALITY_INDICATOR_LABELS: Record<QualityIndicator, string> = {
  [QualityIndicator.EXCELLENT]: "Excellent",
  [QualityIndicator.GOOD]: "Good",
  [QualityIndicator.REFERENCE]: "Reference",
  [QualityIndicator.NEEDS_REVIEW]: "Needs Review",
};

const QUALITY_INDICATOR_COLORS: Record<QualityIndicator, string> = {
  [QualityIndicator.EXCELLENT]: "bg-green-100 text-green-800",
  [QualityIndicator.GOOD]: "bg-blue-100 text-blue-800",
  [QualityIndicator.REFERENCE]: "bg-gray-100 text-gray-800",
  [QualityIndicator.NEEDS_REVIEW]: "bg-amber-100 text-amber-800",
};

export default async function DescriptorsPage({
  searchParams,
}: {
  searchParams?: {
    search?: string;
    skillName?: string;
    sector?: string;
    category?: string;
    qualityIndicator?: QualityIndicator;
    tag?: string;
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  };
}) {
  await requireAdminUser();

  const descriptors = await getAllDescriptors({
    search: searchParams?.search,
    skillName: searchParams?.skillName,
    sector: searchParams?.sector,
    category: searchParams?.category,
    qualityIndicator: searchParams?.qualityIndicator,
    tag: searchParams?.tag,
  });

  const filterOptions = await getDescriptorFilterOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Link>
          </Button>
        </div>
        <Button asChild>
          <Link href="/settings/descriptors/create">
            <Plus className="mr-2 h-4 w-4" />
            Add Descriptor
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Manage Descriptors
        </h1>
        <p className="mt-2 text-muted-foreground">
          View, create, and edit performance descriptors from the library.
        </p>
      </div>

      {searchParams?.error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{searchParams.error}</p>
          </CardContent>
        </Card>
      )}

      {searchParams?.created && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Descriptor created successfully.
            </p>
          </CardContent>
        </Card>
      )}

      {searchParams?.updated && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Descriptor updated successfully.
            </p>
          </CardContent>
        </Card>
      )}

      {searchParams?.deleted && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Descriptor deleted successfully.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filter Descriptors</CardTitle>
          <CardDescription>
            Search and filter the descriptor library
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                name="search"
                placeholder="Search code, criterion, levels..."
                defaultValue={searchParams?.search}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skillName">Skill</Label>
              <select
                id="skillName"
                name="skillName"
                defaultValue={searchParams?.skillName ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Skills</option>
                {filterOptions.skills.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sector">Sector</Label>
              <select
                id="sector"
                name="sector"
                defaultValue={searchParams?.sector ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Sectors</option>
                {filterOptions.sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                defaultValue={searchParams?.category ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Categories</option>
                {filterOptions.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualityIndicator">Quality</Label>
              <select
                id="qualityIndicator"
                name="qualityIndicator"
                defaultValue={searchParams?.qualityIndicator ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Quality Levels</option>
                {Object.entries(QUALITY_INDICATOR_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag">Tag</Label>
              <select
                id="tag"
                name="tag"
                defaultValue={searchParams?.tag ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Tags</option>
                {filterOptions.tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Apply Filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Descriptors</CardTitle>
          <CardDescription>
            {descriptors.length} descriptor{descriptors.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {descriptors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No descriptors match the current filters.
            </p>
          ) : (
            <div className="space-y-3">
              {descriptors.map((descriptor) => (
                <div
                  key={descriptor.id}
                  className="flex items-start justify-between gap-4 rounded-md border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{descriptor.code}</Badge>
                      <Badge variant="default">{descriptor.skillName}</Badge>
                      <Badge className={QUALITY_INDICATOR_COLORS[descriptor.qualityIndicator]}>
                        {QUALITY_INDICATOR_LABELS[descriptor.qualityIndicator]}
                      </Badge>
                    </div>

                    <h3 className="mt-2 font-medium">{descriptor.criterionName}</h3>

                    {descriptor.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {descriptor.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {(descriptor.sector || descriptor.category) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {[descriptor.sector, descriptor.category].filter(Boolean).join(" • ")}
                      </p>
                    )}

                    {descriptor.score3 && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {descriptor.score3}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settings/descriptors/${descriptor.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <DeleteConfirmation
                      descriptorId={descriptor.id}
                      criterionName={descriptor.criterionName}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

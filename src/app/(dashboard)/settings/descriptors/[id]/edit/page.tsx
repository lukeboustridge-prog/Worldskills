import { QualityIndicator } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminUser } from "@/lib/auth";
import { getDescriptorById } from "@/lib/descriptors";
import { findSimilarDescriptors } from "@/lib/duplicate-detection";
import { DuplicateWarning } from "@/components/descriptors/duplicate-warning";
import { updateDescriptorAction } from "@/app/(dashboard)/settings/descriptors/actions";

const QUALITY_INDICATOR_LABELS: Record<QualityIndicator, string> = {
  [QualityIndicator.EXCELLENT]: "Excellent",
  [QualityIndicator.GOOD]: "Good",
  [QualityIndicator.REFERENCE]: "Reference",
  [QualityIndicator.NEEDS_REVIEW]: "Needs Review",
};

export default async function EditDescriptorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string };
}) {
  await requireAdminUser();

  const descriptor = await getDescriptorById(params.id);
  if (!descriptor) {
    notFound();
  }

  // Find similar descriptors, excluding current descriptor
  const similarDescriptors = await findSimilarDescriptors(
    descriptor.criterionName,
    0.4,
    params.id
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings/descriptors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Descriptors
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Edit Descriptor
        </h1>
        <p className="mt-2 text-muted-foreground">
          Update the descriptor information below.
        </p>
      </div>

      {searchParams?.error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{searchParams.error}</p>
          </CardContent>
        </Card>
      )}

      <DuplicateWarning similar={similarDescriptors} />

      <Card>
        <CardHeader>
          <CardTitle>Edit Descriptor</CardTitle>
          <CardDescription>
            Editing: {descriptor.code} - {descriptor.criterionName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateDescriptorAction} className="space-y-6">
            <input type="hidden" name="id" value={descriptor.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  name="code"
                  required
                  defaultValue={descriptor.code}
                  placeholder="A1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skillNames">Skills</Label>
                <Input
                  id="skillNames"
                  name="skillNames"
                  required
                  defaultValue={descriptor.skillNames.join(", ")}
                  placeholder="Welding, Fabrication"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of skills
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="criterionName">Criterion Name</Label>
              <Input
                id="criterionName"
                name="criterionName"
                required
                defaultValue={descriptor.criterionName}
                placeholder="Quality of weld seam"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="score3">Score 3</Label>
                <Textarea
                  id="score3"
                  name="score3"
                  rows={3}
                  defaultValue={(descriptor as any).score3 ?? ""}
                  placeholder="Description for score 3 (excellent)..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="score2">Score 2</Label>
                <Textarea
                  id="score2"
                  name="score2"
                  rows={3}
                  defaultValue={(descriptor as any).score2 ?? ""}
                  placeholder="Description for score 2 (good)..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="score1">Score 1</Label>
                <Textarea
                  id="score1"
                  name="score1"
                  rows={3}
                  defaultValue={(descriptor as any).score1 ?? ""}
                  placeholder="Description for score 1 (acceptable)..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="score0">Score 0</Label>
                <Textarea
                  id="score0"
                  name="score0"
                  rows={3}
                  defaultValue={(descriptor as any).score0 ?? ""}
                  placeholder="Description for score 0 (below standard)..."
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  name="sector"
                  defaultValue={descriptor.sector ?? ""}
                  placeholder="e.g., Manufacturing and Engineering Technology"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categories">Categories</Label>
                <Input
                  id="categories"
                  name="categories"
                  defaultValue={descriptor.categories.join(", ")}
                  placeholder="e.g., Technical Skills, Safety"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of categories
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                defaultValue={descriptor.tags.join(", ")}
                placeholder="tag1, tag2, tag3"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated tags for categorization
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualityIndicator">Quality Indicator</Label>
              <select
                id="qualityIndicator"
                name="qualityIndicator"
                defaultValue={descriptor.qualityIndicator}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Object.entries(QUALITY_INDICATOR_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit">Update Descriptor</Button>
              <Button asChild variant="outline">
                <Link href="/settings/descriptors">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

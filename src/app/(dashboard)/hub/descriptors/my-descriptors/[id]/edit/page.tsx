import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DescriptorBatchStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { getAllWSOSSections } from "@/lib/wsos-sections";
import { getSCMDescriptorById } from "@/lib/scm-descriptors";
import { WSOSSectionSelect } from "@/components/descriptors/wsos-section-select";
import { updateSCMDescriptorAction, updateReturnedDescriptorAction } from "../../actions";

export default async function EditDescriptorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await requireUser();

  // Only SCMs can access this page
  if (user.role !== "SCM") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const search = await searchParams;

  // Fetch descriptor with ownership check
  const descriptor = await getSCMDescriptorById(id, user.id);

  if (!descriptor) {
    notFound();
  }

  // Can only edit DRAFT or RETURNED descriptors
  const canEdit =
    descriptor.batchStatus === DescriptorBatchStatus.DRAFT ||
    descriptor.batchStatus === DescriptorBatchStatus.RETURNED;

  if (!canEdit) {
    redirect("/hub/descriptors/my-descriptors?error=This%20descriptor%20cannot%20be%20edited");
  }

  const sections = await getAllWSOSSections();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/hub/descriptors/my-descriptors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to My Descriptors
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Edit Descriptor</h1>
        <p className="mt-2 text-muted-foreground">
          {descriptor.batchStatus === DescriptorBatchStatus.RETURNED
            ? "Address the SA feedback and save to move back to draft, then resubmit."
            : "Update your draft descriptor before submitting for review."}
        </p>
      </div>

      {search?.error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{search.error}</p>
          </CardContent>
        </Card>
      )}

      {descriptor.batchStatus === DescriptorBatchStatus.RETURNED && descriptor.reviewComment && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-red-700">SA Feedback:</p>
            <p className="text-sm text-red-600 mt-1">{descriptor.reviewComment}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Edit Descriptor</CardTitle>
          <CardDescription>
            Editing: {descriptor.code} - {descriptor.criterionName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={descriptor.batchStatus === DescriptorBatchStatus.RETURNED
              ? updateReturnedDescriptorAction
              : updateSCMDescriptorAction
            }
            className="space-y-6"
          >
            <input type="hidden" name="id" value={descriptor.id} />

            {/* WSOS Section - Required */}
            <div className="space-y-2">
              <Label htmlFor="wsosSectionId">
                WSOS Section <span className="text-destructive">*</span>
              </Label>
              <WSOSSectionSelect
                sections={sections}
                name="wsosSectionId"
                defaultValue={descriptor.wsosSectionId ?? ""}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  name="code"
                  required
                  defaultValue={descriptor.code}
                  placeholder="A1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="criterionName">
                  Criterion Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="criterionName"
                  name="criterionName"
                  required
                  minLength={5}
                  defaultValue={descriptor.criterionName}
                  placeholder="Quality of weld seam"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Performance Levels</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="score3">Score 3 (Excellent)</Label>
                  <Textarea
                    id="score3"
                    name="score3"
                    rows={4}
                    defaultValue={descriptor.score3 ?? ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="score2">Score 2 (Good)</Label>
                  <Textarea
                    id="score2"
                    name="score2"
                    rows={4}
                    defaultValue={descriptor.score2 ?? ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="score1">Score 1 (Pass)</Label>
                  <Textarea
                    id="score1"
                    name="score1"
                    rows={4}
                    defaultValue={descriptor.score1 ?? ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="score0">Score 0 (Below Pass)</Label>
                  <Textarea
                    id="score0"
                    name="score0"
                    rows={4}
                    defaultValue={descriptor.score0 ?? ""}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                defaultValue={descriptor.tags.join(", ")}
                placeholder="safety, measurement, quality"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit">Update Descriptor</Button>
              <Button asChild variant="outline">
                <Link href="/hub/descriptors/my-descriptors">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

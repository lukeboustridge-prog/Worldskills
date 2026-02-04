import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { getAllWSOSSections } from "@/lib/wsos-sections";
import { WSOSSectionSelect } from "@/components/descriptors/wsos-section-select";
import { createSCMDescriptorAction } from "../actions";

export default async function CreateDescriptorPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await requireUser();

  // Only SCMs can access this page
  if (user.role !== "SCM") {
    redirect("/dashboard");
  }

  const params = await searchParams;
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
        <h1 className="text-3xl font-semibold tracking-tight">Create Descriptor</h1>
        <p className="mt-2 text-muted-foreground">
          Add a new descriptor to your draft batch. It will be submitted for SA review.
        </p>
      </div>

      {params?.error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{params.error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Descriptor Details</CardTitle>
          <CardDescription>
            All new descriptors require a WSOS section and will need SA approval before appearing in the library.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSCMDescriptorAction} className="space-y-6">
            {/* WSOS Section - Required (DESC-02, DESC-03) */}
            <div className="space-y-2">
              <Label htmlFor="wsosSectionId">
                WSOS Section <span className="text-destructive">*</span>
              </Label>
              <WSOSSectionSelect
                sections={sections}
                name="wsosSectionId"
                required
              />
              <p className="text-xs text-muted-foreground">
                Select an existing section or create a new one
              </p>
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
                  placeholder="A1"
                />
                <p className="text-xs text-muted-foreground">
                  Criterion code (e.g., A1, B2.1)
                </p>
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
                  placeholder="Quality of weld seam"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Performance Levels</h3>
              <p className="text-sm text-muted-foreground">
                At least one performance level description is required.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="score3">Score 3 (Excellent)</Label>
                  <Textarea
                    id="score3"
                    name="score3"
                    rows={4}
                    placeholder="Description for excellent performance..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="score2">Score 2 (Good)</Label>
                  <Textarea
                    id="score2"
                    name="score2"
                    rows={4}
                    placeholder="Description for good performance..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="score1">Score 1 (Pass)</Label>
                  <Textarea
                    id="score1"
                    name="score1"
                    rows={4}
                    placeholder="Description for passing performance..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="score0">Score 0 (Below Pass)</Label>
                  <Textarea
                    id="score0"
                    name="score0"
                    rows={4}
                    placeholder="Description for below passing..."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                placeholder="safety, measurement, quality"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated tags for categorization
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit">Save as Draft</Button>
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

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getPendingDescriptorsForSA, getPendingCountsForSA } from "@/lib/sa-approval";
import { PendingReviewCard } from "./components/PendingReviewCard";

export default async function PendingReviewPage() {
  const user = await requireUser();

  // Only SAs can access this page
  if (user.role !== "SA") {
    redirect("/dashboard");
  }

  const [descriptors, counts] = await Promise.all([
    getPendingDescriptorsForSA(user.id),
    getPendingCountsForSA(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/hub/descriptors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Pending Review
        </h1>
        <p className="mt-2 text-muted-foreground">
          Review descriptors submitted by your SCMs. Approve, edit, or return
          with feedback.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Descriptors Awaiting Review</CardTitle>
          <CardDescription>
            {counts.total} descriptor(s) pending your review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {descriptors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No descriptors pending review.
            </p>
          ) : (
            <div className="space-y-3">
              {descriptors.map((descriptor) => (
                <PendingReviewCard key={descriptor.id} descriptor={descriptor} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

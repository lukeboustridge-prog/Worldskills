import { DescriptorBatchStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, Send, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getSCMDescriptors } from "@/lib/scm-descriptors";
import { submitBatchAction, deleteSCMDescriptorAction } from "./actions";

const BATCH_STATUS_CONFIG: Record<DescriptorBatchStatus, { label: string; color: string; icon: typeof Clock }> = {
  [DescriptorBatchStatus.DRAFT]: {
    label: "Draft",
    color: "bg-gray-100 text-gray-800",
    icon: Clock,
  },
  [DescriptorBatchStatus.PENDING_REVIEW]: {
    label: "Pending Review",
    color: "bg-amber-100 text-amber-800",
    icon: Clock,
  },
  [DescriptorBatchStatus.APPROVED]: {
    label: "Approved",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  [DescriptorBatchStatus.RETURNED]: {
    label: "Returned",
    color: "bg-red-100 text-red-800",
    icon: AlertCircle,
  },
};

export default async function MyDescriptorsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    submitted?: string;
    error?: string;
  }>;
}) {
  const user = await requireUser();

  // Only SCMs can access this page
  if (user.role !== "SCM") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const allDescriptors = await getSCMDescriptors(user.id);

  // Group by batch status
  const draftDescriptors = allDescriptors.filter(
    (d) => d.batchStatus === DescriptorBatchStatus.DRAFT
  );
  const pendingDescriptors = allDescriptors.filter(
    (d) => d.batchStatus === DescriptorBatchStatus.PENDING_REVIEW
  );
  const approvedDescriptors = allDescriptors.filter(
    (d) => d.batchStatus === DescriptorBatchStatus.APPROVED
  );
  const returnedDescriptors = allDescriptors.filter(
    (d) => d.batchStatus === DescriptorBatchStatus.RETURNED
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/hub/descriptors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Library
            </Link>
          </Button>
        </div>
        <Button asChild>
          <Link href="/hub/descriptors/my-descriptors/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Descriptor
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My Descriptors</h1>
        <p className="mt-2 text-muted-foreground">
          Create and manage your descriptors. Submit batches for SA review.
        </p>
      </div>

      {/* Status messages */}
      {params?.error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{params.error}</p>
          </CardContent>
        </Card>
      )}

      {params?.created && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Descriptor created and added to draft batch.
            </p>
          </CardContent>
        </Card>
      )}

      {params?.updated && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Descriptor updated successfully.
            </p>
          </CardContent>
        </Card>
      )}

      {params?.deleted && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Descriptor deleted.
            </p>
          </CardContent>
        </Card>
      )}

      {params?.submitted && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Batch submitted! {params.submitted} descriptor(s) sent for SA review.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Draft Batch Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Draft Batch
            </CardTitle>
            <CardDescription>
              {draftDescriptors.length} descriptor(s) ready to submit for review
            </CardDescription>
          </div>
          {draftDescriptors.length > 0 && (
            <form action={submitBatchAction}>
              <Button type="submit">
                <Send className="mr-2 h-4 w-4" />
                Submit for Review
              </Button>
            </form>
          )}
        </CardHeader>
        <CardContent>
          {draftDescriptors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No draft descriptors. Create one to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {draftDescriptors.map((descriptor) => (
                <div
                  key={descriptor.id}
                  className="flex items-start justify-between gap-4 rounded-md border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{descriptor.code}</Badge>
                      {descriptor.wsosSection && (
                        <Badge>{descriptor.wsosSection.name}</Badge>
                      )}
                    </div>
                    <h3 className="mt-2 font-medium">{descriptor.criterionName}</h3>
                    {descriptor.score3 && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {descriptor.score3}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/hub/descriptors/my-descriptors/${descriptor.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <form action={deleteSCMDescriptorAction}>
                      <input type="hidden" name="id" value={descriptor.id} />
                      <Button type="submit" variant="outline" size="sm" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Returned Section (needs attention) */}
      {returnedDescriptors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Returned for Revision
            </CardTitle>
            <CardDescription>
              {returnedDescriptors.length} descriptor(s) returned by SA with comments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {returnedDescriptors.map((descriptor) => (
                <div
                  key={descriptor.id}
                  className="flex items-start justify-between gap-4 rounded-md border border-red-200 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{descriptor.code}</Badge>
                      <Badge className="bg-red-100 text-red-800">Returned</Badge>
                    </div>
                    <h3 className="mt-2 font-medium">{descriptor.criterionName}</h3>
                    {descriptor.reviewComment && (
                      <p className="mt-2 text-sm text-red-700 bg-red-50 p-2 rounded">
                        SA Comment: {descriptor.reviewComment}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/hub/descriptors/my-descriptors/${descriptor.id}/edit`}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Review Section */}
      {pendingDescriptors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Review
            </CardTitle>
            <CardDescription>
              {pendingDescriptors.length} descriptor(s) awaiting SA approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingDescriptors.map((descriptor) => (
                <div
                  key={descriptor.id}
                  className="flex items-start gap-4 rounded-md border p-4 bg-amber-50/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{descriptor.code}</Badge>
                      {descriptor.wsosSection && (
                        <Badge>{descriptor.wsosSection.name}</Badge>
                      )}
                      <Badge className="bg-amber-100 text-amber-800">Pending Review</Badge>
                    </div>
                    <h3 className="mt-2 font-medium">{descriptor.criterionName}</h3>
                    {descriptor.submittedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted {new Date(descriptor.submittedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approved Section */}
      {approvedDescriptors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Approved
            </CardTitle>
            <CardDescription>
              {approvedDescriptors.length} descriptor(s) approved and added to library
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {approvedDescriptors.map((descriptor) => (
                <div
                  key={descriptor.id}
                  className="flex items-start gap-4 rounded-md border p-4 bg-green-50/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{descriptor.code}</Badge>
                      {descriptor.wsosSection && (
                        <Badge>{descriptor.wsosSection.name}</Badge>
                      )}
                      <Badge className="bg-green-100 text-green-800">Approved</Badge>
                    </div>
                    <h3 className="mt-2 font-medium">{descriptor.criterionName}</h3>
                    {descriptor.reviewedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Approved {new Date(descriptor.reviewedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

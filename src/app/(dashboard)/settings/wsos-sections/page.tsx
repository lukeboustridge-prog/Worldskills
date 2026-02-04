import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getAllWSOSSections, type WSOSSectionWithCreator } from "@/lib/wsos-sections";
import {
  createWSOSSectionAction,
  updateWSOSSectionAction,
  deleteWSOSSectionAction,
} from "./actions";
import { WSOSSectionForm } from "./form";

export default async function WSOSSectionsPage({
  searchParams,
}: {
  searchParams?: {
    error?: string;
    created?: string;
    updated?: string;
    deleted?: string;
    edit?: string;
  };
}) {
  const user = await requireUser();

  // Role check: SCM or Admin only
  if (user.role !== "SCM" && !user.isAdmin) {
    redirect("/dashboard");
  }

  const sections = await getAllWSOSSections();
  const editingId = searchParams?.edit;
  const editingSection = editingId
    ? sections.find((s) => s.id === editingId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">WSOS Sections</h1>
        <p className="mt-2 text-muted-foreground">
          Manage WSOS sections for organizing descriptors.
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
              Section created successfully.
            </p>
          </CardContent>
        </Card>
      )}

      {searchParams?.updated && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Section updated successfully.
            </p>
          </CardContent>
        </Card>
      )}

      {searchParams?.deleted && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Section deleted successfully.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {editingSection ? "Edit Section" : "Create New Section"}
          </CardTitle>
          <CardDescription>
            {editingSection
              ? "Update the section details below."
              : "Create a new WSOS section for organizing descriptors."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WSOSSectionForm
            editingSection={editingSection}
            createAction={createWSOSSectionAction}
            updateAction={updateWSOSSectionAction}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing WSOS Sections</CardTitle>
          <CardDescription>
            {sections.length} section{sections.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No WSOS sections have been created yet.
            </p>
          ) : (
            <div className="space-y-3">
              {sections.map((section) => (
                <SectionItem key={section.id} section={section} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SectionItem({ section }: { section: WSOSSectionWithCreator }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{section.name}</p>
        {section.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {section.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {section.creator.name ?? section.creator.email}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Created {format(section.createdAt, "dd MMM yyyy")}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/settings/wsos-sections?edit=${section.id}`}>
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
        <form action={deleteWSOSSectionAction}>
          <input type="hidden" name="id" value={section.id} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

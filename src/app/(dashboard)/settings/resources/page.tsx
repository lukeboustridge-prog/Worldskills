import { ResourceCategory, ResourceVisibility } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminUser } from "@/lib/auth";
import { getAllResources } from "@/lib/resources";
import {
  createResourceLinkAction,
  deleteResourceLinkAction,
  updateResourceLinkAction,
} from "./actions";

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  [ResourceCategory.GUIDANCE]: "Guidance",
  [ResourceCategory.TEMPLATE]: "Template",
  [ResourceCategory.BEST_PRACTICE]: "Best Practice",
  [ResourceCategory.ONBOARDING]: "Onboarding",
  [ResourceCategory.POLICY]: "Policy",
  [ResourceCategory.EXTERNAL]: "External Link",
};

const VISIBILITY_LABELS: Record<ResourceVisibility, string> = {
  [ResourceVisibility.SA]: "SA Only",
  [ResourceVisibility.SCM]: "SCM Only",
  [ResourceVisibility.BOTH]: "Both SA & SCM",
};

export default async function ResourcesSettingsPage({
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
  await requireAdminUser();

  const resources = await getAllResources();
  const editingId = searchParams?.edit;
  const editingResource = editingId
    ? resources.find((r) => r.id === editingId)
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
        <h1 className="text-3xl font-semibold tracking-tight">
          Manage Resources
        </h1>
        <p className="mt-2 text-muted-foreground">
          Add and manage resource links for the Knowledge Base.
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
              Resource created successfully.
            </p>
          </CardContent>
        </Card>
      )}

      {searchParams?.updated && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Resource updated successfully.
            </p>
          </CardContent>
        </Card>
      )}

      {searchParams?.deleted && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              Resource deleted successfully.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {editingResource ? "Edit Resource" : "Add New Resource"}
          </CardTitle>
          <CardDescription>
            {editingResource
              ? "Update the resource details below."
              : "Create a new resource link for the Knowledge Base."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={editingResource ? updateResourceLinkAction : createResourceLinkAction}
            className="space-y-4"
          >
            {editingResource && (
              <input type="hidden" name="id" value={editingResource.id} />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  defaultValue={editingResource?.title ?? ""}
                  placeholder="Resource title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  required
                  defaultValue={editingResource?.category ?? ResourceCategory.GUIDANCE}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">Visible To</Label>
              <select
                id="visibility"
                name="visibility"
                required
                defaultValue={editingResource?.visibility ?? ResourceVisibility.BOTH}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-1/2"
              >
                {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Choose who can see this resource (admins always see all resources)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                name="url"
                type="url"
                required
                defaultValue={editingResource?.url ?? ""}
                placeholder="https://example.com/resource"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={editingResource?.description ?? ""}
                placeholder="Brief description of the resource"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  name="position"
                  type="number"
                  min="0"
                  defaultValue={editingResource?.position ?? 0}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first within category
                </p>
              </div>

              <div className="flex items-center gap-2 pt-8">
                <input
                  type="checkbox"
                  id="isFeatured"
                  name="isFeatured"
                  defaultChecked={editingResource?.isFeatured ?? false}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="isFeatured" className="font-normal">
                  Featured on My Hub dashboard
                </Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit">
                <Plus className="mr-2 h-4 w-4" />
                {editingResource ? "Update Resource" : "Add Resource"}
              </Button>
              {editingResource && (
                <Button asChild variant="outline">
                  <Link href="/settings/resources">Cancel</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Resources</CardTitle>
          <CardDescription>
            {resources.length} resource{resources.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No resources have been added yet.
            </p>
          ) : (
            <div className="space-y-3">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-start justify-between gap-4 rounded-md border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{resource.title}</p>
                      {resource.isFeatured && (
                        <Star className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {CATEGORY_LABELS[resource.category]}
                      </Badge>
                      <Badge variant="outline" className="bg-muted">
                        {VISIBILITY_LABELS[resource.visibility]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Position: {resource.position}
                      </span>
                    </div>
                    {resource.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-1">
                        {resource.description}
                      </p>
                    )}
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {resource.url.length > 50
                        ? resource.url.substring(0, 50) + "..."
                        : resource.url}
                    </a>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Added {format(resource.createdAt, "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settings/resources?edit=${resource.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <form action={deleteResourceLinkAction}>
                      <input type="hidden" name="id" value={resource.id} />
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

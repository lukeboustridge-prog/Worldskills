import { ResourceCategory, Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Globe, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getAllResources } from "@/lib/resources";
import { KBSearch } from "./kb-search";

const CATEGORY_CONFIG: Record<
  ResourceCategory,
  { title: string; description: string }
> = {
  [ResourceCategory.GUIDANCE]: {
    title: "Guidance Notes",
    description: "Official guidance and documentation",
  },
  [ResourceCategory.TEMPLATE]: {
    title: "Templates & Forms",
    description: "Standard templates and forms for submissions",
  },
  [ResourceCategory.BEST_PRACTICE]: {
    title: "Best Practices",
    description: "Tips and recommendations from experienced advisors",
  },
  [ResourceCategory.ONBOARDING]: {
    title: "Onboarding Materials",
    description: "Resources for new advisors",
  },
  [ResourceCategory.POLICY]: {
    title: "Policies",
    description: "Official policies and procedures",
  },
};

const CATEGORY_ORDER: ResourceCategory[] = [
  ResourceCategory.GUIDANCE,
  ResourceCategory.TEMPLATE,
  ResourceCategory.BEST_PRACTICE,
  ResourceCategory.POLICY,
  ResourceCategory.ONBOARDING,
];

export default async function KnowledgeBasePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const resources = await getAllResources();

  const resourcesByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    config: CATEGORY_CONFIG[category],
    resources: resources.filter((r) => r.category === category),
  })).filter((group) => group.resources.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Knowledge Base
          </h1>
          <p className="mt-2 text-muted-foreground">
            Find guidance, templates, and resources for your work.
          </p>
        </div>
        {user.isAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/resources">
              <Settings className="mr-2 h-4 w-4" />
              Manage Resources
            </Link>
          </Button>
        )}
      </div>

      <KBSearch resources={resources} />

      {(user.role === Role.SA || user.isAdmin) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              External Links
            </CardTitle>
            <CardDescription>
              Useful external websites and tools for Skill Advisors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <li>
                <a
                  href="https://worldskillscis.show/sa_test"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
                >
                  <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">
                      CIS (Competition Information System)
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      Test and play with the marking schemes
                    </p>
                  </div>
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      {resourcesByCategory.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No resources have been added yet.
              {user.isAdmin && (
                <>
                  {" "}
                  <Link
                    href="/settings/resources"
                    className="text-primary hover:underline"
                  >
                    Add your first resource
                  </Link>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {resourcesByCategory.map(({ category, config, resources }) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{config.title}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {resources.map((resource) => (
                    <li key={resource.id}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
                      >
                        <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-tight">
                            {resource.title}
                          </p>
                          {resource.description && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {resource.description}
                            </p>
                          )}
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

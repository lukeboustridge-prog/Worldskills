import { ResourceCategory } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  BookOpen,
  GraduationCap,
  Users,
  HelpCircle,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getResourcesByCategory } from "@/lib/resources";
import { FAQAccordion } from "./faq-accordion";

const FAQ_ITEMS = [
  {
    question: "What is my role as a Skill Advisor?",
    answer:
      "As a Skill Advisor (SA), you are responsible for developing and managing the test project for your skill area. This includes creating assessment materials, coordinating with competition managers, and ensuring all deliverables meet WorldSkills standards.",
  },
  {
    question: "How do I submit my deliverables?",
    answer:
      "Navigate to your skill page from the Skills menu, then find the relevant deliverable. Click on it to upload evidence files or update its status. You can upload multiple files per deliverable and track your progress through the QC Pipeline.",
  },
  {
    question: "Who should I contact if I have questions?",
    answer:
      "Your primary contact is your assigned Skill Competition Manager (SCM). You can message them directly through the skill workspace. For technical issues with this platform, contact the Secretariat team.",
  },
  {
    question: "What are the key deadlines I should be aware of?",
    answer:
      "Key deadlines are displayed on your My Hub dashboard. Each deliverable has a specific due date based on the competition timeline. Items due within 30 days are highlighted, and overdue items require immediate attention.",
  },
  {
    question: "How do I prepare for my first meeting?",
    answer:
      "Review the meeting agenda and any attached documents beforehand. Familiarise yourself with the WSOS (WorldSkills Occupational Standards) for your skill. Come prepared with questions about the timeline and deliverables.",
  },
];

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const onboardingResources = await getResourcesByCategory(
    ResourceCategory.ONBOARDING
  );

  const roleResources = onboardingResources.filter(
    (r) => r.title.toLowerCase().includes("role") || r.position <= 2
  );
  const trainingResources = onboardingResources.filter(
    (r) =>
      r.title.toLowerCase().includes("training") ||
      r.title.toLowerCase().includes("assessment")
  );
  const otherResources = onboardingResources.filter(
    (r) => !roleResources.includes(r) && !trainingResources.includes(r)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Getting Started</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome! Everything you need to get started as a Skill Advisor.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Step 1: Understand Your Role</CardTitle>
                <CardDescription>
                  Learn what's expected of a Skill Advisor
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {roleResources.length > 0 ? (
              <ul className="space-y-2">
                {roleResources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{resource.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Role description resources coming soon. Contact your SCM for
                guidance.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Step 2: Assessment Training</CardTitle>
                <CardDescription>
                  Learn how to create effective assessments
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trainingResources.length > 0 ? (
              <ul className="space-y-2">
                {trainingResources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{resource.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Assessment training resources coming soon. Check the Knowledge
                Base for available materials.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {otherResources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Onboarding Resources</CardTitle>
            <CardDescription>
              More materials to help you get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {otherResources.map((resource) => (
                <li key={resource.id}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border p-3 text-sm transition-colors hover:bg-muted"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{resource.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle>Mentor Connect</CardTitle>
              <CardDescription>Get personalised support</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Need help? Your Skill Competition Manager (SCM) and Chief Expert are
            here to support you. Don't hesitate to reach out with questions
            about your deliverables, timelines, or the assessment process.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <a href="mailto:">Contact Your Chief Expert</a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                Common questions from new advisors
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FAQAccordion items={FAQ_ITEMS} />
        </CardContent>
      </Card>
    </div>
  );
}

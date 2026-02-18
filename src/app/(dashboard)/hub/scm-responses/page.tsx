import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { getActiveQuestionsWithResponseSummary } from "../../settings/scm-questions-actions";

export default async function SCMResponsesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && user.role !== Role.SA && user.role !== Role.Secretariat) {
    redirect("/hub");
  }

  const questions = await getActiveQuestionsWithResponseSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">SCM Question Responses</h1>
        <p className="mt-2 text-muted-foreground">
          Track response progress for active SCM questions.
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No active questions. Create questions in{" "}
            <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
              Admin Settings
            </Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => {
            const percentage = question.totalSCMs > 0
              ? Math.round((question.responseCount / question.totalSCMs) * 100)
              : 0;

            return (
              <Link
                key={question.id}
                href={`/hub/scm-responses/${question.id}`}
                className="block rounded-lg border bg-card p-5 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-base">{question.question}</h2>
                    {question.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{question.description}</p>
                    ) : null}
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {question.responseCount} of {question.totalSCMs} SCMs responded
                    </span>
                    <span className="font-medium">{percentage}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

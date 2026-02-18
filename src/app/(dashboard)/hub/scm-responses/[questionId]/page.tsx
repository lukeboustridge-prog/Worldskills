import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Download } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { getQuestionWithResponses } from "../../../settings/scm-questions-actions";

export default async function SCMResponseDetailPage({
  params,
}: {
  params: { questionId: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && user.role !== Role.SA && user.role !== Role.Secretariat) {
    redirect("/hub");
  }

  const data = await getQuestionWithResponses(params.questionId);

  if (!data) {
    notFound();
  }

  const { question, responses, nonResponders, totalSCMs } = data;
  const responseCount = responses.length;
  const percentage = totalSCMs > 0 ? Math.round((responseCount / totalSCMs) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/hub/scm-responses"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to SCM Responses
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{question.question}</h1>
        {question.description ? (
          <p className="mt-2 text-muted-foreground">{question.description}</p>
        ) : null}
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="font-medium">
              {responseCount} of {totalSCMs} SCMs have responded
            </span>
            <a
              href={`/api/scm-responses/${params.questionId}/export`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          </div>
          <span className="font-medium">{percentage}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Responses ({responseCount})</h2>
        {responses.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No responses yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">User Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Skill(s)</th>
                  <th className="px-4 py-3 font-medium">Answer</th>
                  <th className="px-4 py-3 font-medium">Answered At</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((response) => (
                  <tr key={response.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {response.user.name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {response.user.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {response.user.skills.length > 0
                        ? response.user.skills.join(", ")
                        : "None"}
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="whitespace-pre-wrap">{response.answer}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(response.answeredAt), "dd MMM yyyy HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nonResponders.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Not Yet Responded ({nonResponders.length})</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Skill(s)</th>
                </tr>
              </thead>
              <tbody>
                {nonResponders.map((user) => (
                  <tr key={user.email} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {user.name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.skills.length > 0
                        ? user.skills.join(", ")
                        : "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

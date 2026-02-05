import { CPWVoteStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdminOrSecretariat } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionDetailPage({ params }: Props) {
  await requireAdminOrSecretariat();

  const { sessionId } = await params;

  const session = await prisma.cPWSession.findUnique({
    where: { id: sessionId },
    include: {
      votes: {
        include: {
          skill: {
            select: { name: true },
          },
        },
        orderBy: {
          skill: { name: "asc" },
        },
      },
    },
  });

  if (!session) {
    notFound();
  }

  const greenVotes = session.votes.filter((v) => v.status === CPWVoteStatus.GREEN);
  const redVotes = session.votes.filter((v) => v.status === CPWVoteStatus.RED);
  const totalVotes = session.votes.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/cpw/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{session.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {session.isActive ? "Active session" : "Ended"} - Created {format(session.createdAt, "PPp")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-4xl font-bold">{totalVotes}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Votes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-green-600">{greenVotes.length}</p>
              <p className="text-sm text-green-600 mt-1">On Track</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-red-600">{redVotes.length}</p>
              <p className="text-sm text-red-600 mt-1">Issues</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues */}
      {redVotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Issues Raised ({redVotes.length})
            </CardTitle>
            <CardDescription>
              Skills that reported issues during this session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {redVotes.map((vote) => (
                <div
                  key={vote.id}
                  className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4"
                >
                  <p className="font-semibold text-red-700 dark:text-red-400">
                    {vote.skill.name}
                  </p>
                  {vote.comment && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-300">
                      {vote.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* On Track */}
      {greenVotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              On Track ({greenVotes.length})
            </CardTitle>
            <CardDescription>
              Skills that reported being on track
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {greenVotes.map((vote) => (
                <div
                  key={vote.id}
                  className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3"
                >
                  <p className="font-medium text-green-700 dark:text-green-400">
                    {vote.skill.name}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No votes */}
      {totalVotes === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              No votes were recorded for this session.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Role } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateSAMeetingForm } from "./create-sa-meeting-form";

export default async function CreateSkillAdvisorMeetingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && user.role !== Role.Secretariat) {
    redirect("/hub/meetings");
  }

  // Get all Secretariat members for optional selection
  const secretariatUsers = await prisma.user.findMany({
    where: { role: Role.Secretariat },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/hub/meetings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Meetings
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Create Skill Advisor Meeting
        </h1>
        <p className="mt-2 text-muted-foreground">
          Schedule a meeting for all Skill Advisors (and optionally Secretariat members).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meeting Details</CardTitle>
          <CardDescription>
            All Skill Advisors will automatically receive an invitation email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateSAMeetingForm secretariatUsers={secretariatUsers} />
        </CardContent>
      </Card>
    </div>
  );
}

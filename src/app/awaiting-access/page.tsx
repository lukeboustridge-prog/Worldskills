import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export default async function AwaitingAccessPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.isAdmin || user.role !== Role.Pending) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <div className="w-full max-w-lg space-y-6 rounded-lg border bg-background p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Your access is pending</h1>
        <p className="text-sm text-muted-foreground">
          Thanks for creating an account. An administrator still needs to assign your competition role before you can view
          skills or deliverables. You&apos;ll gain access as soon as your permissions are approved.
        </p>
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm">
          Signed in as <span className="font-medium">{user.email}</span>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Contact an administrator to approve your access, or wait for an invitation email with your permissions.</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <SignOutButton />
          <Button variant="ghost" asChild>
            <a href="mailto:secretariat@worldskills.org">Email the Secretariat</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

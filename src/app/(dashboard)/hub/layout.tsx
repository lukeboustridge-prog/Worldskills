import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { HubNav } from "@/components/hub/hub-nav";
import { getCurrentUser } from "@/lib/auth";

export default async function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const canAccessHub =
    user.isAdmin || user.role === Role.SA || user.role === Role.Secretariat;

  if (!canAccessHub) {
    redirect("/dashboard");
  }

  return (
    <div className="flex gap-6">
      <HubNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}

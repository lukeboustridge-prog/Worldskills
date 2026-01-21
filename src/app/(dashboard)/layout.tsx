import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { NavLink } from "@/components/layout/nav-link";
import { getCurrentUser } from "@/lib/auth";
import { getUserDisplayName } from "@/lib/users";

const ROLE_LABELS: Record<Role, string> = {
  [Role.Pending]: "Pending access",
  [Role.SA]: "Skill Advisor",
  [Role.SCM]: "Skill Competition Manager",
  [Role.SkillTeam]: "Skill Team",
  [Role.Secretariat]: "Secretariat"
};

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && user.role === Role.Pending) {
    redirect("/awaiting-access");
  }

  const navItems: { href: string; label: string }[] = [];
  if (user.isAdmin || user.role === Role.Secretariat) {
    navItems.push({ href: "/dashboard", label: "Dashboard" });
  }
  if (
    user.isAdmin ||
    user.role === Role.SA ||
    user.role === Role.SCM ||
    user.role === Role.SkillTeam ||
    user.role === Role.Secretariat
  ) {
    navItems.push({ href: "/hub", label: "Skills Hub" });
  }
  if (user.isAdmin || user.role === Role.SA || user.role === Role.Secretariat) {
    navItems.push({ href: "/reports", label: "Reports" });
  }

  navItems.push({ href: "/instructions", label: "User guide" });
  navItems.push({ href: "/skills", label: "Skills" });

  if (user.isAdmin) {
    navItems.push({ href: "/settings", label: "Settings" });
    navItems.push({ href: "/storage-debug", label: "Storage debug" });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-3 text-lg font-semibold">
            <img src="/logo.png" alt="WorldSkills logo" className="h-8 w-auto" />
            <span>Worldskills Skill Tracker</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="font-medium text-foreground">{getUserDisplayName(user)}</p>
              <p className="uppercase text-xs text-muted-foreground">
                {ROLE_LABELS[user.role] ?? user.role}
                {user.isAdmin ? " · ADMIN" : ""}
              </p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <aside className="w-56 space-y-2">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </aside>
        <main className="flex-1 pb-12">{children}</main>
      </div>
    </div>
  );
}

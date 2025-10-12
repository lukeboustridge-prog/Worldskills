import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { NavLink } from "@/components/layout/nav-link";
import { getCurrentUser } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/skills", label: "Skills" }
];

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-semibold">
            WorldSkills Skill Advisor Tracker
          </Link>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="font-medium text-foreground">{user.name ?? user.email}</p>
              <p className="uppercase text-xs text-muted-foreground">{user.role}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <aside className="w-56 space-y-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </aside>
        <main className="flex-1 pb-12">{children}</main>
      </div>
    </div>
  );
}

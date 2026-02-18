"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CheckCircle,
  Book,
  Calendar,
  Sparkles,
  Library,
  Mail,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: typeof Home;
  highlighted?: boolean;
  roles?: string[];
};

const navItems: NavItem[] = [
  { href: "/hub", label: "Skills Hub", shortLabel: "Hub", icon: Home },
  { href: "/hub/qc", label: "Skills Matrix", shortLabel: "Matrix", icon: CheckCircle },
  { href: "/hub/kb", label: "Knowledge Base", shortLabel: "KB", icon: Book },
  { href: "/hub/descriptors", label: "Descriptor Library", shortLabel: "Descriptors", icon: Library },
  { href: "/hub/meetings", label: "Meetings", icon: Calendar },
  { href: "/hub/emails", label: "Emails", icon: Mail, roles: ["SA", "Secretariat"] },
  { href: "/hub/scm-responses", label: "SCM Responses", shortLabel: "Responses", icon: ClipboardList, roles: ["SA", "Secretariat"] },
  { href: "/hub/onboarding", label: "Getting Started", shortLabel: "Start", icon: Sparkles, highlighted: true },
];

interface HubNavProps {
  userRole?: string;
  isAdmin?: boolean;
}

export function HubNav({ userRole, isAdmin }: HubNavProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (isAdmin) return true;
    return userRole && item.roles.includes(userRole);
  });

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:block w-48 space-y-1 flex-shrink-0">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
                item.highlighted && !isActive && "text-amber-600 dark:text-amber-400"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile horizontal scrollable nav */}
      <nav className="md:hidden -mx-4 px-4 pb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                  item.highlighted && !isActive && "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.shortLabel || item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

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
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  highlighted?: boolean;
  roles?: string[];
};

const navItems: NavItem[] = [
  { href: "/hub", label: "Skills Hub", icon: Home },
  { href: "/hub/qc", label: "Skills Matrix", icon: CheckCircle },
  { href: "/hub/kb", label: "Knowledge Base", icon: Book },
  { href: "/hub/descriptors", label: "Descriptor Library", icon: Library },
  { href: "/hub/meetings", label: "Meetings", icon: Calendar },
  { href: "/hub/emails", label: "Emails", icon: Mail, roles: ["SA", "Secretariat"] },
  { href: "/hub/onboarding", label: "Getting Started", icon: Sparkles, highlighted: true },
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
    <nav className="w-48 space-y-1">
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
  );
}

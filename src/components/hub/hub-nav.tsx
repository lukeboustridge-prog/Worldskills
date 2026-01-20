"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CheckCircle,
  Book,
  Calendar,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/hub", label: "My Hub", icon: Home },
  { href: "/hub/qc", label: "Quality Control", icon: CheckCircle },
  { href: "/hub/kb", label: "Knowledge Base", icon: Book },
  { href: "/hub/meetings", label: "Meetings", icon: Calendar },
  { href: "/hub/onboarding", label: "New Advisors", icon: Sparkles, highlighted: true },
];

export function HubNav() {
  const pathname = usePathname();

  return (
    <nav className="w-48 space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
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

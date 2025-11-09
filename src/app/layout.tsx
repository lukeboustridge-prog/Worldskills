import type { Metadata } from "next";
import "./globals.css";

import { Inter } from "next/font/google";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { auth } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WorldSkills Skill Advisor Tracker",
  description:
    "Track WorldSkills deliverables, milestones, and conversations between Skill Advisors and Skill Competition Managers."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthSessionProvider session={session}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}

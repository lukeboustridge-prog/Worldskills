import type { Metadata, Viewport } from "next";
import "./globals.css";

import { Inter } from "next/font/google";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/toaster";
import { auth } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WorldSkills Skill Tracker",
  description:
    "Track WorldSkills deliverables, milestones, and conversations between Skill Advisors and Skill Competition Managers.",
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png"
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Skill Tracker"
  }
};

export const viewport: Viewport = {
  themeColor: "#2563eb"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthSessionProvider session={session}>
          {children}
          <Toaster />
        </AuthSessionProvider>
      </body>
    </html>
  );
}

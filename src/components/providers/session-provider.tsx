"use client";

import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  session: Session | null;
}

export function AuthSessionProvider({ children, session }: Props) {
  return (
    <SessionProvider session={session}>
      <NuqsAdapter>{children}</NuqsAdapter>
    </SessionProvider>
  );
}

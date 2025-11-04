import type { ReactNode } from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ApiNodeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}

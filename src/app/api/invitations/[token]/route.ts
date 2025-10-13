import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ success: false, error: "Invitation not found." }, { status: 404 });
  }

  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) {
    return NextResponse.json({ success: false, error: "Invitation not found." }, { status: 404 });
  }

  const now = new Date();
  if (invitation.acceptedAt) {
    return NextResponse.json({ success: false, error: "This invitation has already been used." }, { status: 410 });
  }

  if (invitation.expiresAt < now) {
    return NextResponse.json({ success: false, error: "This invitation has expired." }, { status: 410 });
  }

  return NextResponse.json({
    success: true,
    invitation: {
      name: invitation.name,
      email: invitation.email,
      role: invitation.role as Role,
      isAdmin: invitation.isAdmin,
      expiresAt: invitation.expiresAt
    }
  });
}

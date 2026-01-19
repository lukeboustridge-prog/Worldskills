import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long.")
});

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json(
      { valid: false, error: "Token is required." },
      { status: 400 }
    );
  }

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { email: true } } }
    });

    if (!resetToken) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired reset link." },
        { status: 404 }
      );
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { valid: false, error: "This reset link has already been used." },
        { status: 410 }
      );
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { valid: false, error: "This reset link has expired." },
        { status: 410 }
      );
    }

    return NextResponse.json(
      { valid: true, email: resetToken.user.email },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/auth/reset-password/[token] failed", error);
    return NextResponse.json(
      { valid: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Token is required." },
      { status: 400 }
    );
  }

  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const parsed = resetPasswordSchema.safeParse(parsedBody);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    return NextResponse.json(
      { success: false, error: firstIssue ?? "Enter a valid password." },
      { status: 400 }
    );
  }

  const { password } = parsed.data;

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token }
    });

    if (!resetToken) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired reset link." },
        { status: 404 }
      );
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { success: false, error: "This reset link has already been used." },
        { status: 410 }
      );
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "This reset link has expired." },
        { status: 410 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      })
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("POST /api/auth/reset-password/[token] failed", error);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

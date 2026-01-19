import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.")
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const parsed = forgotPasswordSchema.safeParse(parsedBody);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Always return success to prevent email enumeration
  const successResponse = NextResponse.json({ success: true }, { status: 200 });

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // If user doesn't exist, return success anyway to prevent enumeration
    if (!user) {
      return successResponse;
    }

    // Generate cryptographically secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Create password reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    // Send email
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
      userName: user.name ?? undefined
    });

    return successResponse;
  } catch (error) {
    console.error("POST /api/auth/forgot-password failed", error);

    // Still return success to prevent enumeration
    return successResponse;
  }
}

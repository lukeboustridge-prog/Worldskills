import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const setupPasswordSchema = z.object({
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
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token }
    });

    if (!verificationToken) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired setup link." },
        { status: 404 }
      );
    }

    if (verificationToken.expires < new Date()) {
      return NextResponse.json(
        { valid: false, error: "This setup link has expired." },
        { status: 410 }
      );
    }

    // Find user by email (identifier)
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier }
    });

    return NextResponse.json(
      {
        valid: true,
        email: verificationToken.identifier,
        name: user?.name ?? null
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/auth/setup-account/[token] failed", error);
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

  const parsed = setupPasswordSchema.safeParse(parsedBody);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    return NextResponse.json(
      { success: false, error: firstIssue ?? "Enter a valid password." },
      { status: 400 }
    );
  }

  const { password } = parsed.data;

  try {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token }
    });

    if (!verificationToken) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired setup link." },
        { status: 404 }
      );
    }

    if (verificationToken.expires < new Date()) {
      return NextResponse.json(
        { success: false, error: "This setup link has expired." },
        { status: 410 }
      );
    }

    // Find user by email (identifier)
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user password and delete token in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
      }),
      prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token
          }
        }
      })
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("POST /api/auth/setup-account/[token] failed", error);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/env";
import { prisma } from "@/lib/prisma";

const registrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address."),
  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters long."),
  token: z.string().optional()
});

const defaultHostEmail = "luke.boustridge@gmail.com";
const normalizedHostEmail = (env.HOST_EMAIL ?? defaultHostEmail).toLowerCase();

export const runtime = "nodejs";

export async function POST(request: Request) {
  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request payload."
      },
      { status: 400 }
    );
  }

  const parsed = registrationSchema.safeParse(parsedBody);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    return NextResponse.json(
      {
        success: false,
        error: firstIssue ?? "Enter a valid name, email, and password to continue."
      },
      { status: 400 }
    );
  }

  const { email, name, password, token } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "An account with that email already exists. Try signing in instead."
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let role: Role = normalizedEmail === normalizedHostEmail ? Role.SA : Role.Pending;
    let isAdmin = normalizedEmail === normalizedHostEmail;
    let invitation: Awaited<ReturnType<typeof prisma.invitation.findUnique>> | null = null;

    if (token) {
      try {
        invitation = await prisma.invitation.findUnique({ where: { token } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
          return NextResponse.json(
            {
              success: false,
              error: "Invitations are temporarily unavailable while the system updates. Please try again later."
            },
            { status: 503 }
          );
        }

        throw error;
      }
      if (!invitation) {
        return NextResponse.json(
          {
            success: false,
            error: "Invitation not found. Request a fresh invite from an administrator."
          },
          { status: 404 }
        );
      }

      if (invitation.acceptedAt) {
        return NextResponse.json(
          {
            success: false,
            error: "This invitation has already been used. Request a fresh invite from an administrator."
          },
          { status: 410 }
        );
      }

      if (invitation.expiresAt < new Date()) {
        return NextResponse.json(
          {
            success: false,
            error: "This invitation has expired. Request a new link to continue."
          },
          { status: 410 }
        );
      }

      if (invitation.email !== normalizedEmail) {
        return NextResponse.json(
          {
            success: false,
            error: "Use the email address your invitation was sent to."
          },
          { status: 400 }
        );
      }

      role = invitation.isAdmin ? Role.SA : invitation.role;
      isAdmin = invitation.isAdmin;
    }

    await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role,
        isAdmin
      }
    });

    if (invitation) {
      try {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
          // Invitation table disappeared mid-request; continue without failing user registration.
          console.warn("Invitation table missing during registration update", error);
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json(
      { success: true },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          error: "An account with that email already exists."
        },
        { status: 409 }
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: "We couldn't create your account right now. Please check your details and try again."
        },
        { status: 400 }
      );
    }

    console.error("POST /api/register failed", error);

    const genericMessage = "We couldn't create your account right now. Please try again.";
    const showDetailedError = process.env.NODE_ENV === "development" && error instanceof Error;

    return NextResponse.json(
      {
        success: false,
        error: showDetailedError ? error.message : genericMessage
      },
      { status: 500 }
    );
  }
}

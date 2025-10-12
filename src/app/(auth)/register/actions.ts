"use server";

import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
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
    .min(8, "Password must be at least 8 characters long.")
});

export type RegistrationState = {
  success: boolean;
  error?: string;
};

const initialState: RegistrationState = {
  success: false
};

const defaultHostEmail = "luke.boustridge@gmail.com";
const normalizedHostEmail = (env.HOST_EMAIL ?? defaultHostEmail).toLowerCase();

export async function registerUser(
  _prevState: RegistrationState,
  formData: FormData
): Promise<RegistrationState> {
  try {
    const parsed = registrationSchema.parse({
      name: typeof formData.get("name") === "string" ? formData.get("name") : "",
      email: typeof formData.get("email") === "string" ? formData.get("email") : "",
      password: typeof formData.get("password") === "string" ? formData.get("password") : ""
    });

    const { email, name, password } = parsed;
    const normalizedEmail = email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return {
        success: false,
        error: "An account with that email already exists. Try signing in instead."
      };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role: normalizedEmail === normalizedHostEmail ? Role.SA : Role.SCM
      }
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0]?.message ?? "Invalid registration details."
      };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002")
    ) {
      return {
        success: false,
        error: "An account with that email already exists."
      };
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return {
        success: false,
        error: "We couldn't create your account right now. Please check your details and try again."
      };
    }

    console.error("registerUser failed", error);

    const genericMessage = "We couldn't create your account right now. Please try again.";
    const showDetailedError = process.env.NODE_ENV === "development" && error instanceof Error;

    return {
      success: false,
      error: showDetailedError ? error.message : genericMessage
    };
  }
}

export { initialState as registrationInitialState };

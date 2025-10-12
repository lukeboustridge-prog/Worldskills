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
  password: z.string().min(8, "Password must be at least 8 characters long.")
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

function getFormValue(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

export async function registerUser(
  _prevState: RegistrationState,
  formData: FormData
): Promise<RegistrationState> {
  const parsed = registrationSchema.safeParse({
    name: getFormValue(formData, "name"),
    email: getFormValue(formData, "email"),
    password: getFormValue(formData, "password")
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid registration details."
    };
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.email === normalizedHostEmail ? Role.SA : Role.SCM
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        success: false,
        error: "An account with that email already exists."
      };
    }

    console.error("registerUser failed", error);

    return {
      success: false,
      error: "We couldn't create your account right now. Please try again."
    };
  }

  return {
    success: true
  };
}

export { initialState as registrationInitialState };

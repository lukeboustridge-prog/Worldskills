"use server";

import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { env } from "@/env";
import { prisma } from "@/lib/prisma";

const registrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long."),
  email: z.string().email("Enter a valid email address."),
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

export async function registerUser(
  _prevState: RegistrationState,
  formData: FormData
): Promise<RegistrationState> {
  const nameValue = formData.get("name");
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");

  const parsed = registrationSchema.safeParse({
    name: typeof nameValue === "string" ? nameValue.trim() : "",
    email: typeof emailValue === "string" ? emailValue.trim() : "",
    password: typeof passwordValue === "string" ? passwordValue : ""
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid registration details."
    };
  }

  const email = parsed.data.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    return {
      success: false,
      error: "An account with that email already exists."
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        role: email === normalizedHostEmail ? Role.SA : Role.SCM
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        success: false,
        error: "An account with that email already exists."
      };
    }

    throw error;
  }

  return {
    success: true
  };
}

export { initialState as registrationInitialState };

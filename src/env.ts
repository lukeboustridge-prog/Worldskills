import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string(),
  NEXTAUTH_URL: z.string().url().optional(),
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: z.string().optional()
});

export const env = serverSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  EMAIL_SERVER: process.env.EMAIL_SERVER,
  EMAIL_FROM: process.env.EMAIL_FROM
});

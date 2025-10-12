import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { Role } from "@prisma/client";
import nodemailer from "nodemailer";
import { type NextAuthOptions, getServerSession } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { env } from "@/env";
import { prisma } from "@/lib/prisma";

const transporter = env.EMAIL_SERVER ? nodemailer.createTransport(env.EMAIL_SERVER) : null;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    EmailProvider({
      name: "Email",
      from: env.EMAIL_FROM ?? "no-reply@example.com",
      async sendVerificationRequest({ identifier, url }) {
        if (!transporter || !env.EMAIL_FROM) {
          console.warn(
            `[Auth] EMAIL_SERVER or EMAIL_FROM missing. Magic link for ${identifier}: ${url}`
          );
          return;
        }

        await transporter.sendMail({
          to: identifier,
          from: env.EMAIL_FROM,
          subject: "Your WorldSkills Skill Advisor Tracker sign-in link",
          text: `Sign in to the WorldSkills Skill Advisor Tracker by clicking the link below.\n${url}`,
          html: `<p>Sign in to the WorldSkills Skill Advisor Tracker by clicking the link below.</p><p><a href="${url}">Sign in</a></p>`
        });
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? Role.SCM;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role) ?? Role.SCM;
        session.user.email = session.user.email ?? (token.email as string);
      }
      return session;
    }
  },
  events: {
    async createUser({ user }) {
      if (!user.role) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: Role.SCM }
        });
      }
    }
  }
};

export function auth() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User must be authenticated");
  }
  return user;
}

export function assertSA(role: Role) {
  if (role !== Role.SA) {
    throw new Error("Action restricted to Skill Advisors");
  }
}

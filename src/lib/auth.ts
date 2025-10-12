import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import { type NextAuthOptions, getServerSession } from "next-auth";

import { env } from "@/env";
import { prisma } from "@/lib/prisma";

const defaultHostEmail = "luke.boustridge@gmail.com";
const hostEmailValue = env.HOST_EMAIL ?? defaultHostEmail;
const normalizedHostEmail = hostEmailValue.toLowerCase();

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          throw new Error("Please provide an email and password.");
        }

        const email = credentials.email.toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email }
        });

        if (!user?.passwordHash) {
          throw new Error("Invalid email or password.");
        }

        const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!passwordValid) {
          throw new Error("Invalid email or password.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? Role.SCM;
        token.email = user.email;
        return token;
      }

      if (token.email) {
        const email = (token.email as string).toLowerCase();
        const dbUser = await prisma.user.findUnique({
          where: { email }
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.id = dbUser.id;
          token.email = dbUser.email;
        }
      }

      if (token.email && (token.email as string).toLowerCase() === normalizedHostEmail) {
        token.role = Role.SA;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role) ?? Role.SCM;
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
      }
      return session;
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

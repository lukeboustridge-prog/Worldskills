import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { Role } from "@prisma/client";
import nodemailer, { type Transporter } from "nodemailer";
import { type NextAuthOptions, getServerSession } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { env } from "@/env";
import { prisma } from "@/lib/prisma";

function createTransporter(): Transporter | null {
  if (env.EMAIL_SERVER) {
    return nodemailer.createTransport(env.EMAIL_SERVER);
  }

  if (env.EMAIL_SERVER_HOST) {
    const port = env.EMAIL_SERVER_PORT ? Number(env.EMAIL_SERVER_PORT) : undefined;
    const finalPort = port !== undefined && Number.isNaN(port) ? undefined : port;
    const secureString = env.EMAIL_SERVER_SECURE?.toLowerCase();
    const secure = secureString
      ? secureString === "true" || secureString === "1" || secureString === "yes"
      : finalPort === 465;

    return nodemailer.createTransport({
      host: env.EMAIL_SERVER_HOST,
      port: finalPort,
      secure,
      auth:
        env.EMAIL_SERVER_USER && env.EMAIL_SERVER_PASSWORD
          ? {
              user: env.EMAIL_SERVER_USER,
              pass: env.EMAIL_SERVER_PASSWORD
            }
          : undefined
    });
  }

  return null;
}

const transporter = createTransporter();

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
      from: env.EMAIL_FROM ?? "no-reply@example.com",
      async sendVerificationRequest({ identifier, url }) {
        if (!transporter || !env.EMAIL_FROM) {
          const message = `[Auth] EMAIL transport misconfigured. Magic link for ${identifier}: ${url}`;
          if (process.env.NODE_ENV === "production") {
            console.error(message);
            throw new Error("Email transport is not configured");
          }

          console.warn(message);
          return;
        }

        try {
          await transporter.sendMail({
            to: identifier,
            from: env.EMAIL_FROM,
            subject: "Your WorldSkills Skill Advisor Tracker sign-in link",
            text: `Sign in to the WorldSkills Skill Advisor Tracker by clicking the link below.\n${url}`,
            html: `<p>Sign in to the WorldSkills Skill Advisor Tracker by clicking the link below.</p><p><a href="${url}">Sign in</a></p>`
          });
        } catch (error) {
          console.error("[Auth] Failed to send magic link", error);
          throw new Error("Failed to send verification email");
        }
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

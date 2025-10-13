import { Role } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string;
      role: Role;
      isAdmin: boolean;
    };
  }

  interface User {
    role: Role;
    isAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    isAdmin?: boolean;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role: Role;
    isAdmin: boolean;
  }
}

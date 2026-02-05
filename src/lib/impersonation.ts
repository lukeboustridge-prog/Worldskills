import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const IMPERSONATION_COOKIE = "ws-impersonate";

interface ImpersonationData {
  originalAdminId: string;
  impersonatedUserId: string;
}

export async function getImpersonationData(): Promise<ImpersonationData | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(IMPERSONATION_COOKIE);

  if (!cookie?.value) {
    return null;
  }

  try {
    const data = JSON.parse(cookie.value) as ImpersonationData;
    if (data.originalAdminId && data.impersonatedUserId) {
      return data;
    }
  } catch {
    // Invalid cookie data
  }

  return null;
}

export async function setImpersonation(originalAdminId: string, impersonatedUserId: string) {
  const cookieStore = await cookies();
  const data: ImpersonationData = {
    originalAdminId,
    impersonatedUserId
  };

  cookieStore.set(IMPERSONATION_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4 // 4 hours
  });
}

export async function clearImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
}

export async function getImpersonatedUser() {
  const impersonation = await getImpersonationData();

  if (!impersonation) {
    return null;
  }

  const [originalAdmin, impersonatedUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: impersonation.originalAdminId },
      select: { id: true, isAdmin: true }
    }),
    prisma.user.findUnique({
      where: { id: impersonation.impersonatedUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isAdmin: true
      }
    })
  ]);

  // Verify original user is still an admin
  if (!originalAdmin?.isAdmin) {
    await clearImpersonation();
    return null;
  }

  if (!impersonatedUser) {
    await clearImpersonation();
    return null;
  }

  return {
    ...impersonatedUser,
    isImpersonating: true,
    originalAdminId: impersonation.originalAdminId
  };
}

import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface UserContext {
  id: string;
  role: Role;
  isAdmin: boolean;
}

/**
 * Get available Secretariat members for meeting attendee selection.
 * Returns all users with Role.Secretariat, ordered by name.
 * Used by UI when creating management meetings.
 */
export async function getSecretariatMembers() {
  return prisma.user.findMany({
    where: { role: Role.Secretariat },
    select: {
      id: true,
      name: true,
      email: true
    },
    orderBy: { name: "asc" }
  });
}

/**
 * Check if a meeting is a management meeting (not tied to a skill).
 */
export function isManagementMeeting(meeting: { skillId: string | null }): boolean {
  return meeting.skillId === null;
}

/**
 * Get meetings visible to a user based on their role.
 *
 * - Admin: all meetings
 * - SA: all management meetings + meetings for skills they advise
 * - SCM: meetings for skills they manage (no management meetings)
 * - Secretariat: only management meetings they're invited to
 * - SkillTeam: meetings for skills they're members of
 * - Pending/other: no meetings
 */
export async function getMeetingsForUser(user: UserContext) {
  // Admin sees everything
  if (user.isAdmin) {
    return prisma.meeting.findMany({
      include: {
        skill: { select: { id: true, name: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      },
      orderBy: { startTime: "desc" }
    });
  }

  // Skill Advisor: all management meetings + their skill meetings
  if (user.role === Role.SA) {
    const userSkills = await prisma.skill.findMany({
      where: { saId: user.id },
      select: { id: true }
    });
    const skillIds = userSkills.map(s => s.id);

    return prisma.meeting.findMany({
      where: {
        OR: [
          { skillId: null }, // All management meetings
          { skillId: { in: skillIds } } // Their skill meetings
        ]
      },
      include: {
        skill: { select: { id: true, name: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      },
      orderBy: { startTime: "desc" }
    });
  }

  // SCM: their skill meetings only (no management meetings)
  if (user.role === Role.SCM) {
    const userSkills = await prisma.skill.findMany({
      where: { scmId: user.id },
      select: { id: true }
    });
    const skillIds = userSkills.map(s => s.id);

    return prisma.meeting.findMany({
      where: { skillId: { in: skillIds } },
      include: {
        skill: { select: { id: true, name: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      },
      orderBy: { startTime: "desc" }
    });
  }

  // Secretariat: only management meetings they're invited to
  if (user.role === Role.Secretariat) {
    return prisma.meeting.findMany({
      where: {
        skillId: null,
        attendees: {
          some: { userId: user.id }
        }
      },
      include: {
        skill: { select: { id: true, name: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      },
      orderBy: { startTime: "desc" }
    });
  }

  // SkillTeam: their skill meetings only
  if (user.role === Role.SkillTeam) {
    const memberships = await prisma.skillMember.findMany({
      where: { userId: user.id },
      select: { skillId: true }
    });
    const skillIds = memberships.map(m => m.skillId);

    return prisma.meeting.findMany({
      where: { skillId: { in: skillIds } },
      include: {
        skill: { select: { id: true, name: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      },
      orderBy: { startTime: "desc" }
    });
  }

  // Pending users see nothing
  return [];
}

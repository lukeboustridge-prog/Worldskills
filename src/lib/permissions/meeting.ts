import { Role } from "@prisma/client";

interface User {
  id: string;
  isAdmin: boolean;
  role: Role;
}

interface Meeting {
  skillId: string | null;
}

interface Skill {
  saId: string;
  scmId?: string | null;
  teamMembers?: Array<{ userId: string }>;
}

/**
 * Check if user can create management meetings (skillId = null)
 * Only admins and Secretariat can create management meetings
 */
export function canCreateManagementMeeting(user: {
  isAdmin: boolean;
  role: Role;
}): boolean {
  return user.isAdmin || user.role === Role.Secretariat;
}

/**
 * Check if user can view a meeting
 * - Skill meetings: return true (existing skill permission logic applies elsewhere)
 * - Management meetings: SAs can view all, Secretariat only if attendee, admins always
 */
export function canViewMeeting(
  user: User,
  meeting: Meeting,
  attendeeUserIds?: string[]
): boolean {
  // For management meetings (skillId === null)
  if (meeting.skillId === null) {
    if (user.role === Role.SA) {
      return true; // All SAs can view management meetings
    }
    if (user.role === Role.Secretariat) {
      return attendeeUserIds?.includes(user.id) ?? false;
    }
    if (user.isAdmin) {
      return true;
    }
    return false;
  }

  // For skill meetings, return true (skill-level permissions apply elsewhere)
  return true;
}

/**
 * Check if user can manage/edit a meeting
 * - Management meetings: admins and Secretariat
 * - Skill meetings: admin, SA, SCM, or team member of that skill
 */
export function canManageMeeting(
  user: User,
  meeting: Meeting,
  skill?: Skill
): boolean {
  // For management meetings (skillId === null)
  if (meeting.skillId === null) {
    return user.isAdmin || user.role === Role.Secretariat;
  }

  // For skill meetings, check skill-specific permissions
  if (!skill) {
    // If no skill provided, we can't determine permissions - deny by default
    return false;
  }

  // Admin always has access
  if (user.isAdmin) {
    return true;
  }

  // SA of this skill
  if (skill.saId === user.id) {
    return true;
  }

  // SCM of this skill
  if (skill.scmId && skill.scmId === user.id) {
    return true;
  }

  // Team member of this skill
  if (skill.teamMembers?.some((member) => member.userId === user.id)) {
    return true;
  }

  return false;
}

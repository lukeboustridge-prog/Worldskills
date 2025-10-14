import { Role } from "@prisma/client";

export interface SkillAccessContext {
  saId: string;
  scmId: string | null;
}

export interface UserAccessContext {
  id: string;
  isAdmin: boolean;
  role: Role;
}

export function canManageSkill(user: UserAccessContext, skill: SkillAccessContext) {
  if (user.isAdmin) {
    return true;
  }

  if (user.id === skill.saId) {
    return true;
  }

  if (skill.scmId && user.id === skill.scmId) {
    return true;
  }

  return false;
}

export function canViewSkill(user: UserAccessContext, skill: SkillAccessContext) {
  if (canManageSkill(user, skill)) {
    return true;
  }

  if (user.role === Role.Secretariat) {
    return true;
  }

  return false;
}

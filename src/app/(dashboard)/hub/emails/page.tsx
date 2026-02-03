import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { EmailsClient } from "./emails-client";
import { getEmailsAction, getRecipientsAction, getSkillsForEmailAction } from "./actions";

export default async function EmailsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Only SA and Secretariat can access this page
  if (user.role !== Role.SA && user.role !== Role.Secretariat && !user.isAdmin) {
    redirect("/hub");
  }

  const [skillEmailsData, internalEmailsData, recipients, skills] = await Promise.all([
    getEmailsAction({ type: "SKILL_BROADCAST" }),
    getEmailsAction({ type: "INTERNAL" }),
    getRecipientsAction(),
    getSkillsForEmailAction(),
  ]);

  return (
    <EmailsClient
      initialSkillEmails={skillEmailsData}
      initialInternalEmails={internalEmailsData}
      recipients={recipients}
      skills={skills}
      currentUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      }}
    />
  );
}

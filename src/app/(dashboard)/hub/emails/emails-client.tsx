"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { EmailType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailList } from "./email-list";
import { ComposeEmailDialog } from "./compose-email-dialog";
import { getEmailsAction } from "./actions";

type EmailData = Awaited<ReturnType<typeof getEmailsAction>>;

interface Recipient {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface SkillMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Skill {
  id: string;
  name: string;
  sector: string | null;
  members: SkillMember[];
}

interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isAdmin: boolean;
}

interface EmailsClientProps {
  initialSkillEmails: EmailData;
  initialInternalEmails: EmailData;
  recipients: Recipient[];
  skills: Skill[];
  currentUser: CurrentUser;
}

export function EmailsClient({
  initialSkillEmails,
  initialInternalEmails,
  recipients,
  skills,
  currentUser,
}: EmailsClientProps) {
  const [skillEmails, setSkillEmails] = useState(initialSkillEmails);
  const [internalEmails, setInternalEmails] = useState(initialInternalEmails);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"skill" | "internal">("skill");

  const refreshEmails = async (type: EmailType) => {
    const data = await getEmailsAction({ type });
    if (type === EmailType.SKILL_BROADCAST) {
      setSkillEmails(data);
    } else {
      setInternalEmails(data);
    }
  };

  const handleEmailSent = () => {
    refreshEmails(activeTab === "skill" ? EmailType.SKILL_BROADCAST : EmailType.INTERNAL);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Emails</h1>
          <p className="mt-2 text-muted-foreground">
            Send and view emails to skills or internal team members.
          </p>
        </div>
        <Button onClick={() => setIsComposeOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Compose
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "skill" | "internal")}
      >
        <TabsList>
          <TabsTrigger value="skill">Skill Emails</TabsTrigger>
          <TabsTrigger value="internal">Internal Emails</TabsTrigger>
        </TabsList>

        <TabsContent value="skill" className="mt-6">
          <EmailList
            emails={skillEmails.emails}
            pagination={skillEmails.pagination}
            type="SKILL_BROADCAST"
            onPageChange={async (page) => {
              const data = await getEmailsAction({ type: EmailType.SKILL_BROADCAST, page });
              setSkillEmails(data);
            }}
            currentUserId={currentUser.id}
          />
        </TabsContent>

        <TabsContent value="internal" className="mt-6">
          <EmailList
            emails={internalEmails.emails}
            pagination={internalEmails.pagination}
            type="INTERNAL"
            onPageChange={async (page) => {
              const data = await getEmailsAction({ type: EmailType.INTERNAL, page });
              setInternalEmails(data);
            }}
            currentUserId={currentUser.id}
          />
        </TabsContent>
      </Tabs>

      <ComposeEmailDialog
        open={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        recipients={recipients}
        skills={skills}
        defaultTab={activeTab}
        onSent={handleEmailSent}
        currentUserId={currentUser.id}
      />
    </div>
  );
}

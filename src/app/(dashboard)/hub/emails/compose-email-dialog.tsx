"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillEmailForm } from "./skill-email-form";
import { InternalEmailForm } from "./internal-email-form";

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

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Recipient[];
  skills: Skill[];
  defaultTab: "skill" | "internal";
  onSent: () => void;
  currentUserId: string;
}

export function ComposeEmailDialog({
  open,
  onOpenChange,
  recipients,
  skills,
  defaultTab,
  onSent,
  currentUserId,
}: ComposeEmailDialogProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleSuccess = () => {
    onSent();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
          <DialogDescription>
            Send an email to skills or internal team members.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "skill" | "internal")}
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="skill">To Skills</TabsTrigger>
            <TabsTrigger value="internal">Internal</TabsTrigger>
          </TabsList>

          <TabsContent value="skill" className="mt-4">
            <SkillEmailForm skills={skills} currentUserId={currentUserId} onSuccess={handleSuccess} />
          </TabsContent>

          <TabsContent value="internal" className="mt-4">
            <InternalEmailForm recipients={recipients} onSuccess={handleSuccess} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

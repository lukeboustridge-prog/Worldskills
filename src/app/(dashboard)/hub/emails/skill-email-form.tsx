"use client";

import { useState, useTransition, useMemo } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentUploader, type UploadedAttachment } from "./attachment-uploader";
import { sendSkillEmailAction } from "./actions";

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

interface SkillEmailFormProps {
  skills: Skill[];
  currentUserId: string;
  onSuccess: () => void;
}

export function SkillEmailForm({ skills, currentUserId, onSuccess }: SkillEmailFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [selectAllSkills, setSelectAllSkills] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

  // Get all unique members across selected skills (excluding current user)
  const availableMembers = useMemo(() => {
    const memberMap = new Map<string, SkillMember & { skills: string[] }>();

    for (const skill of skills) {
      if (!selectedSkills.has(skill.id)) continue;

      for (const member of skill.members) {
        if (member.id === currentUserId) continue;

        const existing = memberMap.get(member.id);
        if (existing) {
          existing.skills.push(skill.name);
        } else {
          memberMap.set(member.id, { ...member, skills: [skill.name] });
        }
      }
    }

    return Array.from(memberMap.values());
  }, [skills, selectedSkills, currentUserId]);

  // Auto-select all members when skills change
  const handleSelectAllSkills = (checked: boolean) => {
    setSelectAllSkills(checked);
    if (checked) {
      const allSkillIds = new Set(skills.map((s) => s.id));
      setSelectedSkills(allSkillIds);
      // Select all members from all skills
      const allMemberIds = new Set<string>();
      for (const skill of skills) {
        for (const member of skill.members) {
          if (member.id !== currentUserId) {
            allMemberIds.add(member.id);
          }
        }
      }
      setSelectedMembers(allMemberIds);
    } else {
      setSelectedSkills(new Set());
      setSelectedMembers(new Set());
    }
  };

  const handleSkillToggle = (skillId: string) => {
    const newSelected = new Set(selectedSkills);
    const skill = skills.find((s) => s.id === skillId);

    if (newSelected.has(skillId)) {
      newSelected.delete(skillId);
      // Remove members that are only in this skill
      if (skill) {
        const newMembers = new Set(selectedMembers);
        for (const member of skill.members) {
          // Check if member is in any other selected skill
          const inOtherSkill = skills.some(
            (s) => s.id !== skillId && newSelected.has(s.id) && s.members.some((m) => m.id === member.id)
          );
          if (!inOtherSkill) {
            newMembers.delete(member.id);
          }
        }
        setSelectedMembers(newMembers);
      }
    } else {
      newSelected.add(skillId);
      // Add all members from this skill
      if (skill) {
        const newMembers = new Set(selectedMembers);
        for (const member of skill.members) {
          if (member.id !== currentUserId) {
            newMembers.add(member.id);
          }
        }
        setSelectedMembers(newMembers);
      }
    }

    setSelectedSkills(newSelected);
    setSelectAllSkills(newSelected.size === skills.length);
  };

  const handleMemberToggle = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const handleSelectAllMembers = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(new Set(availableMembers.map((m) => m.id)));
    } else {
      setSelectedMembers(new Set());
    }
  };

  const toggleSkillExpanded = (skillId: string) => {
    const newExpanded = new Set(expandedSkills);
    if (newExpanded.has(skillId)) {
      newExpanded.delete(skillId);
    } else {
      newExpanded.add(skillId);
    }
    setExpandedSkills(newExpanded);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedSkills.size === 0) {
      setError("Select at least one skill");
      return;
    }

    if (selectedMembers.size === 0) {
      setError("Select at least one recipient");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("skillIds", JSON.stringify(Array.from(selectedSkills)));
        formData.set("selectedRecipientIds", JSON.stringify(Array.from(selectedMembers)));
        formData.set("subject", subject);
        formData.set("body", body);
        formData.set("attachments", JSON.stringify(attachments));

        const result = await sendSkillEmailAction(formData);

        if (result.success) {
          onSuccess();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send email");
      }
    });
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "SA":
        return "bg-blue-100 text-blue-800";
      case "SCM":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const allMembersSelected = availableMembers.length > 0 && selectedMembers.size === availableMembers.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label>Select Skills</Label>
        <div className="rounded-md border p-4 max-h-48 overflow-y-auto space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              id="select-all-skills"
              checked={selectAllSkills}
              onCheckedChange={(checked) => handleSelectAllSkills(checked === true)}
            />
            <label
              htmlFor="select-all-skills"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Select All Skills ({skills.length})
            </label>
          </div>
          {skills.map((skill) => (
            <div key={skill.id} className="space-y-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`skill-${skill.id}`}
                  checked={selectedSkills.has(skill.id)}
                  onCheckedChange={() => handleSkillToggle(skill.id)}
                />
                <button
                  type="button"
                  onClick={() => toggleSkillExpanded(skill.id)}
                  className="flex items-center gap-1 text-sm leading-none hover:text-primary"
                >
                  {expandedSkills.has(skill.id) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
                <label
                  htmlFor={`skill-${skill.id}`}
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {skill.name}
                  {skill.sector && (
                    <span className="text-muted-foreground ml-2">({skill.sector})</span>
                  )}
                  <span className="text-muted-foreground ml-2">
                    - {skill.members.filter((m) => m.id !== currentUserId).length} members
                  </span>
                </label>
              </div>
              {expandedSkills.has(skill.id) && (
                <div className="ml-8 pl-2 border-l space-y-1 text-xs text-muted-foreground">
                  {skill.members
                    .filter((m) => m.id !== currentUserId)
                    .map((member) => (
                      <div key={member.id} className="flex items-center gap-2">
                        <span>{member.name ?? member.email}</span>
                        <span className={`px-1 py-0.5 rounded text-[10px] ${getRoleBadgeClass(member.role)}`}>
                          {member.role}
                        </span>
                      </div>
                    ))}
                  {skill.members.filter((m) => m.id !== currentUserId).length === 0 && (
                    <span>No other members</span>
                  )}
                </div>
              )}
            </div>
          ))}
          {skills.length === 0 && (
            <p className="text-sm text-muted-foreground">No skills available</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedSkills.size} skill{selectedSkills.size !== 1 ? "s" : ""} selected
        </p>
      </div>

      {selectedSkills.size > 0 && (
        <div className="space-y-2">
          <Label>Select Recipients</Label>
          <div className="rounded-md border p-4 max-h-48 overflow-y-auto space-y-2">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox
                id="select-all-members"
                checked={allMembersSelected}
                onCheckedChange={(checked) => handleSelectAllMembers(checked === true)}
              />
              <label
                htmlFor="select-all-members"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Select All Recipients ({availableMembers.length})
              </label>
            </div>
            {availableMembers.map((member) => (
              <div key={member.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`member-${member.id}`}
                  checked={selectedMembers.has(member.id)}
                  onCheckedChange={() => handleMemberToggle(member.id)}
                />
                <label
                  htmlFor={`member-${member.id}`}
                  className="flex items-center gap-2 text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  <span>{member.name ?? member.email}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadgeClass(member.role)}`}>
                    {member.role}
                  </span>
                  {member.skills.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      ({member.skills.length} skills)
                    </span>
                  )}
                </label>
              </div>
            ))}
            {availableMembers.length === 0 && (
              <p className="text-sm text-muted-foreground">No recipients available for selected skills</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedMembers.size} recipient{selectedMembers.size !== 1 ? "s" : ""} selected
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="skill-subject">Subject</Label>
        <Input
          id="skill-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject"
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-body">Message</Label>
        <Textarea
          id="skill-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Enter your message"
          required
          rows={6}
        />
      </div>

      <AttachmentUploader
        attachments={attachments}
        onAttachmentsChange={setAttachments}
      />

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isPending || selectedMembers.size === 0}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send to {selectedMembers.size} Recipient{selectedMembers.size !== 1 ? "s" : ""}
        </Button>
      </div>
    </form>
  );
}

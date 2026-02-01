"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createManagementMeetingAction } from "@/app/(dashboard)/management-meeting-actions";

interface SecretariatUser {
  id: string;
  name: string | null;
  email: string;
}

export function CreateSAMeetingForm({ secretariatUsers }: { secretariatUsers: SecretariatUser[] }) {
  const [selectedSecretariat, setSelectedSecretariat] = useState<string[]>([]);

  const handleCheckboxChange = (userId: string) => {
    setSelectedSecretariat((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (formData: FormData) => {
    formData.set("secretariatAttendeeIds", JSON.stringify(selectedSecretariat));
    await createManagementMeetingAction(formData);
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Meeting Title</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="e.g., Monthly Skill Advisor Check-in"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startTime">Start Date & Time</Label>
          <Input
            id="startTime"
            name="startTime"
            type="datetime-local"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endTime">End Date & Time</Label>
          <Input
            id="endTime"
            name="endTime"
            type="datetime-local"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meetingLink">Meeting Link (optional)</Label>
        <Input
          id="meetingLink"
          name="meetingLink"
          type="url"
          placeholder="https://zoom.us/j/..."
        />
        <p className="text-xs text-muted-foreground">
          Video conference link (Zoom, Teams, etc.)
        </p>
      </div>

      {secretariatUsers.length > 0 && (
        <div className="space-y-2">
          <Label>Also Invite Secretariat Members (optional)</Label>
          <div className="space-y-2 rounded-md border p-4">
            {secretariatUsers.map((secretariat) => (
              <div key={secretariat.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`secretariat-${secretariat.id}`}
                  checked={selectedSecretariat.includes(secretariat.id)}
                  onChange={() => handleCheckboxChange(secretariat.id)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label
                  htmlFor={`secretariat-${secretariat.id}`}
                  className="font-normal"
                >
                  {secretariat.name ?? secretariat.email}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Selected Secretariat members will receive meeting invitations.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit">Create Meeting</Button>
        <Button asChild variant="outline">
          <Link href="/hub/meetings">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

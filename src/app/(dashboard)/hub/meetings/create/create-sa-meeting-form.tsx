"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createManagementMeetingAction } from "@/app/(dashboard)/management-meeting-actions";

interface SecretariatUser {
  id: string;
  name: string | null;
  email: string;
}

interface PendingGuest {
  id: string;
  name: string;
  email: string;
}

export function CreateSAMeetingForm({ secretariatUsers }: { secretariatUsers: SecretariatUser[] }) {
  const [selectedSecretariat, setSelectedSecretariat] = useState<string[]>([]);
  const [pendingGuests, setPendingGuests] = useState<PendingGuest[]>([]);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestError, setGuestError] = useState<string | null>(null);

  const handleCheckboxChange = (userId: string) => {
    setSelectedSecretariat((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddGuest = () => {
    setGuestError(null);

    if (!guestName.trim()) {
      setGuestError("Please enter a name for the guest.");
      return;
    }

    if (!guestEmail.trim()) {
      setGuestError("Please enter an email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      setGuestError("Please enter a valid email address.");
      return;
    }

    const newGuest: PendingGuest = {
      id: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: guestName.trim(),
      email: guestEmail.trim().toLowerCase()
    };

    setPendingGuests((prev) => [...prev, newGuest]);
    setGuestName("");
    setGuestEmail("");
    setShowGuestForm(false);
  };

  const handleRemoveGuest = (id: string) => {
    setPendingGuests((prev) => prev.filter((guest) => guest.id !== id));
  };

  const handleSubmit = async (formData: FormData) => {
    formData.set("secretariatAttendeeIds", JSON.stringify(selectedSecretariat));
    if (pendingGuests.length > 0) {
      formData.set(
        "guests",
        JSON.stringify(pendingGuests.map((guest) => ({ name: guest.name, email: guest.email })))
      );
    }
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

      {/* External Guests */}
      <div className="space-y-2">
        <Label>Invite external guests (optional)</Label>
        <div className="rounded-md border p-4 space-y-3">
          {pendingGuests.length > 0 ? (
            <ul className="space-y-1">
              {pendingGuests.map((guest) => (
                <li key={guest.id} className="flex items-center justify-between text-sm">
                  <span>{guest.name} ({guest.email})</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveGuest(guest.id)}
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No external guests added.</p>
          )}
          {showGuestForm ? (
            <div className="space-y-2 rounded border p-2">
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Guest name"
                className="h-8 text-sm"
              />
              <Input
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="guest@example.com"
                type="email"
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={handleAddGuest}>
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowGuestForm(false);
                    setGuestName("");
                    setGuestEmail("");
                    setGuestError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowGuestForm(true)}
            >
              Add Guest
            </Button>
          )}
          {guestError ? (
            <p className="text-sm text-destructive">{guestError}</p>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          External guests receive email invitations but don&apos;t need system access.
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit">Create Meeting</Button>
        <Button asChild variant="outline">
          <Link href="/hub/meetings">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

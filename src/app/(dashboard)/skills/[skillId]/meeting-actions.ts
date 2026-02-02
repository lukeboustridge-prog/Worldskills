"use server";

import { Role, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { sendMeetingInvitation } from "@/lib/email/meeting-invitation";
import { prisma } from "@/lib/prisma";
import { deleteStoredObject } from "@/lib/storage/client";

export interface MeetingDocument {
  id: string;
  fileName: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface MeetingLink {
  id: string;
  label: string;
  url: string;
  addedAt: string;
}

function createId() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function normaliseMeetingDocuments(value: Prisma.JsonValue | null | undefined): MeetingDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : null;
      const fileName = typeof record.fileName === "string" ? record.fileName : null;
      const storageKey = typeof record.storageKey === "string" ? record.storageKey : null;
      const fileSize = typeof record.fileSize === "number" ? record.fileSize : 0;
      const mimeType = typeof record.mimeType === "string" ? record.mimeType : "application/octet-stream";
      const uploadedAt = typeof record.uploadedAt === "string" ? record.uploadedAt : new Date().toISOString();

      if (!id || !fileName || !storageKey) {
        return null;
      }

      return { id, fileName, storageKey, fileSize, mimeType, uploadedAt };
    })
    .filter((item): item is MeetingDocument => item !== null);
}

function normaliseMeetingLinks(value: Prisma.JsonValue | null | undefined): MeetingLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : null;
      const label = typeof record.label === "string" ? record.label : null;
      const url = typeof record.url === "string" ? record.url : null;
      const addedAt = typeof record.addedAt === "string" ? record.addedAt : new Date().toISOString();

      if (!id || !label || !url) {
        return null;
      }

      return { id, label, url, addedAt };
    })
    .filter((item): item is MeetingLink => item !== null);
}

function serialiseMeetingDocuments(docs: MeetingDocument[]): Prisma.InputJsonValue {
  return docs.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    storageKey: doc.storageKey,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    uploadedAt: doc.uploadedAt,
  })) as Prisma.InputJsonArray;
}

function serialiseMeetingLinks(links: MeetingLink[]): Prisma.InputJsonValue {
  return links.map((link) => ({
    id: link.id,
    label: link.label,
    url: link.url,
    addedAt: link.addedAt,
  })) as Prisma.InputJsonArray;
}

async function ensureSkill(skillId: string) {
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    include: {
      sa: true,
      scm: true,
      teamMembers: { select: { userId: true } }
    }
  });
  if (!skill) {
    throw new Error("Skill not found");
  }
  return skill;
}

function revalidateSkill(skillId: string) {
  revalidatePath(`/skills/${skillId}`);
}

function canScheduleMeeting(
  user: { id: string; role: Role; isAdmin: boolean },
  skill: { saId: string; scmId: string | null; teamMembers: { userId: string }[] }
): boolean {
  if (user.isAdmin) return true;
  if (user.id === skill.saId) return true;
  if (skill.scmId && user.id === skill.scmId) return true;
  if (skill.teamMembers.some((member) => member.userId === user.id)) return true;
  return false;
}

const scheduleMeetingSchema = z.object({
  skillId: z.string().min(1),
  title: z.string().min(2, "Title must be at least 2 characters"),
  startTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid start time"
  }),
  endTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid end time"
  }),
  meetingLink: z.string().url().optional().or(z.literal("")),
  initialLinks: z.string().optional(),
  initialDocuments: z.string().optional(),
  attendeeIds: z.string().optional(),
  guests: z.string().optional()
});

interface InitialDocument {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface InitialLink {
  label: string;
  url: string;
}

function parseInitialDocuments(json: string | undefined): MeetingDocument[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((doc: InitialDocument) => ({
      id: createId(),
      fileName: doc.fileName,
      storageKey: doc.storageKey,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      uploadedAt: new Date().toISOString()
    }));
  } catch {
    return [];
  }
}

function parseInitialLinks(json: string | undefined): MeetingLink[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((link: InitialLink) => ({
      id: createId(),
      label: link.label,
      url: link.url,
      addedAt: new Date().toISOString()
    }));
  } catch {
    return [];
  }
}

interface GuestInput {
  name: string;
  email: string;
}

function parseGuests(json: string | undefined): GuestInput[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (g: unknown): g is GuestInput =>
        typeof g === "object" &&
        g !== null &&
        typeof (g as GuestInput).name === "string" &&
        typeof (g as GuestInput).email === "string"
    );
  } catch {
    return [];
  }
}

function parseAttendeeIds(json: string | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export async function scheduleMeetingAction(formData: FormData) {
  const user = await requireUser();

  const parsed = scheduleMeetingSchema.safeParse({
    skillId: formData.get("skillId"),
    title: formData.get("title"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    meetingLink: formData.get("meetingLink") || "",
    initialLinks: formData.get("initialLinks") || undefined,
    initialDocuments: formData.get("initialDocuments") || undefined,
    attendeeIds: formData.get("attendeeIds") || undefined,
    guests: formData.get("guests") || undefined
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);

  if (!canScheduleMeeting(user, skill)) {
    throw new Error("You do not have permission to schedule meetings for this skill");
  }

  const startTime = new Date(parsed.data.startTime);
  const endTime = new Date(parsed.data.endTime);

  if (endTime <= startTime) {
    throw new Error("End time must be after start time");
  }

  const initialDocuments = parseInitialDocuments(parsed.data.initialDocuments);
  const initialLinks = parseInitialLinks(parsed.data.initialLinks);
  const attendeeIds = parseAttendeeIds(parsed.data.attendeeIds);
  const guests = parseGuests(parsed.data.guests);

  const meeting = await prisma.meeting.create({
    data: {
      skillId: skill.id,
      title: parsed.data.title,
      startTime,
      endTime,
      meetingLink: parsed.data.meetingLink || null,
      documents: serialiseMeetingDocuments(initialDocuments),
      links: serialiseMeetingLinks(initialLinks)
    }
  });

  // Create MeetingAttendee records for selected team members
  if (attendeeIds.length > 0) {
    await prisma.meetingAttendee.createMany({
      data: attendeeIds.map((userId) => ({
        meetingId: meeting.id,
        userId,
        addedBy: user.id
      }))
    });
  }

  // Create MeetingGuest records for external guests
  if (guests.length > 0) {
    await prisma.meetingGuest.createMany({
      data: guests.map((guest) => ({
        meetingId: meeting.id,
        name: guest.name,
        email: guest.email,
        addedBy: user.id
      }))
    });
  }

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "MeetingScheduled",
    payload: {
      meetingId: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime.toISOString(),
      endTime: meeting.endTime.toISOString(),
      attendeeCount: attendeeIds.length,
      guestCount: guests.length
    }
  });

  // Send email invitations to selected attendees and guests
  try {
    const recipientEmails: string[] = [];

    // Get emails of selected attendees
    if (attendeeIds.length > 0) {
      const attendees = await prisma.user.findMany({
        where: { id: { in: attendeeIds } },
        select: { email: true }
      });
      recipientEmails.push(...attendees.map((a) => a.email));
    }

    // Add guest emails
    recipientEmails.push(...guests.map((g) => g.email));

    if (recipientEmails.length > 0) {
      await sendMeetingInvitation({
        to: recipientEmails,
        meeting: {
          title: meeting.title,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          meetingLink: meeting.meetingLink,
          skillName: skill.name
        }
      });
    }
  } catch (error) {
    console.error("Failed to send meeting invitation", {
      meetingId: meeting.id,
      skillId: skill.id,
      error
    });
  }

  revalidateSkill(skill.id);

  return { success: true, meetingId: meeting.id };
}

const updateMeetingMinutesSchema = z.object({
  meetingId: z.string().min(1),
  skillId: z.string().min(1),
  minutes: z.string().optional(),
  actionPoints: z.string().optional()
});

export async function updateMeetingMinutesAction(formData: FormData) {
  const user = await requireUser();

  const parsed = updateMeetingMinutesSchema.safeParse({
    meetingId: formData.get("meetingId"),
    skillId: formData.get("skillId"),
    minutes: formData.get("minutes") || "",
    actionPoints: formData.get("actionPoints") || ""
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);

  if (!canScheduleMeeting(user, skill)) {
    throw new Error("You do not have permission to update meeting minutes for this skill");
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parsed.data.meetingId }
  });

  if (!meeting || meeting.skillId !== skill.id) {
    throw new Error("Meeting not found");
  }

  await prisma.meeting.update({
    where: { id: parsed.data.meetingId },
    data: {
      minutes: parsed.data.minutes || null,
      actionPoints: parsed.data.actionPoints || null
    }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "MeetingMinutesUpdated",
    payload: {
      meetingId: meeting.id,
      title: meeting.title
    }
  });

  revalidateSkill(skill.id);

  return { success: true };
}

const deleteMeetingSchema = z.object({
  meetingId: z.string().min(1),
  skillId: z.string().min(1)
});

export async function deleteMeetingAction(formData: FormData) {
  const user = await requireUser();

  const parsed = deleteMeetingSchema.safeParse({
    meetingId: formData.get("meetingId"),
    skillId: formData.get("skillId")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);

  if (!canScheduleMeeting(user, skill)) {
    throw new Error("You do not have permission to delete meetings for this skill");
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parsed.data.meetingId }
  });

  if (!meeting || meeting.skillId !== skill.id) {
    throw new Error("Meeting not found");
  }

  await prisma.meeting.delete({
    where: { id: parsed.data.meetingId }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "MeetingDeleted",
    payload: {
      meetingId: meeting.id,
      title: meeting.title
    }
  });

  revalidateSkill(skill.id);

  return { success: true };
}

// Document Actions

const addMeetingDocumentSchema = z.object({
  meetingId: z.string().min(1),
  skillId: z.string().min(1),
  storageKey: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1)
});

export async function addMeetingDocumentAction(
  meetingId: string,
  fileData: { storageKey: string; fileName: string; fileSize: number; mimeType: string },
  skillId: string
) {
  const user = await requireUser();

  const parsed = addMeetingDocumentSchema.safeParse({
    meetingId,
    skillId,
    ...fileData
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);

  if (!canScheduleMeeting(user, skill)) {
    throw new Error("You do not have permission to add documents to this meeting");
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parsed.data.meetingId }
  });

  if (!meeting || meeting.skillId !== skill.id) {
    throw new Error("Meeting not found");
  }

  const existingDocuments = normaliseMeetingDocuments(meeting.documents);
  const newDocument: MeetingDocument = {
    id: createId(),
    fileName: parsed.data.fileName,
    storageKey: parsed.data.storageKey,
    fileSize: parsed.data.fileSize,
    mimeType: parsed.data.mimeType,
    uploadedAt: new Date().toISOString()
  };

  const updatedDocuments = [...existingDocuments, newDocument];

  await prisma.meeting.update({
    where: { id: parsed.data.meetingId },
    data: {
      documents: serialiseMeetingDocuments(updatedDocuments)
    }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "MeetingDocumentAdded",
    payload: {
      meetingId: meeting.id,
      documentId: newDocument.id,
      fileName: newDocument.fileName
    }
  });

  revalidateSkill(skill.id);

  return { success: true, documentId: newDocument.id };
}

const deleteMeetingDocumentSchema = z.object({
  meetingId: z.string().min(1),
  skillId: z.string().min(1),
  docId: z.string().min(1)
});

export async function deleteMeetingDocumentAction(
  meetingId: string,
  docId: string,
  skillId: string
) {
  const user = await requireUser();

  const parsed = deleteMeetingDocumentSchema.safeParse({
    meetingId,
    skillId,
    docId
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);

  if (!canScheduleMeeting(user, skill)) {
    throw new Error("You do not have permission to delete documents from this meeting");
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parsed.data.meetingId }
  });

  if (!meeting || meeting.skillId !== skill.id) {
    throw new Error("Meeting not found");
  }

  const existingDocuments = normaliseMeetingDocuments(meeting.documents);
  const documentToDelete = existingDocuments.find((doc) => doc.id === parsed.data.docId);

  if (!documentToDelete) {
    throw new Error("Document not found");
  }

  const updatedDocuments = existingDocuments.filter((doc) => doc.id !== parsed.data.docId);

  await prisma.meeting.update({
    where: { id: parsed.data.meetingId },
    data: {
      documents: serialiseMeetingDocuments(updatedDocuments)
    }
  });

  // Delete from storage
  try {
    await deleteStoredObject(documentToDelete.storageKey);
  } catch (error) {
    console.error("Failed to delete document from storage", error);
  }

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "MeetingDocumentDeleted",
    payload: {
      meetingId: meeting.id,
      documentId: documentToDelete.id,
      fileName: documentToDelete.fileName
    }
  });

  revalidateSkill(skill.id);

  return { success: true };
}

// Link Actions

const addMeetingLinkSchema = z.object({
  meetingId: z.string().min(1),
  skillId: z.string().min(1),
  label: z.string().min(1, "Label is required"),
  url: z.string().url("Invalid URL")
});

export async function addMeetingLinkAction(
  meetingId: string,
  linkData: { label: string; url: string },
  skillId: string
) {
  const user = await requireUser();

  const parsed = addMeetingLinkSchema.safeParse({
    meetingId,
    skillId,
    ...linkData
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);

  if (!canScheduleMeeting(user, skill)) {
    throw new Error("You do not have permission to add links to this meeting");
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parsed.data.meetingId }
  });

  if (!meeting || meeting.skillId !== skill.id) {
    throw new Error("Meeting not found");
  }

  const existingLinks = normaliseMeetingLinks(meeting.links);
  const newLink: MeetingLink = {
    id: createId(),
    label: parsed.data.label,
    url: parsed.data.url,
    addedAt: new Date().toISOString()
  };

  const updatedLinks = [...existingLinks, newLink];

  await prisma.meeting.update({
    where: { id: parsed.data.meetingId },
    data: {
      links: serialiseMeetingLinks(updatedLinks)
    }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "MeetingLinkAdded",
    payload: {
      meetingId: meeting.id,
      linkId: newLink.id,
      label: newLink.label,
      url: newLink.url
    }
  });

  revalidateSkill(skill.id);

  return { success: true, linkId: newLink.id };
}

const removeMeetingLinkSchema = z.object({
  meetingId: z.string().min(1),
  skillId: z.string().min(1),
  linkId: z.string().min(1)
});

export async function removeMeetingLinkAction(
  meetingId: string,
  linkId: string,
  skillId: string
) {
  const user = await requireUser();

  const parsed = removeMeetingLinkSchema.safeParse({
    meetingId,
    skillId,
    linkId
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const skill = await ensureSkill(parsed.data.skillId);

  if (!canScheduleMeeting(user, skill)) {
    throw new Error("You do not have permission to remove links from this meeting");
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parsed.data.meetingId }
  });

  if (!meeting || meeting.skillId !== skill.id) {
    throw new Error("Meeting not found");
  }

  const existingLinks = normaliseMeetingLinks(meeting.links);
  const linkToDelete = existingLinks.find((link) => link.id === parsed.data.linkId);

  if (!linkToDelete) {
    throw new Error("Link not found");
  }

  const updatedLinks = existingLinks.filter((link) => link.id !== parsed.data.linkId);

  await prisma.meeting.update({
    where: { id: parsed.data.meetingId },
    data: {
      links: serialiseMeetingLinks(updatedLinks)
    }
  });

  await logActivity({
    skillId: skill.id,
    userId: user.id,
    action: "MeetingLinkRemoved",
    payload: {
      meetingId: meeting.id,
      linkId: linkToDelete.id,
      label: linkToDelete.label
    }
  });

  revalidateSkill(skill.id);

  return { success: true };
}

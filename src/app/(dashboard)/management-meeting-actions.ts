"use server";

import { Role, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { sendMeetingInvitation } from "@/lib/email/meeting-invitation";
import { canCreateManagementMeeting, canManageMeeting } from "@/lib/permissions/meeting";
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

const createManagementMeetingSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  startTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid start time"
  }),
  endTime: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid end time"
  }),
  meetingLink: z.string().url().optional().or(z.literal("")),
  secretariatAttendeeIds: z.string(), // JSON array of user IDs
  initialDocuments: z.string().optional(),
  initialLinks: z.string().optional()
});

export async function createManagementMeetingAction(formData: FormData) {
  const user = await requireUser();

  if (!canCreateManagementMeeting(user)) {
    throw new Error("Only Admins and Secretariat can create management meetings");
  }

  const parsed = createManagementMeetingSchema.safeParse({
    title: formData.get("title"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    meetingLink: formData.get("meetingLink") || "",
    secretariatAttendeeIds: formData.get("secretariatAttendeeIds"),
    initialDocuments: formData.get("initialDocuments") || undefined,
    initialLinks: formData.get("initialLinks") || undefined
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const startTime = new Date(parsed.data.startTime);
  const endTime = new Date(parsed.data.endTime);

  if (endTime <= startTime) {
    throw new Error("End time must be after start time");
  }

  const secretariatAttendeeIds = JSON.parse(parsed.data.secretariatAttendeeIds) as string[];

  // Fetch all SAs
  const allSAs = await prisma.user.findMany({
    where: { role: Role.SA }
  });

  // Fetch selected Secretariat members
  const selectedSecretariat = await prisma.user.findMany({
    where: {
      id: { in: secretariatAttendeeIds },
      role: Role.Secretariat
    }
  });

  const initialDocuments = parseInitialDocuments(parsed.data.initialDocuments);
  const initialLinks = parseInitialLinks(parsed.data.initialLinks);

  const meeting = await prisma.meeting.create({
    data: {
      skillId: null,
      title: parsed.data.title,
      startTime,
      endTime,
      meetingLink: parsed.data.meetingLink || null,
      documents: serialiseMeetingDocuments(initialDocuments),
      links: serialiseMeetingLinks(initialLinks)
    }
  });

  // Create MeetingAttendee records for selected Secretariat members ONLY
  if (secretariatAttendeeIds.length > 0) {
    await prisma.meetingAttendee.createMany({
      data: secretariatAttendeeIds.map((userId) => ({
        meetingId: meeting.id,
        userId
      }))
    });
  }

  // Send email to all SAs + selected Secretariat
  const recipientEmails: string[] = [
    ...allSAs.map(sa => sa.email),
    ...selectedSecretariat.map(s => s.email)
  ].filter(Boolean);

  if (recipientEmails.length > 0) {
    await sendMeetingInvitation({
      to: recipientEmails,
      meeting: {
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        meetingLink: meeting.meetingLink,
        skillName: null,
        meetingType: "management"
      }
    });
  }

  await logActivity({
    skillId: null,
    userId: user.id,
    action: "ManagementMeetingCreated",
    payload: {
      meetingId: meeting.id,
      title: meeting.title,
      attendeeCount: secretariatAttendeeIds.length
    }
  });

  revalidatePath("/meetings");
  revalidatePath("/hub/meetings");

  return { success: true, meetingId: meeting.id };
}

const updateManagementMeetingMinutesSchema = z.object({
  meetingId: z.string().min(1),
  minutes: z.string().optional(),
  actionPoints: z.string().optional()
});

export async function updateManagementMeetingMinutesAction(formData: FormData) {
  const user = await requireUser();

  const parsed = updateManagementMeetingMinutesSchema.safeParse({
    meetingId: formData.get("meetingId"),
    minutes: formData.get("minutes") || "",
    actionPoints: formData.get("actionPoints") || ""
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parsed.data.meetingId }
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (meeting.skillId !== null) {
    throw new Error("This action is only for management meetings");
  }

  if (!canManageMeeting(user, meeting)) {
    throw new Error("Only Admins and Secretariat can update management meeting minutes");
  }

  await prisma.meeting.update({
    where: { id: parsed.data.meetingId },
    data: {
      minutes: parsed.data.minutes || null,
      actionPoints: parsed.data.actionPoints || null
    }
  });

  await logActivity({
    skillId: null,
    userId: user.id,
    action: "ManagementMeetingMinutesUpdated",
    payload: {
      meetingId: meeting.id,
      title: meeting.title
    }
  });

  revalidatePath("/meetings");
  revalidatePath("/hub/meetings");

  return { success: true };
}

const deleteManagementMeetingSchema = z.object({
  meetingId: z.string().min(1)
});

export async function deleteManagementMeetingAction(formData: FormData) {
  const user = await requireUser();

  const parsed = deleteManagementMeetingSchema.safeParse({
    meetingId: formData.get("meetingId")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parsed.data.meetingId }
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (meeting.skillId !== null) {
    throw new Error("This action is only for management meetings");
  }

  if (!canManageMeeting(user, meeting)) {
    throw new Error("Only Admins and Secretariat can delete management meetings");
  }

  // Get documents for storage cleanup
  const existingDocuments = normaliseMeetingDocuments(meeting.documents);

  // Delete meeting (cascade deletes MeetingAttendee records)
  await prisma.meeting.delete({
    where: { id: parsed.data.meetingId }
  });

  // Clean up storage for each document (non-blocking, log errors)
  for (const doc of existingDocuments) {
    try {
      await deleteStoredObject(doc.storageKey);
    } catch (error) {
      console.error("Failed to delete document from storage", { storageKey: doc.storageKey, error });
    }
  }

  await logActivity({
    skillId: null,
    userId: user.id,
    action: "ManagementMeetingDeleted",
    payload: {
      meetingId: meeting.id,
      title: meeting.title
    }
  });

  revalidatePath("/meetings");
  revalidatePath("/hub/meetings");

  return { success: true };
}

// Document Actions

const addManagementMeetingDocumentSchema = z.object({
  meetingId: z.string().min(1),
  storageKey: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1)
});

export async function addManagementMeetingDocumentAction(
  meetingId: string,
  fileData: { storageKey: string; fileName: string; fileSize: number; mimeType: string },
  _undefined?: undefined
) {
  const user = await requireUser();

  const parsed = addManagementMeetingDocumentSchema.safeParse({
    meetingId,
    ...fileData
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId }
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (meeting.skillId !== null) {
    throw new Error("This action is only for management meetings");
  }

  if (!canManageMeeting(user, meeting)) {
    throw new Error("Only Admins and Secretariat can add documents to management meetings");
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

  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      documents: serialiseMeetingDocuments([...existingDocuments, newDocument])
    }
  });

  await logActivity({
    skillId: null,
    userId: user.id,
    action: "ManagementMeetingDocumentAdded",
    payload: {
      meetingId,
      documentId: newDocument.id,
      fileName: newDocument.fileName
    }
  });

  revalidatePath("/meetings");
  revalidatePath("/hub/meetings");

  return { success: true, documentId: newDocument.id };
}

const deleteManagementMeetingDocumentSchema = z.object({
  meetingId: z.string().min(1),
  docId: z.string().min(1)
});

export async function deleteManagementMeetingDocumentAction(
  meetingId: string,
  docId: string
) {
  const user = await requireUser();

  const parsed = deleteManagementMeetingDocumentSchema.safeParse({
    meetingId,
    docId
  });

  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId }
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (meeting.skillId !== null) {
    throw new Error("This action is only for management meetings");
  }

  if (!canManageMeeting(user, meeting)) {
    throw new Error("Only Admins and Secretariat can delete documents from management meetings");
  }

  const existingDocuments = normaliseMeetingDocuments(meeting.documents);
  const documentToDelete = existingDocuments.find((doc) => doc.id === docId);

  if (!documentToDelete) {
    throw new Error("Document not found");
  }

  const updatedDocuments = existingDocuments.filter((doc) => doc.id !== docId);

  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      documents: serialiseMeetingDocuments(updatedDocuments)
    }
  });

  // Delete from storage (non-blocking)
  try {
    await deleteStoredObject(documentToDelete.storageKey);
  } catch (error) {
    console.error("Failed to delete document from storage", error);
  }

  await logActivity({
    skillId: null,
    userId: user.id,
    action: "ManagementMeetingDocumentDeleted",
    payload: {
      meetingId,
      documentId: docId,
      fileName: documentToDelete.fileName
    }
  });

  revalidatePath("/meetings");
  revalidatePath("/hub/meetings");

  return { success: true };
}

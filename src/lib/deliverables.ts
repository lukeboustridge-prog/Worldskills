import { differenceInCalendarDays, isAfter, subMonths } from "date-fns";

import {
  Prisma,
  type AppSettings,
  DeliverableScheduleType,
  DeliverableState,
  type Deliverable,
  type DeliverableTemplate
} from "@prisma/client";

import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

export const DUE_SOON_THRESHOLD_DAYS = 30;

export interface DefaultDeliverableTemplate {
  key: string;
  label: string;
  scheduleType: DeliverableScheduleType;
  offsetMonths?: number;
  calendarDueDate?: Date;
  position: number;
}

export const DEFAULT_DELIVERABLE_TEMPLATES: DefaultDeliverableTemplate[] = [
  {
    key: "ITPDIdentified",
    label: "ITPD Identified",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 12,
    position: 1
  },
  {
    key: "ITPDAgreementKickoff",
    label: "ITPD Agreement and Kick-off",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 10,
    position: 2
  },
  {
    key: "WSOSAlignmentPlanning",
    label: "WSOS Alignment and Initial Planning",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 9,
    position: 3
  },
  {
    key: "TestProjectDraftV1",
    label: "Test Project Draft Version 1",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 8,
    position: 4
  },
  {
    key: "ILConfirmationCPW",
    label: "IL Confirmation at CPW",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 8,
    position: 5
  },
  {
    key: "MarkingSchemeDraftWSOS",
    label: "Marking Scheme Draft aligned to WSOS",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 7,
    position: 6
  },
  {
    key: "PrototypeFeasibilityReview",
    label: "Prototype and Feasibility Review",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 6,
    position: 7
  },
  {
    key: "ITPVQuestionnaireCompleted",
    label: "ITPV Questionnaire Completed",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 5,
    position: 8
  },
  {
    key: "FinalTPMSPackage",
    label: "Final TP and MS Package",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 4,
    position: 9
  },
  {
    key: "ValidationDocumentUploads",
    label: "Validation and Document Uploads",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 4,
    position: 10
  },
  {
    key: "SAGFinalReadyMAT",
    label: "SAG Final Ready for MAT",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 3,
    position: 11
  },
  {
    key: "PreCompetitionReadinessReview",
    label: "Pre-Competition Readiness Review",
    scheduleType: DeliverableScheduleType.CMonth,
    offsetMonths: 1,
    position: 12
  }
];

export function buildCMonthLabel(offsetMonths: number) {
  return `C-${offsetMonths} Month`;
}

export function computeDueDate(competitionStart: Date, offsetMonths: number) {
  return subMonths(competitionStart, offsetMonths);
}

export const EVIDENCE_TYPE_VALUES = ["Document", "Image", "Video", "Other"] as const;

export type EvidenceType = (typeof EVIDENCE_TYPE_VALUES)[number];

export const EVIDENCE_TYPE_OPTIONS = [
  { value: EVIDENCE_TYPE_VALUES[0], label: "Document" },
  { value: EVIDENCE_TYPE_VALUES[1], label: "Image" },
  { value: EVIDENCE_TYPE_VALUES[2], label: "Video walkthrough" },
  { value: EVIDENCE_TYPE_VALUES[3], label: "Other reference" }
] as const;

const EVIDENCE_TYPE_SET = new Set<string>(EVIDENCE_TYPE_VALUES);

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png"
] as const;

export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];

export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export const DOCUMENT_STATUS_VALUES = ["available", "processing", "blocked"] as const;
export type DocumentEvidenceStatus = (typeof DOCUMENT_STATUS_VALUES)[number];

export interface BaseEvidenceItem {
  id: string;
  type: EvidenceType;
  addedAt: string;
}

export interface DeliverableEvidenceLink extends BaseEvidenceItem {
  kind: "Link";
  url: string;
}

export interface DeliverableEvidenceDocument extends BaseEvidenceItem {
  kind: "Document";
  type: "Document";
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: DocumentMimeType | string;
  checksum: string;
  status: DocumentEvidenceStatus;
  version?: number;
}

export type DeliverableEvidenceItem = DeliverableEvidenceLink | DeliverableEvidenceDocument;

const DEFAULT_DOCUMENT_STATUS: DocumentEvidenceStatus = "available";

export function findDocumentEvidence(items: DeliverableEvidenceItem[]) {
  return items.find((item): item is DeliverableEvidenceDocument => isDocumentEvidence(item)) ?? null;
}

export function upsertDocumentEvidenceItem(params: {
  items: DeliverableEvidenceItem[];
  next: DeliverableEvidenceDocument;
  replaceId?: string | null;
}) {
  const { items, next, replaceId } = params;
  const updated = items.map((item) => ({ ...item }));
  let removed: DeliverableEvidenceDocument | null = null;

  if (replaceId) {
    const index = updated.findIndex((item) => isDocumentEvidence(item) && item.id === replaceId);
    if (index >= 0) {
      removed = updated[index] as DeliverableEvidenceDocument;
      updated[index] = next;
      return { items: updated, removed };
    }
  }

  const existingIndex = updated.findIndex((item) => isDocumentEvidence(item));
  if (existingIndex >= 0) {
    removed = updated[existingIndex] as DeliverableEvidenceDocument;
    updated[existingIndex] = next;
  } else {
    updated.push(next);
  }

  return { items: updated, removed };
}

export function removeDocumentEvidenceItem(params: {
  items: DeliverableEvidenceItem[];
  evidenceId: string;
}) {
  const { items, evidenceId } = params;
  let removed: DeliverableEvidenceDocument | null = null;

  const remaining = items.filter((item) => {
    if (isDocumentEvidence(item) && item.id === evidenceId) {
      removed = item;
      return false;
    }
    return true;
  });

  return { items: remaining, removed };
}

export function isRetryableDocumentUploadError(error: unknown) {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    return /ECONNRESET|ETIMEDOUT|NetworkError/i.test(error.message);
  }

  return false;
}

export type DeliverableWithStatus = Omit<Deliverable, "evidenceItems"> & {
  evidenceItems: DeliverableEvidenceItem[];
  isOverdue: boolean;
  overdueByDays: number;
};

function createEvidenceId() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `evi_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function isDocumentEvidence(
  item: DeliverableEvidenceItem
): item is DeliverableEvidenceDocument {
  return item.kind === "Document" && item.type === "Document";
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size % 1 === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

export function validateDocumentEvidenceInput(params: {
  mimeType: string;
  fileSize: number;
}) {
  const { mimeType, fileSize } = params;

  if (!DOCUMENT_MIME_TYPES.includes(mimeType as DocumentMimeType)) {
    throw new Error("That file type isn\'t supported. Upload a PDF, Office document, or image.");
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("Select a file to upload before continuing.");
  }

  if (fileSize > DOCUMENT_MAX_BYTES) {
    throw new Error("The file is larger than the maximum allowed size (25 MB).");
  }
}

export interface DocumentEvidenceRecordInput {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  addedAt?: string;
  status?: DocumentEvidenceStatus;
  id?: string;
  version?: number;
}

export function createDocumentEvidenceRecord(
  payload: DocumentEvidenceRecordInput
): DeliverableEvidenceDocument {
  const id = payload.id ?? createEvidenceId();
  const addedAt = payload.addedAt ?? new Date().toISOString();
  const status = payload.status ?? DEFAULT_DOCUMENT_STATUS;

  return {
    id,
    kind: "Document",
    type: "Document",
    addedAt,
    storageKey: payload.storageKey,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    mimeType: payload.mimeType,
    checksum: payload.checksum,
    status,
    version: payload.version
  };
}

export function createLinkEvidenceRecord(params: {
  url: string;
  type: EvidenceType;
  addedAt?: string;
  id?: string;
}): DeliverableEvidenceLink {
  const id = params.id ?? createEvidenceId();
  return {
    id,
    kind: "Link",
    url: params.url,
    type: params.type,
    addedAt: params.addedAt ?? new Date().toISOString()
  };
}

export function serialiseEvidenceItems(
  items: DeliverableEvidenceItem[]
): Prisma.InputJsonValue {
  return items.map((item) => {
    if (isDocumentEvidence(item)) {
      return {
        id: item.id,
        kind: item.kind,
        type: item.type,
        addedAt: item.addedAt,
        storageKey: item.storageKey,
        fileName: item.fileName,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        checksum: item.checksum,
        status: item.status,
        version: item.version ?? null
      } satisfies Prisma.JsonObject;
    }

    return {
      id: item.id,
      kind: item.kind,
      url: item.url,
      type: item.type,
      addedAt: item.addedAt
    } satisfies Prisma.JsonObject;
  }) as Prisma.InputJsonArray;
}

function normaliseEvidenceType(raw: unknown): EvidenceType {
  const value = typeof raw === "string" ? raw : "Document";
  return EVIDENCE_TYPE_SET.has(value) ? (value as EvidenceType) : "Document";
}

function normaliseAddedAt(raw: unknown) {
  return typeof raw === "string" ? raw : new Date().toISOString();
}

export function normaliseEvidenceItems(
  value: Prisma.JsonValue | null | undefined
): DeliverableEvidenceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" && record.id.trim().length > 0 ? record.id : createEvidenceId();
      const type = normaliseEvidenceType(record.type);
      const addedAt = normaliseAddedAt(record.addedAt);
      const kindRaw = typeof record.kind === "string" ? record.kind : undefined;
      const kind = kindRaw === "Document" || (kindRaw == null && type === "Document") ? "Document" : "Link";

      if (kind === "Document" && type === "Document") {
        const storageKey = typeof record.storageKey === "string" ? record.storageKey : null;
        const fileName = typeof record.fileName === "string" ? record.fileName : null;
        const fileSize = Number(record.fileSize);
        const checksum = typeof record.checksum === "string" ? record.checksum : null;
        const mimeType = typeof record.mimeType === "string" ? record.mimeType : "application/octet-stream";
        const status = (typeof record.status === "string"
          ? DOCUMENT_STATUS_VALUES.includes(record.status as DocumentEvidenceStatus)
            ? (record.status as DocumentEvidenceStatus)
            : DEFAULT_DOCUMENT_STATUS
          : DEFAULT_DOCUMENT_STATUS);
        const version = typeof record.version === "number" ? record.version : undefined;

        if (storageKey && fileName && Number.isFinite(fileSize) && fileSize >= 0 && checksum) {
          return {
            id,
            kind: "Document",
            type: "Document",
            addedAt,
            storageKey,
            fileName,
            fileSize,
            mimeType,
            checksum,
            status,
            version
          } satisfies DeliverableEvidenceDocument;
        }
      }

      const url = typeof record.url === "string" ? record.url : null;
      if (!url) {
        return null;
      }

      return {
        id,
        kind: "Link",
        url,
        type,
        addedAt
      } satisfies DeliverableEvidenceLink;
    })
    .filter((item): item is DeliverableEvidenceItem => item !== null);
}

const FINISHED_STATES = new Set<DeliverableState>([DeliverableState.Validated]);

export function decorateDeliverable(
  deliverable: Deliverable,
  now = new Date()
): DeliverableWithStatus {
  const isFinished = FINISHED_STATES.has(deliverable.state);
  const pastDue = isAfter(now, deliverable.dueDate);
  const isOverdue = pastDue && !isFinished;
  const overdueByDays = isOverdue ? Math.max(0, differenceInCalendarDays(now, deliverable.dueDate)) : 0;

  return {
    ...deliverable,
    evidenceItems: normaliseEvidenceItems(deliverable.evidenceItems),
    isOverdue,
    overdueByDays
  };
}

async function getOrderedTemplates() {
  return prisma.deliverableTemplate.findMany({
    orderBy: [{ position: "asc" }, { key: "asc" }]
  });
}

export async function ensureDeliverableTemplatesSeeded() {
  const templateCount = await prisma.deliverableTemplate.count();
  if (templateCount > 0) {
    return;
  }

  await prisma.deliverableTemplate.createMany({
    data: DEFAULT_DELIVERABLE_TEMPLATES.map((template) => ({
      key: template.key,
      label: template.label,
      offsetMonths: template.offsetMonths ?? null,
      calendarDueDate: template.calendarDueDate ?? null,
      scheduleType: template.scheduleType,
      position: template.position
    })),
    skipDuplicates: true
  });
}

export async function getDeliverableTemplates() {
  await ensureDeliverableTemplatesSeeded();
  return getOrderedTemplates();
}

export async function ensureStandardDeliverablesForSkill(params: {
  skillId: string;
  settings: AppSettings;
  actorId: string;
  templates?: DeliverableTemplate[];
}) {
  const { skillId, settings, actorId } = params;
  const templates = params.templates ?? (await getDeliverableTemplates());
  const existing = await prisma.deliverable.findMany({ where: { skillId } });
  const existingKeys = new Set(existing.map((deliverable) => deliverable.key));

  const toCreate = templates.filter((definition) => !existingKeys.has(definition.key));
  if (toCreate.length === 0) {
    return [] as Deliverable[];
  }

  const operations = toCreate
    .map((definition) => {
      const usingCMonth = definition.scheduleType === DeliverableScheduleType.CMonth;
      const offset = definition.offsetMonths ?? null;
      const dueDate = usingCMonth
        ? offset === null
          ? null
          : computeDueDate(settings.competitionStart, offset)
        : definition.calendarDueDate ?? null;

      if (!dueDate) {
        return null;
      }

      return prisma.deliverable.create({
        data: {
          skillId,
          key: definition.key,
          label: definition.label,
          cMonthOffset: usingCMonth ? offset : null,
          cMonthLabel: usingCMonth && offset !== null ? buildCMonthLabel(offset) : null,
          scheduleType: definition.scheduleType,
          dueDate,
          updatedBy: actorId
        }
      });
    })
    .filter((operation): operation is ReturnType<typeof prisma.deliverable.create> => Boolean(operation));

  if (operations.length === 0) {
    return [] as Deliverable[];
  }

  const created = await prisma.$transaction(operations);

  await logActivity({
    skillId,
    userId: actorId,
    action: "DeliverablesSeeded",
    payload: {
      created: created.map((item) => ({ key: item.key, label: item.label }))
    }
  });

  return created;
}

export async function recalculateDeliverableSchedule(params: {
  settings: AppSettings;
  actorId: string;
}) {
  const { settings, actorId } = params;
  await ensureDeliverableTemplatesSeeded();
  const deliverables = await prisma.deliverable.findMany({
    include: { template: true }
  });
  if (deliverables.length === 0) {
    return;
  }

  const now = new Date();
  const updates = deliverables
    .map((deliverable) => {
      const template = deliverable.template;
      const scheduleType = template?.scheduleType ?? deliverable.scheduleType;

      if (scheduleType === DeliverableScheduleType.Calendar) {
        const dueDate = template?.calendarDueDate ?? deliverable.dueDate;
        if (!dueDate) {
          return null;
        }

        return prisma.deliverable.update({
          where: { id: deliverable.id },
          data: {
            label: template?.label ?? deliverable.label,
            scheduleType,
            cMonthOffset: null,
            cMonthLabel: null,
            dueDate,
            updatedBy: actorId,
            overdueNotifiedAt: null
          }
        });
      }

      const offset = template?.offsetMonths ?? deliverable.cMonthOffset;
      if (offset == null) {
        return null;
      }

      return prisma.deliverable.update({
        where: { id: deliverable.id },
        data: {
          label: template?.label ?? deliverable.label,
          scheduleType: DeliverableScheduleType.CMonth,
          cMonthOffset: offset,
          cMonthLabel: buildCMonthLabel(offset),
          dueDate: computeDueDate(settings.competitionStart, offset),
          updatedBy: actorId,
          overdueNotifiedAt: null
        }
      });
    })
    .filter((operation): operation is ReturnType<typeof prisma.deliverable.update> => Boolean(operation));

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  const uniqueSkillIds = Array.from(new Set(deliverables.map((deliverable) => deliverable.skillId)));
  await prisma.activityLog.createMany({
    data: uniqueSkillIds.map((skillId) => ({
      skillId,
      userId: actorId,
      action: "DeliverableDueDatesRecalculated",
      payload: {
        recalculatedAt: now.toISOString()
      }
    }))
  });
}

export async function applyTemplateUpdateToDeliverables(params: {
  template: DeliverableTemplate;
  settings: AppSettings;
  actorId: string;
}) {
  const { template, settings, actorId } = params;

  const deliverables = await prisma.deliverable.findMany({
    where: { key: template.key },
    select: { id: true, skillId: true }
  });

  if (deliverables.length === 0) {
    return;
  }

  const usingCMonth = template.scheduleType === DeliverableScheduleType.CMonth;
  const offset = template.offsetMonths ?? null;
  const dueDate = usingCMonth
    ? offset === null
      ? null
      : computeDueDate(settings.competitionStart, offset)
    : template.calendarDueDate ?? null;

  if (!dueDate) {
    return;
  }

  await prisma.$transaction(
    deliverables.map((deliverable) =>
      prisma.deliverable.update({
        where: { id: deliverable.id },
        data: {
          label: template.label,
          scheduleType: template.scheduleType,
          cMonthOffset: usingCMonth ? offset : null,
          cMonthLabel: usingCMonth && offset !== null ? buildCMonthLabel(offset) : null,
          dueDate,
          updatedBy: actorId,
          overdueNotifiedAt: null
        }
      })
    )
  );

  const uniqueSkillIds = Array.from(new Set(deliverables.map((deliverable) => deliverable.skillId)));
  const now = new Date();
  await prisma.activityLog.createMany({
    data: uniqueSkillIds.map((skillId) => ({
      skillId,
      userId: actorId,
      action: "DeliverableTemplateUpdated",
      payload: {
        templateKey: template.key,
        templateLabel: template.label,
        updatedAt: now.toISOString()
      }
    }))
  });
}

export function classifyDeliverables(deliverables: DeliverableWithStatus[]) {
  return deliverables.reduce(
    (acc, deliverable) => {
      acc.total += 1;
      acc.stateCounts[deliverable.state] = (acc.stateCounts[deliverable.state] ?? 0) + 1;
      if (deliverable.isOverdue) {
        acc.overdue += 1;
      }
      return acc;
    },
    {
      total: 0,
      overdue: 0,
      stateCounts: {} as Record<DeliverableState, number>
    }
  );
}

export function sortSkillsByRisk<T extends { deliverables: DeliverableWithStatus[] }>(skills: T[]) {
  const now = new Date();
  return skills.sort((a, b) => {
    const overdueA = a.deliverables.filter((deliverable) => deliverable.isOverdue).length;
    const overdueB = b.deliverables.filter((deliverable) => deliverable.isOverdue).length;
    if (overdueA !== overdueB) {
      return overdueB - overdueA;
    }

    const dueSoonA = a.deliverables.filter(
      (deliverable) =>
        !deliverable.isOverdue &&
        differenceInCalendarDays(deliverable.dueDate, now) <= DUE_SOON_THRESHOLD_DAYS &&
        differenceInCalendarDays(deliverable.dueDate, now) >= 0
    ).length;
    const dueSoonB = b.deliverables.filter(
      (deliverable) =>
        !deliverable.isOverdue &&
        differenceInCalendarDays(deliverable.dueDate, now) <= DUE_SOON_THRESHOLD_DAYS &&
        differenceInCalendarDays(deliverable.dueDate, now) >= 0
    ).length;

    if (dueSoonA !== dueSoonB) {
      return dueSoonB - dueSoonA;
    }

    const nextDueA = Math.min(...a.deliverables.map((deliverable) => deliverable.dueDate.getTime()));
    const nextDueB = Math.min(...b.deliverables.map((deliverable) => deliverable.dueDate.getTime()));
    return nextDueA - nextDueB;
  });
}

export async function ensureOverdueNotifications(params: {
  skillId: string;
  deliverables: DeliverableWithStatus[];
  saId: string;
}) {
  const { skillId, deliverables, saId } = params;
  const now = new Date();

  const overdueNeedingMessage = deliverables.filter(
    (deliverable) =>
      deliverable.isOverdue &&
      (!deliverable.overdueNotifiedAt || deliverable.overdueNotifiedAt < deliverable.dueDate)
  );

  if (overdueNeedingMessage.length === 0) {
    return;
  }

  await prisma.$transaction(
    overdueNeedingMessage.flatMap((deliverable) => [
      prisma.deliverable.update({
        where: { id: deliverable.id },
        data: {
          overdueNotifiedAt: now
        }
      }),
      prisma.message.create({
        data: {
          skillId,
          authorId: saId,
          body: `System: ${deliverable.label} (${deliverable.cMonthLabel}) was due on ${deliverable.dueDate.toISOString().split('T')[0]} and is overdue by ${deliverable.overdueByDays} days.`
        }
      }),
      prisma.activityLog.create({
        data: {
          skillId,
          userId: saId,
          action: "DeliverableOverdueNotification",
          payload: {
            deliverableId: deliverable.id,
            overdueByDays: deliverable.overdueByDays
          }
        }
      })
    ])
  );
}

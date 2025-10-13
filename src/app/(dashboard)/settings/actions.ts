"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser, assertAdmin } from "@/lib/auth";
import { ensureStandardDeliverablesForSkill, recalculateDeliverableSchedule } from "@/lib/deliverables";
import { prisma } from "@/lib/prisma";
import { getAppSettings, requireAppSettings, upsertAppSettings } from "@/lib/settings";

const settingsSchema = z.object({
  competitionName: z.string().min(3),
  competitionStart: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid C1 start date"
  }),
  competitionEnd: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid C4 end date"
  }),
  keyDates: z.string().optional(),
  confirmRecalculate: z.string().optional()
});

export async function saveCompetitionSettingsAction(formData: FormData) {
  const user = await requireUser();
  assertAdmin(user.role as Role);

  const existing = await getAppSettings();

  const parsed = settingsSchema.parse({
    competitionName: formData.get("competitionName"),
    competitionStart: formData.get("competitionStart"),
    competitionEnd: formData.get("competitionEnd"),
    keyDates: formData.get("keyDates"),
    confirmRecalculate: formData.get("confirmRecalculate")
  });

  const competitionStart = new Date(parsed.competitionStart);
  const competitionEnd = new Date(parsed.competitionEnd);

  if (competitionEnd <= competitionStart) {
    throw new Error("Competition end date must be after the start date.");
  }

  let keyDatesJson: Prisma.JsonValue = {};
  if (parsed.keyDates && parsed.keyDates.trim().length > 0) {
    try {
      const parsedJson = JSON.parse(parsed.keyDates);
      if (!isJsonValue(parsedJson)) {
        throw new Error();
      }
      keyDatesJson = parsedJson;
    } catch (error) {
      throw new Error("Key dates must be valid JSON.");
    }
  }

  const changingC1 = existing && existing.competitionStart.getTime() !== competitionStart.getTime();

  if (existing && changingC1 && parsed.confirmRecalculate !== "on") {
    throw new Error("Changing C1 requires confirmation to recalculate deliverable schedules.");
  }

  const updated = await upsertAppSettings({
    competitionName: parsed.competitionName,
    competitionStart,
    competitionEnd,
    keyDates: keyDatesJson
  });

  let recalculated = false;
  if (!existing || changingC1) {
    await recalculateDeliverableSchedule({ settings: updated, actorId: user.id });
    recalculated = true;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ updated: "1" });
  if (recalculated) {
    params.set("recalculated", "1");
  }
  redirect(`/settings?${params.toString()}`);
}

function isJsonValue(value: unknown): value is Prisma.JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every((item) => isJsonValue(item));
  }

  return false;
}

export async function createMissingDeliverablesAction() {
  const user = await requireUser();
  assertAdmin(user.role as Role);

  const settings = await requireAppSettings();
  const skills = await prisma.skill.findMany({ select: { id: true } });

  let totalCreated = 0;
  for (const skill of skills) {
    const created = await ensureStandardDeliverablesForSkill({
      skillId: skill.id,
      settings,
      actorId: user.id
    });
    totalCreated += created.length;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/skills");

  const params = new URLSearchParams({ backfilled: "1", created: String(totalCreated) });
  redirect(`/settings?${params.toString()}`);
}

import { type AppSettings, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const SETTINGS_ID = 1;

export async function getAppSettings() {
  return prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } });
}

export async function requireAppSettings() {
  const settings = await getAppSettings();
  if (!settings) {
    throw new Error("Competition settings are not configured. Admin must set the competition start date before managing deliverables.");
  }
  return settings;
}

export async function upsertAppSettings(data: {
  competitionName: string;
  competitionStart: Date;
  competitionEnd: Date;
  keyDates: Prisma.JsonValue;
}) {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: { ...data }
  });
}

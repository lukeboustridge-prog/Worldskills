/**
 * One-off script to fix competition dates and SAG Final offset.
 *
 * 1. Updates competitionStart from 2026-09-01 to 2026-09-22
 * 2. Updates SAGFinalReadyMAT template offset from C-3 to C-2
 * 3. Recalculates all deliverable due dates
 *
 * Run with:
 *   node --env-file=.env --env-file=.env.local --import tsx scripts/fix-competition-dates.ts
 */

import { PrismaClient } from "@prisma/client";
import { recalculateDeliverableSchedule } from "../src/lib/deliverables";

const prisma = new PrismaClient();

const NEW_COMPETITION_START = new Date("2026-09-22");

async function main() {
  // Find an admin user to use as the actor for activity logs
  const adminUser = await prisma.user.findFirst({ where: { isAdmin: true } });
  if (!adminUser) {
    throw new Error("No admin user found. Cannot record activity logs.");
  }
  const actorId = adminUser.id;

  // ── Step 0: Show current state ──
  const settingsBefore = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settingsBefore) {
    throw new Error("AppSettings not found (id: 1). Has the database been seeded?");
  }

  const sagTemplateBefore = await prisma.deliverableTemplate.findUnique({
    where: { key: "SAGFinalReadyMAT" },
  });

  console.log("=== BEFORE ===");
  console.log(`Competition start: ${settingsBefore.competitionStart.toISOString().split("T")[0]}`);
  console.log(
    `SAGFinalReadyMAT offset: C-${sagTemplateBefore?.offsetMonths ?? "???"}`
  );

  // Print sample deliverable dates (first skill only)
  const sampleDeliverablesBefore = await prisma.deliverable.findMany({
    where: { key: { in: ["PrototypeFeasibilityReview", "SAGFinalReadyMAT"] } },
    orderBy: [{ key: "asc" }],
    take: 2,
  });

  for (const d of sampleDeliverablesBefore) {
    console.log(`  ${d.label}: ${d.dueDate.toISOString().split("T")[0]} (${d.cMonthLabel})`);
  }

  // ── Step 1: Update competition start date ──
  await prisma.appSettings.update({
    where: { id: 1 },
    data: { competitionStart: NEW_COMPETITION_START },
  });
  console.log(`\nUpdated competitionStart → ${NEW_COMPETITION_START.toISOString().split("T")[0]}`);

  // ── Step 2: Update SAGFinalReadyMAT template offset from 3 to 2 ──
  await prisma.deliverableTemplate.update({
    where: { key: "SAGFinalReadyMAT" },
    data: { offsetMonths: 2 },
  });
  console.log("Updated SAGFinalReadyMAT template offset → C-2");

  // ── Step 2b: Backfill templateKey on deliverables seeded without it ──
  // The original seed.ts didn't set templateKey, so the template relation is null
  // and recalculateDeliverableSchedule falls back to the old cMonthOffset on each deliverable.
  const templates = await prisma.deliverableTemplate.findMany();
  const templateKeys = new Set(templates.map((t) => t.key));

  const missingTemplateKey = await prisma.deliverable.findMany({
    where: { templateKey: null },
    select: { id: true, key: true },
  });

  const backfillOps = missingTemplateKey
    .filter((d) => templateKeys.has(d.key))
    .map((d) =>
      prisma.deliverable.update({
        where: { id: d.id },
        data: { templateKey: d.key },
      })
    );

  if (backfillOps.length > 0) {
    await prisma.$transaction(backfillOps);
    console.log(`Backfilled templateKey on ${backfillOps.length} deliverables.`);
  }

  // ── Step 3: Recalculate all deliverable due dates ──
  const settingsAfter = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settingsAfter) {
    throw new Error("AppSettings disappeared after update.");
  }

  await recalculateDeliverableSchedule({
    settings: settingsAfter,
    actorId,
  });
  console.log("Recalculated all deliverable due dates.\n");

  // ── Step 4: Print summary ──
  const allDeliverables = await prisma.deliverable.findMany({
    orderBy: [{ cMonthOffset: "desc" }, { key: "asc" }],
    distinct: ["key"],
  });

  console.log("=== AFTER ===");
  console.log(`Competition start: ${settingsAfter.competitionStart.toISOString().split("T")[0]}`);
  console.log("");

  const keyDeliverables = [
    "ITPDIdentified",
    "ITPDAgreementKickoff",
    "WSOSAlignmentPlanning",
    "TestProjectDraftV1",
    "ILConfirmationCPW",
    "MarkingSchemeDraftWSOS",
    "PrototypeFeasibilityReview",
    "ITPVQuestionnaireCompleted",
    "FinalTPMSPackage",
    "ValidationDocumentUploads",
    "SAGFinalReadyMAT",
    "PreCompetitionReadinessReview",
  ];

  for (const key of keyDeliverables) {
    const d = allDeliverables.find((del) => del.key === key);
    if (d) {
      console.log(
        `  ${d.label.padEnd(42)} ${d.cMonthLabel?.padEnd(12) ?? ""} ${d.dueDate.toISOString().split("T")[0]}`
      );
    }
  }

  console.log("\nDone. Verify that:");
  console.log("  - Prototype and Feasibility Review (C-6) = 2026-03-22");
  console.log("  - SAG Final Ready for MAT (C-2)          = 2026-07-22");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

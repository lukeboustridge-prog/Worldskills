import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  type DeliverableEvidenceDocument,
  normaliseEvidenceItems,
  removeDocumentEvidenceItem,
  serialiseEvidenceItems
} from "@/lib/deliverables";
import { deleteStoredObject } from "@/lib/storage";
import { canManageSkill } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const querySchema = z.object({
  skillId: z.string().min(1, "Skill id is required")
});

export async function DELETE(request: NextRequest, { params }: { params: { deliverableId: string; evidenceId: string } }) {
  const user = await requireUser();

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: parsedQuery.error.errors.map((issue) => issue.message).join(" \u2022 ")
      },
      { status: 400 }
    );
  }

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: params.deliverableId },
    select: {
      id: true,
      skillId: true,
      evidenceItems: true,
      skill: {
        select: {
          saId: true,
          scmId: true
        }
      }
    }
  });

  if (!deliverable) {
    return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });
  }

  if (deliverable.skillId !== parsedQuery.data.skillId) {
    return NextResponse.json({ error: "Deliverable does not belong to the requested skill." }, { status: 400 });
  }

  if (!canManageSkill(user, { saId: deliverable.skill.saId, scmId: deliverable.skill.scmId })) {
    return NextResponse.json({ error: "You do not have permission to update evidence for this skill." }, { status: 403 });
  }

  const evidenceItems = normaliseEvidenceItems(deliverable.evidenceItems);
  const { items: nextEvidenceItems, removed } = removeDocumentEvidenceItem({
    items: evidenceItems,
    evidenceId: params.evidenceId
  });

  if (!removed) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const removedDocument: DeliverableEvidenceDocument = removed;

  const payload = serialiseEvidenceItems(nextEvidenceItems);

  await prisma.deliverable.update({
    where: { id: deliverable.id },
    data: {
      evidenceItems: payload,
      updatedBy: user.id
    }
  });

  await logActivity({
    skillId: deliverable.skillId,
    userId: user.id,
    action: "DeliverableDocumentRemoved",
    payload: {
      deliverableId: deliverable.id,
      documentId: removedDocument.id
    }
  });

  revalidatePath(`/skills/${deliverable.skillId}`);
  revalidatePath("/dashboard");

  let warning: string | null = null;
  try {
    await deleteStoredObject(removedDocument.storageKey);
  } catch (error) {
    warning = "We removed the document from the record but couldn't delete the stored file.";
    console.error("Failed to delete document evidence", error);
  }

  return NextResponse.json({ success: true, warning });
}

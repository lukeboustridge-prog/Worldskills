"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser, requireAdminUser } from "@/lib/auth";
import { buildSCMQuestionsReminderEmail } from "@/lib/email/scm-questions";
import { sendBatchEmails } from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";

const createQuestionSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters"),
  description: z.string().optional(),
  position: z.coerce.number().int().min(0).optional()
});

export async function createSCMQuestionAction(formData: FormData) {
  const user = await requireAdminUser();

  const parsed = createQuestionSchema.parse({
    question: formData.get("question"),
    description: formData.get("description") || undefined,
    position: formData.get("position") || undefined
  });

  const maxPosition = await prisma.sCMQuestion.aggregate({
    _max: { position: true }
  });

  const position = parsed.position ?? (maxPosition._max.position ?? 0) + 1;

  await prisma.sCMQuestion.create({
    data: {
      question: parsed.question.trim(),
      description: parsed.description?.trim() || null,
      position,
      createdBy: user.id
    }
  });

  revalidatePath("/settings");

  const params = new URLSearchParams({ scmQuestionCreated: "1" });
  redirect(`/settings?${params.toString()}`);
}

const updateQuestionSchema = z.object({
  id: z.string().min(1, "Question ID is required"),
  question: z.string().min(5, "Question must be at least 5 characters"),
  description: z.string().optional(),
  position: z.coerce.number().int().min(0)
});

export async function updateSCMQuestionAction(formData: FormData) {
  await requireAdminUser();

  const parsed = updateQuestionSchema.parse({
    id: formData.get("id"),
    question: formData.get("question"),
    description: formData.get("description") || undefined,
    position: formData.get("position")
  });

  await prisma.sCMQuestion.update({
    where: { id: parsed.id },
    data: {
      question: parsed.question.trim(),
      description: parsed.description?.trim() || null,
      position: parsed.position
    }
  });

  revalidatePath("/settings");

  const params = new URLSearchParams({ scmQuestionUpdated: "1" });
  redirect(`/settings?${params.toString()}`);
}

const deleteQuestionSchema = z.object({
  id: z.string().min(1, "Question ID is required")
});

export async function deleteSCMQuestionAction(formData: FormData) {
  await requireAdminUser();

  const parsed = deleteQuestionSchema.parse({
    id: formData.get("id")
  });

  await prisma.sCMQuestion.delete({
    where: { id: parsed.id }
  });

  revalidatePath("/settings");

  const params = new URLSearchParams({ scmQuestionDeleted: "1" });
  redirect(`/settings?${params.toString()}`);
}

const toggleActiveSchema = z.object({
  id: z.string().min(1, "Question ID is required"),
  isActive: z.string().optional()
});

export async function toggleSCMQuestionActiveAction(formData: FormData) {
  await requireAdminUser();

  const parsed = toggleActiveSchema.parse({
    id: formData.get("id"),
    isActive: formData.get("isActive") ?? undefined
  });

  const isActive = parsed.isActive === "on";

  await prisma.sCMQuestion.update({
    where: { id: parsed.id },
    data: { isActive }
  });

  revalidatePath("/settings");

  const params = new URLSearchParams({ scmQuestionToggled: "1" });
  redirect(`/settings?${params.toString()}`);
}

const submitAnswerSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  answer: z.string().min(1, "Answer is required")
});

export async function submitSCMQuestionAnswerAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const parsed = submitAnswerSchema.parse({
    questionId: formData.get("questionId"),
    answer: formData.get("answer")
  });

  await prisma.sCMQuestionResponse.upsert({
    where: {
      questionId_userId: {
        questionId: parsed.questionId,
        userId: user.id
      }
    },
    create: {
      questionId: parsed.questionId,
      userId: user.id,
      answer: parsed.answer.trim()
    },
    update: {
      answer: parsed.answer.trim(),
      answeredAt: new Date()
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/hub");
  revalidatePath("/skills");

  return { success: true };
}

export async function sendSCMQuestionsReminderAction() {
  await requireAdminUser();

  const activeQuestions = await prisma.sCMQuestion.findMany({
    where: { isActive: true },
    select: { id: true }
  });

  if (activeQuestions.length === 0) {
    const params = new URLSearchParams({ scmReminderError: "No active questions to remind about" });
    redirect(`/settings?${params.toString()}`);
  }

  const activeQuestionIds = activeQuestions.map((q) => q.id);

  const scmUsers = await prisma.user.findMany({
    where: { role: Role.SCM },
    select: {
      id: true,
      email: true,
      name: true,
      scmQuestionResponses: {
        where: {
          questionId: { in: activeQuestionIds }
        },
        select: { questionId: true }
      }
    }
  });

  const usersWithPending = scmUsers.filter((user) => {
    const answeredIds = new Set(user.scmQuestionResponses.map((r) => r.questionId));
    return activeQuestionIds.some((qId) => !answeredIds.has(qId));
  });

  if (usersWithPending.length === 0) {
    const params = new URLSearchParams({ scmReminderSent: "0" });
    redirect(`/settings?${params.toString()}`);
  }

  const payloads = usersWithPending.map((user) => {
    const answeredIds = new Set(user.scmQuestionResponses.map((r) => r.questionId));
    const unansweredCount = activeQuestionIds.filter((qId) => !answeredIds.has(qId)).length;
    return buildSCMQuestionsReminderEmail({
      to: user.email,
      name: user.name ?? "SCM User",
      unansweredCount
    });
  });

  const { successCount, errors } = await sendBatchEmails(payloads);

  if (errors.length > 0) {
    console.error(`Batch email errors (${errors.length}):`, errors.slice(0, 5));
  }

  revalidatePath("/settings");

  const params = new URLSearchParams({ scmReminderSent: String(successCount) });
  redirect(`/settings?${params.toString()}`);
}

export async function getUnansweredQuestionsForUser(userId: string) {
  const activeQuestions = await prisma.sCMQuestion.findMany({
    where: { isActive: true },
    orderBy: { position: "asc" },
    select: {
      id: true,
      question: true,
      description: true,
      position: true
    }
  });

  if (activeQuestions.length === 0) {
    return [];
  }

  const responses = await prisma.sCMQuestionResponse.findMany({
    where: {
      userId,
      questionId: { in: activeQuestions.map((q) => q.id) }
    },
    select: { questionId: true }
  });

  const answeredIds = new Set(responses.map((r) => r.questionId));

  return activeQuestions.filter((q) => !answeredIds.has(q.id));
}

export async function getSCMQuestionsWithStats() {
  const questions = await prisma.sCMQuestion.findMany({
    orderBy: { position: "asc" },
    include: {
      _count: {
        select: { responses: true }
      },
      creator: {
        select: { name: true, email: true }
      }
    }
  });

  return questions.map((q) => ({
    id: q.id,
    question: q.question,
    description: q.description,
    isActive: q.isActive,
    position: q.position,
    createdAt: q.createdAt,
    createdBy: q.creator.name ?? q.creator.email,
    responseCount: q._count.responses
  }));
}

export async function getActiveQuestionsWithResponseSummary() {
  const [questions, totalSCMs] = await Promise.all([
    prisma.sCMQuestion.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      include: {
        _count: { select: { responses: true } }
      }
    }),
    prisma.user.count({ where: { role: Role.SCM } })
  ]);

  return questions.map((q) => ({
    id: q.id,
    question: q.question,
    description: q.description,
    position: q.position,
    responseCount: q._count.responses,
    totalSCMs
  }));
}

export async function getQuestionWithResponses(questionId: string) {
  const [question, totalSCMs] = await Promise.all([
    prisma.sCMQuestion.findUnique({
      where: { id: questionId },
      include: {
        responses: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                skillMemberships: {
                  include: {
                    skill: { select: { name: true } }
                  }
                }
              }
            }
          },
          orderBy: { answeredAt: "desc" }
        }
      }
    }),
    prisma.user.count({ where: { role: Role.SCM } })
  ]);

  if (!question) return null;

  const respondedUserIds = new Set(question.responses.map((r) => r.userId));

  const nonResponders = await prisma.user.findMany({
    where: {
      role: Role.SCM,
      id: { notIn: Array.from(respondedUserIds) }
    },
    select: {
      id: true,
      name: true,
      email: true,
      skillMemberships: {
        include: {
          skill: { select: { name: true } }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  return {
    question: {
      id: question.id,
      question: question.question,
      description: question.description,
      isActive: question.isActive
    },
    responses: question.responses.map((r) => ({
      id: r.id,
      answer: r.answer,
      answeredAt: r.answeredAt,
      user: {
        name: r.user.name,
        email: r.user.email,
        skills: r.user.skillMemberships.map((sm) => sm.skill.name)
      }
    })),
    nonResponders: nonResponders.map((u) => ({
      name: u.name,
      email: u.email,
      skills: u.skillMemberships.map((sm) => sm.skill.name)
    })),
    totalSCMs
  };
}

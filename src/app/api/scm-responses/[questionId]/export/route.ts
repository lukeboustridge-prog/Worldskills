import { Role } from "@prisma/client";
import { format } from "date-fns";
import { NextResponse } from "next/server";
import Papa from "papaparse";

import { getCurrentUser } from "@/lib/auth";
import { getQuestionWithResponses } from "@/app/(dashboard)/settings/scm-questions-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { questionId: string } }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.isAdmin && user.role !== Role.SA && user.role !== Role.Secretariat) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getQuestionWithResponses(params.questionId);

  if (!data) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const { question, responses, nonResponders } = data;

  const rows = [
    ...responses.map((r) => ({
      Name: r.user.name ?? "Unknown",
      Email: r.user.email,
      "Skill(s)": r.user.skills.join(", ") || "None",
      Answer: r.answer,
      "Answered At": format(new Date(r.answeredAt), "dd MMM yyyy HH:mm"),
      Status: "Responded",
    })),
    ...nonResponders.map((u) => ({
      Name: u.name ?? "Unknown",
      Email: u.email,
      "Skill(s)": u.skills.join(", ") || "None",
      Answer: "",
      "Answered At": "",
      Status: "Not Responded",
    })),
  ];

  const csv = Papa.unparse(rows);

  const safeQuestion = question.question
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 50);
  const filename = `SCM_Responses_${safeQuestion}_${format(new Date(), "yyyy-MM-dd")}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

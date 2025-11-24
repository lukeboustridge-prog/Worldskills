import { format } from "date-fns";
import { NextResponse } from "next/server";

import { getGlobalReportData } from "@/server/reports/globalReportData";
import { renderGlobalReportPdf } from "@/server/reports/globalReportPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await getGlobalReportData();
    const pdf = await renderGlobalReportPdf(data);
    const filename = `WorldSkills_SA_Global_Report_${format(data.generatedAt, "yyyy-MM-dd")}.pdf`;

    const pdfBytes = new Uint8Array(pdf);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error("Global report generation failed:", error);
    const details = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: "Failed to generate report", details },
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

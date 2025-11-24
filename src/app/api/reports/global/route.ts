import { format } from "date-fns";
import { NextResponse } from "next/server";

import { getGlobalReportData } from "@/server/reports/globalReportData";
import { renderGlobalReportPdf } from "@/server/reports/globalReportPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const data = await getGlobalReportData();
  const pdf = await renderGlobalReportPdf(data);
  const filename = `WorldSkills_SA_Global_Report_${format(data.generatedAt, "yyyy-MM-dd")}.pdf`;

  const pdfArrayBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);

  return new NextResponse(pdfArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

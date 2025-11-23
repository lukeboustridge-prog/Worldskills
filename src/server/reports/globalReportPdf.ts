import { format } from "date-fns";

import { type GlobalReportData } from "@/server/reports/globalReportData";

const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const MARGINS = { top: 80, bottom: 60, left: 50, right: 50 };
const BASE_FONT_SIZE = 10;

interface TextLine {
  text: string;
  size: number;
  height: number;
}

interface PageLines {
  lines: TextLine[];
}

function escapePdfText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function textCommand(text: string, x: number, y: number, size: number) {
  const escaped = escapePdfText(text);
  return `BT /F1 ${size.toFixed(2)} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escaped}) Tj ET`;
}

function formatDuration(minutes: number | null) {
  if (minutes === null) {
    return "Not available";
  }
  if (minutes < 1) {
    return "< 1 minute";
  }
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = Math.floor(minutes % 60);
  const parts = [] as string[];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 && parts.length < 2) parts.push(`${mins}m`);
  return parts.join(" ");
}

class PdfContentBuilder {
  private pages: PageLines[] = [{ lines: [] }];
  private currentHeight = 0;
  private readonly availableHeight = PAGE_HEIGHT - MARGINS.top - MARGINS.bottom;

  addPageBreak() {
    this.pages.push({ lines: [] });
    this.currentHeight = 0;
  }

  private ensureSpace(height: number) {
    if (this.currentHeight + height > this.availableHeight) {
      this.addPageBreak();
    }
  }

  private addLine(text: string, size: number) {
    const height = size * 1.2;
    this.ensureSpace(height);
    this.pages[this.pages.length - 1].lines.push({ text, size, height });
    this.currentHeight += height;
  }

  private wrapText(text: string, size: number) {
    const approxCharWidth = size * 0.6;
    const maxChars = Math.max(
      24,
      Math.floor((PAGE_WIDTH - MARGINS.left - MARGINS.right) / approxCharWidth)
    );
    return text
      .split(/\n/)
      .flatMap((paragraph) => {
        const words = paragraph.split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let current = "";
        words.forEach((word) => {
          const next = current.length > 0 ? `${current} ${word}` : word;
          if (next.length > maxChars) {
            if (current.length > 0) {
              lines.push(current);
              current = word;
            } else {
              lines.push(next.slice(0, maxChars));
              current = next.slice(maxChars);
            }
          } else {
            current = next;
          }
        });
        if (current.length > 0) {
          lines.push(current);
        }
        if (lines.length === 0) {
          lines.push("");
        }
        return lines;
      });
  }

  addParagraph(text: string, size = BASE_FONT_SIZE) {
    this.wrapText(text, size).forEach((line) => this.addLine(line, size));
  }

  addHeading(text: string, size = 14) {
    this.addParagraph(text, size);
    this.addSpacer();
  }

  addSpacer(multiplier = 1) {
    const height = BASE_FONT_SIZE * 0.6 * multiplier;
    this.ensureSpace(height);
    this.pages[this.pages.length - 1].lines.push({ text: "", size: BASE_FONT_SIZE, height });
    this.currentHeight += height;
  }

  addKeyValue(label: string, value: string) {
    this.addParagraph(`${label}: ${value}`);
  }

  addTable(header: string[], rows: string[][], widths: number[]) {
    const makeRow = (cells: string[]) =>
      cells
        .map((cell, index) => {
          const width = widths[index] ?? 10;
          return cell.padEnd(width).slice(0, width);
        })
        .join(" | ");

    this.addParagraph(makeRow(header), BASE_FONT_SIZE);
    rows.forEach((row) => this.addParagraph(makeRow(row), BASE_FONT_SIZE));
    this.addSpacer();
  }

  getPages() {
    return this.pages;
  }
}

function buildCoverPage(builder: PdfContentBuilder, data: GlobalReportData) {
  builder.addHeading("WorldSkills Skill Advisor Tracker – Global Progress Report", 18);
  builder.addParagraph("Prepared for WorldSkills Competitions Committee", 12);
  builder.addSpacer();
  builder.addParagraph(`Snapshot as at ${format(data.generatedAt, "yyyy-MM-dd")}`);
  if (data.competitionLabel) {
    builder.addParagraph(`Competition: ${data.competitionLabel}`);
  }
  builder.addSpacer();

  builder.addParagraph(
    `Total skills: ${data.summary.totalSkills} | Total deliverables: ${data.summary.totalDeliverables}`
  );
  builder.addParagraph(
    `Risk levels – On track: ${data.summary.riskCounts["On track"]}, Attention: ${data.summary.riskCounts.Attention}, At risk: ${data.summary.riskCounts["At risk"]}`
  );
  builder.addParagraph(
    `Overdue deliverables: ${data.summary.overdueDeliverables} | Due within 30 days: ${data.summary.dueSoonDeliverables}`
  );
  builder.addParagraph(
    `Conversations awaiting SCM reply: ${data.summary.awaitingConversations} (oldest: ${formatDuration(
      data.awaitingOldestAgeMinutes
    )})`
  );
  builder.addParagraph(
    `Average SCM response time: ${formatDuration(data.averageResponseMinutes)}`
  );
}

function buildSnapshotPage(builder: PdfContentBuilder, data: GlobalReportData) {
  builder.addHeading("Global snapshot", 16);

  builder.addParagraph("Skills status overview", 12);
  builder.addTable(
    ["Status", "Count", "% of skills"],
    [
      [
        "Not started",
        data.summary.statusCounts["Not started"].toString(),
        data.summary.totalSkills
          ? `${Math.round((data.summary.statusCounts["Not started"] / data.summary.totalSkills) * 100)}%`
          : "0%"
      ],
      [
        "In progress",
        data.summary.statusCounts["In progress"].toString(),
        data.summary.totalSkills
          ? `${Math.round((data.summary.statusCounts["In progress"] / data.summary.totalSkills) * 100)}%`
          : "0%"
      ],
      [
        "Completed",
        data.summary.statusCounts.Completed.toString(),
        data.summary.totalSkills
          ? `${Math.round((data.summary.statusCounts.Completed / data.summary.totalSkills) * 100)}%`
          : "0%"
      ]
    ],
    [22, 8, 12]
  );

  builder.addParagraph("Risk overview", 12);
  builder.addTable(
    ["Risk level", "Count", "% of skills"],
    [
      [
        "On track",
        data.summary.riskCounts["On track"].toString(),
        data.summary.totalSkills
          ? `${Math.round((data.summary.riskCounts["On track"] / data.summary.totalSkills) * 100)}%`
          : "0%"
      ],
      [
        "Attention",
        data.summary.riskCounts.Attention.toString(),
        data.summary.totalSkills
          ? `${Math.round((data.summary.riskCounts.Attention / data.summary.totalSkills) * 100)}%`
          : "0%"
      ],
      [
        "At risk",
        data.summary.riskCounts["At risk"].toString(),
        data.summary.totalSkills
          ? `${Math.round((data.summary.riskCounts["At risk"] / data.summary.totalSkills) * 100)}%`
          : "0%"
      ]
    ],
    [22, 8, 12]
  );

  builder.addParagraph("Deliverables overview", 12);
  builder.addTable(
    ["Metric", "Value"],
    [
      ["Total deliverables", data.summary.totalDeliverables.toString()],
      ["Completed", data.summary.completedDeliverables.toString()],
      ["Overdue", data.summary.overdueDeliverables.toString()],
      ["Due within 30 days", data.summary.dueSoonDeliverables.toString()],
      ["Validated", data.summary.validatedDeliverables.toString()]
    ],
    [32, 12]
  );

  builder.addParagraph("Communication overview", 12);
  builder.addTable(
    ["Metric", "Value"],
    [
      ["Conversation threads", data.summary.totalConversationThreads.toString()],
      ["Awaiting SCM reply", data.summary.awaitingConversations.toString()],
      ["Oldest waiting", formatDuration(data.awaitingOldestAgeMinutes)],
      ["Average SCM response", formatDuration(data.averageResponseMinutes)]
    ],
    [32, 22]
  );
}

function buildSkillsSection(builder: PdfContentBuilder, data: GlobalReportData) {
  builder.addHeading("Skills by status and risk", 16);
  data.skills.forEach((skill) => {
    builder.addParagraph(`${skill.name} — ${skill.sector}`, 12);
    builder.addParagraph(
      `SA: ${skill.advisor.name} | SCM: ${skill.scm ? skill.scm.name : "Unassigned"}`
    );
    builder.addParagraph(
      `Status: ${skill.status} | Risk: ${skill.riskLevel} | Complete: ${skill.percentComplete}% | Overdue: ${skill.overdueCount} | Due soon: ${skill.dueSoonCount} | Awaiting replies: ${skill.awaitingConversations.count}`
    );
    if (skill.oldestOverdueDays) {
      builder.addParagraph(`Oldest overdue: ${skill.oldestOverdueDays} days`);
    }
    builder.addParagraph(`Issues: ${skill.issues}`);
    builder.addSpacer();
  });
}

function buildAdvisorSection(builder: PdfContentBuilder, data: GlobalReportData) {
  builder.addHeading("Skill Advisor performance", 16);
  data.advisorPerformance.forEach((advisor) => {
    builder.addParagraph(`${advisor.name} — Skills: ${advisor.skillCount}, At risk: ${advisor.atRiskSkills}`);
    builder.addParagraph(
      `Deliverables: ${advisor.totalDeliverables} | % complete: ${advisor.percentComplete}% | Overdue: ${advisor.overdue} | Due soon: ${advisor.dueSoon} | Validated: ${advisor.validated}`
    );
    builder.addSpacer();
  });
}

function buildScmSection(builder: PdfContentBuilder, data: GlobalReportData) {
  builder.addHeading("Skill Competition Manager performance", 16);
  data.scmPerformance.forEach((scm) => {
    builder.addParagraph(
      `${scm.name} — Skills: ${scm.skillCount} | Awaiting replies: ${scm.awaiting}`
    );
    builder.addParagraph(
      `Average response: ${formatDuration(scm.averageResponseMinutes)} | Responses: ${scm.responses} | Oldest outstanding: ${formatDuration(scm.oldestAwaitingMinutes)}`
    );
    builder.addSpacer();
  });
}

function buildSectorSection(builder: PdfContentBuilder, data: GlobalReportData) {
  builder.addHeading("Sector progress", 16);
  data.sectorProgress.forEach((sector) => {
    builder.addParagraph(
      `${sector.sector} — Skills: ${sector.skills} | Deliverables: ${sector.totalDeliverables}`
    );
    builder.addParagraph(
      `% complete: ${sector.percentComplete}% | Overdue: ${sector.overdue} | Due soon: ${sector.dueSoon} | Validated: ${sector.validated}`
    );
    builder.addSpacer();
  });
}

function buildOverdueAppendix(builder: PdfContentBuilder, data: GlobalReportData) {
  builder.addHeading("Appendix A – Overdue deliverables", 16);
  if (data.overdueDeliverables.length === 0) {
    builder.addParagraph("No overdue deliverables at this time.");
    return;
  }
  data.overdueDeliverables.forEach((item) => {
    builder.addParagraph(`${item.skill} – ${item.deliverable}`);
    builder.addParagraph(
      `Due: ${format(item.dueDate, "yyyy-MM-dd")} | Overdue by ${item.overdueByDays} days | SA: ${item.sa} | SCM: ${item.scm} | Sector: ${item.sector}`
    );
    builder.addSpacer();
  });
}

function buildAwaitingAppendix(builder: PdfContentBuilder, data: GlobalReportData) {
  builder.addHeading("Appendix B – Conversations awaiting SCM responses", 16);
  if (data.awaitingConversations.length === 0) {
    builder.addParagraph("No pending SCM responses.");
    return;
  }
  data.awaitingConversations.forEach((conversation) => {
    builder.addParagraph(`${conversation.skill} — SA ${conversation.sa} | SCM ${conversation.scm}`);
    builder.addParagraph(
      `Waiting ${formatDuration(conversation.ageMinutes)} | Subject: ${conversation.summary}`
    );
    builder.addSpacer();
  });
}

function buildPageContent(
  page: PageLines,
  pageIndex: number,
  totalPages: number,
  generatedAt: Date
) {
  const commands: string[] = [];
  const headerY = PAGE_HEIGHT - 30;
  commands.push(
    textCommand("WorldSkills Skill Advisor Tracker – Global Progress Report", MARGINS.left, headerY, 12)
  );
  let yCursor = PAGE_HEIGHT - MARGINS.top;
  page.lines.forEach((line) => {
    yCursor -= line.height;
    commands.push(textCommand(line.text, MARGINS.left, yCursor, line.size));
  });
  const footer = `Generated on ${format(generatedAt, "yyyy-MM-dd HH:mm 'UTC'")} – Page ${pageIndex} of ${totalPages}`;
  commands.push(textCommand(footer, MARGINS.left, 30, 9));
  return commands.join("\n");
}

function buildPdfFromPages(pages: PageLines[], generatedAt: Date) {
  const objects: { id: number; body: string }[] = [];
  const fontId = 3;
  let nextId = 4;

  const pageIds: number[] = [];

  pages.forEach((page, index) => {
    const content = buildPageContent(page, index + 1, pages.length, generatedAt);
    const contentId = nextId++;
    const contentLength = Buffer.byteLength(content, "utf8");
    objects.push({ id: contentId, body: `<< /Length ${contentLength} >>\nstream\n${content}\nendstream` });

    const pageId = nextId++;
    pageIds.push(pageId);
    const pageBody =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects.push({ id: pageId, body: pageBody });
  });

  const pagesBody = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${
    pages.length
  } >>`;
  const catalogBody = "<< /Type /Catalog /Pages 2 0 R >>";
  const fontBody = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";

  objects.push({ id: 1, body: catalogBody });
  objects.push({ id: 2, body: pagesBody });
  objects.push({ id: fontId, body: fontBody });

  const sorted = objects.sort((a, b) => a.id - b.id);
  const parts: Buffer[] = [];
  let offset = 0;

  const push = (value: string) => {
    const buf = Buffer.from(value, "utf8");
    parts.push(buf);
    offset += buf.length;
  };

  push("%PDF-1.4\n");
  const positions = new Map<number, number>();
  sorted.forEach((obj) => {
    positions.set(obj.id, offset);
    push(`${obj.id} 0 obj\n${obj.body}\nendobj\n`);
  });

  const xrefStart = offset;
  push("xref\n");
  push(`0 ${sorted.length + 1}\n`);
  push("0000000000 65535 f \n");
  sorted.forEach((obj) => {
    const position = positions.get(obj.id) ?? 0;
    push(`${position.toString().padStart(10, "0")} 00000 n \n`);
  });
  push(`trailer << /Size ${sorted.length + 1} /Root 1 0 R >>\n`);
  push(`startxref\n${xrefStart}\n%%EOF`);

  return Buffer.concat(parts);
}

export function renderGlobalReportPdf(data: GlobalReportData) {
  const builder = new PdfContentBuilder();
  buildCoverPage(builder, data);
  builder.addPageBreak();
  buildSnapshotPage(builder, data);
  builder.addPageBreak();
  buildSkillsSection(builder, data);
  builder.addPageBreak();
  buildAdvisorSection(builder, data);
  builder.addPageBreak();
  buildScmSection(builder, data);
  builder.addPageBreak();
  buildSectorSection(builder, data);
  builder.addPageBreak();
  buildOverdueAppendix(builder, data);
  builder.addPageBreak();
  buildAwaitingAppendix(builder, data);

  return buildPdfFromPages(builder.getPages(), data.generatedAt);
}

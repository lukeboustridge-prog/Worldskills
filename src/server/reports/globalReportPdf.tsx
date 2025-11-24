import { format } from "date-fns";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

import { type GlobalReportData, type SkillRiskLevel } from "@/server/reports/globalReportData";

const colors = {
  text: "#1F2937",
  muted: "#4B5563",
  border: "#E5E7EB",
  headerBg: "#F3F4F6",
  rowAlt: "#F9FAFB",
  risk: {
    "On track": "#16A34A",
    Attention: "#CA8A04",
    "At risk": "#DC2626"
  }
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 52,
    paddingHorizontal: 46,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.text
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 46,
    right: 46,
    fontSize: 8,
    color: colors.muted,
    textAlign: "right"
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 10,
    marginTop: 18,
    color: colors.text
  },
  subtitle: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 6
  },
  muted: {
    color: colors.muted
  },
  metricGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 14
  },
  metricCard: {
    flexBasis: "48%",
    backgroundColor: "#F8FAFF",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10
  },
  metricLabel: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 6
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 700,
    color: colors.text
  },
  infoCardsRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  infoCard: {
    flex: 1,
    flexBasis: "32%",
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginRight: 10
  },
  halfCard: {
    flexBasis: "48%",
    marginRight: 10
  },
  infoCardTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    color: colors.text
  },
  infoCardRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  infoCardLabel: {
    fontSize: 9,
    color: colors.muted
  },
  infoCardValue: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.text
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 10
  },
  tableHeader: {
    backgroundColor: colors.headerBg,
    display: "flex",
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  tableHeaderCell: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 9,
    fontWeight: 700,
    color: colors.text,
    borderRightWidth: 1,
    borderRightColor: colors.border
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  tableCell: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontSize: 9,
    color: colors.text,
    borderRightWidth: 1,
    borderRightColor: colors.border
  },
  cellText: {
    fontSize: 9,
    color: colors.text
  },
  rightAlign: {
    textAlign: "right"
  },
  badge: {
    fontSize: 9,
    fontWeight: 700,
    marginLeft: 4
  },
  chip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center"
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  logoRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18
  },
  logoMarks: {
    display: "flex",
    flexDirection: "row",
    marginRight: 6
  },
  logoBar: {
    width: 6,
    height: 22,
    backgroundColor: "#0071BC",
    transform: [{ rotate: "-12deg" }]
  },
  logoText: {
    fontSize: 12,
    fontWeight: 700,
    color: "#111827"
  },
  coverTitle: {
    fontSize: 24,
    fontWeight: 800,
    textAlign: "center",
    marginTop: 18,
    marginBottom: 8
  },
  coverSubtitle: {
    fontSize: 14,
    textAlign: "center",
    color: colors.muted,
    marginBottom: 18
  },
  coverFooter: {
    position: "absolute",
    bottom: 40,
    left: 46,
    fontSize: 10,
    color: colors.muted
  },
  cardGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  sectorCard: {
    flexBasis: "48%",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10
  },
  sectorTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    color: colors.text
  },
  appendixTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 18,
    marginBottom: 10
  }
});

interface Column {
  label: string;
  flex?: number;
  width?: number;
  align?: "right" | "left";
}

function formatDuration(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes)) return "Not available";
  if (minutes < 1) return "< 1 minute";
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = Math.floor(minutes % 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins && parts.length < 2) parts.push(`${mins}m`);
  return parts.join(" ") || "0m";
}

const riskOrder: SkillRiskLevel[] = ["At risk", "Attention", "On track"];

function sortSkills(data: GlobalReportData) {
  return [...data.skills].sort((a, b) => {
    const riskDiff = riskOrder.indexOf(a.riskLevel) - riskOrder.indexOf(b.riskLevel);
    if (riskDiff !== 0) return riskDiff;
    if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
    const aOverdue = a.oldestOverdueDays ?? 0;
    const bOverdue = b.oldestOverdueDays ?? 0;
    if (bOverdue !== aOverdue) return bOverdue - aOverdue;
    return a.name.localeCompare(b.name);
  });
}

function truncate(text: string, max = 110) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const RiskBadge = ({ level }: { level: SkillRiskLevel }) => (
  <View style={styles.chip}>
    <View style={[styles.riskDot, { backgroundColor: colors.risk[level] }]} />
    <Text style={[styles.badge, { color: colors.risk[level] }]}>{level}</Text>
  </View>
);

const TableHeader = ({ columns }: { columns: Column[] }) => (
  <View style={styles.tableHeader}>
    {columns.map((col, index) => (
      <Text
        key={`${col.label}-${index}`}
        style={[
          styles.tableHeaderCell,
          {
            flex: col.flex ?? 1,
            width: col.width,
            textAlign: col.align === "right" ? "right" : "left",
            borderRightWidth: index === columns.length - 1 ? 0 : styles.tableHeaderCell.borderRightWidth,
            borderRightColor: colors.border
          }
        ]}
      >
        {col.label}
      </Text>
    ))}
  </View>
);

const TableRow = ({
  columns,
  values,
  rowIndex
}: {
  columns: Column[];
  values: (string | JSX.Element)[];
  rowIndex: number;
}) => (
  <View
    style={{
      ...styles.tableRow,
      backgroundColor: rowIndex % 2 === 0 ? "white" : colors.rowAlt
    }}
  >
    {values.map((value, index) => (
      <View
        key={`${index}`}
        style={[
          styles.tableCell,
          {
            flex: columns[index].flex ?? 1,
            width: columns[index].width,
            borderRightWidth: index === columns.length - 1 ? 0 : styles.tableCell.borderRightWidth,
            borderRightColor: colors.border
          }
        ]}
      >
        {typeof value === "string" ? (
          <Text style={columns[index].align === "right" ? [styles.cellText, styles.rightAlign] : styles.cellText}>
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    ))}
  </View>
);

const Logo = () => (
  <View style={styles.logoRow}>
    <View style={styles.logoMarks}>
      <View style={{ ...styles.logoBar, backgroundColor: "#F2994A" }} />
      <View style={{ ...styles.logoBar, backgroundColor: "#56CCF2" }} />
      <View style={{ ...styles.logoBar, backgroundColor: "#2D9CDB" }} />
    </View>
    <Text style={styles.logoText}>WorldSkills</Text>
  </View>
);

const CoverPage = ({ data }: { data: GlobalReportData }) => (
  <Page size="A4" style={styles.page}>
    <Logo />
    <Text style={styles.coverTitle}>Global Progress Report</Text>
    <Text style={styles.coverSubtitle}>Skill Advisor Tracker</Text>
    <Text style={{ textAlign: "center", color: colors.muted }}>
      Snapshot as at {format(data.generatedAt, "yyyy-MM-dd")}
      {data.competitionLabel ? ` • ${data.competitionLabel}` : ""}
    </Text>

    <View style={styles.metricGrid}>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>Total Skills</Text>
        <Text style={styles.metricValue}>{data.summary.totalSkills}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>At-risk Skills</Text>
        <Text style={styles.metricValue}>{data.summary.riskCounts["At risk"]}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>Overdue Deliverables</Text>
        <Text style={styles.metricValue}>{data.summary.overdueDeliverables}</Text>
      </View>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>SCM Issues (awaiting replies)</Text>
        <Text style={styles.metricValue}>{data.summary.awaitingConversations}</Text>
      </View>
    </View>

    <Text style={styles.coverFooter}>Prepared for WorldSkills Competitions Committee</Text>
    <Text
      style={styles.footer}
      render={({ pageNumber, totalPages }) =>
        `Generated on ${format(data.generatedAt, "yyyy-MM-dd HH:mm 'UTC'")} — Page ${pageNumber} of ${totalPages}`
      }
      fixed
    />
  </Page>
);

const ExecutiveSummaryPage = ({ data }: { data: GlobalReportData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.sectionTitle}>Executive summary</Text>
    <View style={{ height: 8 }} />
    <View style={styles.infoCardsRow}>
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Skills overview</Text>
        <View style={styles.infoCardRow}>
          <Text style={styles.infoCardLabel}>Not started</Text>
          <Text style={styles.infoCardValue}>{data.summary.statusCounts["Not started"]}</Text>
        </View>
        <View style={styles.infoCardRow}>
          <Text style={styles.infoCardLabel}>In progress</Text>
          <Text style={styles.infoCardValue}>{data.summary.statusCounts["In progress"]}</Text>
        </View>
        <View style={styles.infoCardRow}>
          <Text style={styles.infoCardLabel}>Completed</Text>
          <Text style={styles.infoCardValue}>{data.summary.statusCounts.Completed}</Text>
        </View>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Risk overview</Text>
        <View style={styles.infoCardRow}>
          <Text style={styles.infoCardLabel}>On track</Text>
          <Text style={styles.infoCardValue}>{data.summary.riskCounts["On track"]}</Text>
        </View>
        <View style={styles.infoCardRow}>
          <Text style={styles.infoCardLabel}>Attention</Text>
          <Text style={styles.infoCardValue}>{data.summary.riskCounts.Attention}</Text>
        </View>
        <View style={styles.infoCardRow}>
          <Text style={styles.infoCardLabel}>At risk</Text>
          <Text style={styles.infoCardValue}>{data.summary.riskCounts["At risk"]}</Text>
        </View>
      </View>
      <View style={[styles.infoCard, { marginRight: 0 }] }>
        <Text style={styles.infoCardTitle}>Communication overview</Text>
        <View style={styles.infoCardRow}>
          <Text style={styles.infoCardLabel}>Awaiting SCM reply</Text>
          <Text style={styles.infoCardValue}>{data.summary.awaitingConversations}</Text>
        </View>
        <View style={styles.infoCardRow}>
          <Text style={styles.infoCardLabel}>Oldest wait</Text>
          <Text style={styles.infoCardValue}>{formatDuration(data.awaitingOldestAgeMinutes)}</Text>
        </View>
        <View style={styles.infoCardRow}>
          <Text style={styles.infoCardLabel}>Avg SCM response</Text>
          <Text style={styles.infoCardValue}>{formatDuration(data.averageResponseMinutes)}</Text>
        </View>
      </View>
    </View>

    <View style={{ marginTop: 18 }}>
      <Text style={styles.sectionTitle}>Deliverables snapshot</Text>
      <View style={styles.infoCardsRow}>
        <View style={[styles.infoCard, styles.halfCard]}>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Total deliverables</Text>
            <Text style={styles.infoCardValue}>{data.summary.totalDeliverables}</Text>
          </View>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Completed</Text>
            <Text style={styles.infoCardValue}>{data.summary.completedDeliverables}</Text>
          </View>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Validated</Text>
            <Text style={styles.infoCardValue}>{data.summary.validatedDeliverables}</Text>
          </View>
        </View>
        <View style={[styles.infoCard, styles.halfCard, { marginRight: 0 }]}>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Overdue</Text>
            <Text style={styles.infoCardValue}>{data.summary.overdueDeliverables}</Text>
          </View>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Due within 30 days</Text>
            <Text style={styles.infoCardValue}>{data.summary.dueSoonDeliverables}</Text>
          </View>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Conversation threads</Text>
            <Text style={styles.infoCardValue}>{data.summary.totalConversationThreads}</Text>
          </View>
        </View>
      </View>
    </View>

    <Text
      style={styles.footer}
      render={({ pageNumber, totalPages }) =>
        `Generated on ${format(data.generatedAt, "yyyy-MM-dd HH:mm 'UTC'")} — Page ${pageNumber} of ${totalPages}`
      }
      fixed
    />
  </Page>
);

const SkillsOverviewPage = ({ data }: { data: GlobalReportData }) => {
  const skills = sortSkills(data);
  const columns: Column[] = [
    { label: "Skill", flex: 1.6 },
    { label: "Sector", flex: 1.4 },
    { label: "SA", flex: 1.1 },
    { label: "SCM", flex: 1.1 },
    { label: "Status", flex: 0.9 },
    { label: "Risk", flex: 0.9 },
    { label: "% complete", flex: 0.8, align: "right" },
    { label: "Overdue", flex: 0.7, align: "right" },
    { label: "Due soon", flex: 0.8, align: "right" },
    { label: "Issues", flex: 1.5 }
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Skills overview</Text>
      <View style={styles.table}>
        <TableHeader columns={columns} />
        {skills.map((skill, index) => (
          <TableRow
            key={skill.id}
            columns={columns}
            values={[
              skill.name,
              skill.sector,
              skill.advisor.name,
              skill.scm ? skill.scm.name : "Unassigned",
              skill.status,
              <RiskBadge level={skill.riskLevel} key={skill.id} />,
              `${Math.round(skill.percentComplete)}%`,
              skill.overdueCount.toString(),
              skill.dueSoonCount.toString(),
              truncate(skill.issues)
            ]}
            rowIndex={index}
          />
        ))}
      </View>
      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) =>
          `Generated on ${format(data.generatedAt, "yyyy-MM-dd HH:mm 'UTC'")} — Page ${pageNumber} of ${totalPages}`
        }
        fixed
      />
    </Page>
  );
};

const AdvisorPerformancePage = ({ data }: { data: GlobalReportData }) => {
  const columns: Column[] = [
    { label: "Advisor", flex: 1.6 },
    { label: "Skills", flex: 0.8, align: "right" },
    { label: "At-risk skills", flex: 0.9, align: "right" },
    { label: "Completion %", flex: 1, align: "right" },
    { label: "Overdue", flex: 0.8, align: "right" },
    { label: "Due soon", flex: 0.9, align: "right" },
    { label: "Validated", flex: 0.9, align: "right" }
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Advisor performance</Text>
      <View style={styles.table}>
        <TableHeader columns={columns} />
        {data.advisorPerformance.map((advisor, index) => (
          <TableRow
            key={advisor.id}
            columns={columns}
            values={[
              advisor.name,
              advisor.skillCount.toString(),
              advisor.atRiskSkills.toString(),
              `${Math.round(advisor.percentComplete)}%`,
              advisor.overdue.toString(),
              advisor.dueSoon.toString(),
              advisor.validated.toString()
            ]}
            rowIndex={index}
          />
        ))}
      </View>
      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) =>
          `Generated on ${format(data.generatedAt, "yyyy-MM-dd HH:mm 'UTC'")} — Page ${pageNumber} of ${totalPages}`
        }
        fixed
      />
    </Page>
  );
};

const ScmPerformancePage = ({ data }: { data: GlobalReportData }) => {
  const columns: Column[] = [
    { label: "SCM", flex: 1.6 },
    { label: "Skills", flex: 0.8, align: "right" },
    { label: "Awaiting replies", flex: 1, align: "right" },
    { label: "Average response", flex: 1.1 },
    { label: "Oldest outstanding", flex: 1.1 }
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Skill Competition Manager performance</Text>
      <View style={styles.table}>
        <TableHeader columns={columns} />
        {data.scmPerformance.map((scm, index) => (
          <TableRow
            key={scm.id}
            columns={columns}
            values={[
              scm.name,
              scm.skillCount.toString(),
              scm.awaiting.toString(),
              formatDuration(scm.averageResponseMinutes),
              formatDuration(scm.oldestAwaitingMinutes)
            ]}
            rowIndex={index}
          />
        ))}
      </View>
      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) =>
          `Generated on ${format(data.generatedAt, "yyyy-MM-dd HH:mm 'UTC'")} — Page ${pageNumber} of ${totalPages}`
        }
        fixed
      />
    </Page>
  );
};

const SectorProgressPage = ({ data }: { data: GlobalReportData }) => (
  <Page size="A4" style={styles.page}>
    <Text style={styles.sectionTitle}>Sector progress</Text>
    <View style={styles.cardGrid}>
      {data.sectorProgress.map((sector) => (
        <View key={sector.sector} style={styles.sectorCard}>
          <Text style={styles.sectorTitle}>{sector.sector}</Text>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Skills</Text>
            <Text style={styles.infoCardValue}>{sector.skills}</Text>
          </View>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Deliverables</Text>
            <Text style={styles.infoCardValue}>{sector.totalDeliverables}</Text>
          </View>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>% complete</Text>
            <Text style={styles.infoCardValue}>{`${Math.round(sector.percentComplete)}%`}</Text>
          </View>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Overdue</Text>
            <Text style={styles.infoCardValue}>{sector.overdue}</Text>
          </View>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Due soon</Text>
            <Text style={styles.infoCardValue}>{sector.dueSoon}</Text>
          </View>
          <View style={styles.infoCardRow}>
            <Text style={styles.infoCardLabel}>Validated</Text>
            <Text style={styles.infoCardValue}>{sector.validated}</Text>
          </View>
        </View>
      ))}
    </View>
    <Text
      style={styles.footer}
      render={({ pageNumber, totalPages }) =>
        `Generated on ${format(data.generatedAt, "yyyy-MM-dd HH:mm 'UTC'")} — Page ${pageNumber} of ${totalPages}`
      }
      fixed
    />
  </Page>
);

const AppendicesPage = ({ data }: { data: GlobalReportData }) => {
  const overdueColumns: Column[] = [
    { label: "Skill", flex: 1.2 },
    { label: "Deliverable", flex: 1.4 },
    { label: "Due date", flex: 0.9 },
    { label: "Days overdue", flex: 0.9, align: "right" },
    { label: "SA", flex: 1 },
    { label: "SCM", flex: 1 },
    { label: "Sector", flex: 1.1 }
  ];

  const awaitingColumns: Column[] = [
    { label: "Skill", flex: 1.2 },
    { label: "SA", flex: 1 },
    { label: "SCM", flex: 1 },
    { label: "Waiting time", flex: 0.9 },
    { label: "Subject", flex: 1.6 }
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Appendix A — Overdue deliverables</Text>
      <View style={styles.table}>
        <TableHeader columns={overdueColumns} />
        {data.overdueDeliverables.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={{ ...styles.tableCell, flex: 1 }}>No overdue deliverables at this time.</Text>
          </View>
        ) : (
          data.overdueDeliverables.map((item, index) => (
            <TableRow
              key={`${item.skill}-${item.deliverable}-${index}`}
              columns={overdueColumns}
              values={[
                item.skill,
                item.deliverable,
                format(item.dueDate, "yyyy-MM-dd"),
                item.overdueByDays.toString(),
                item.sa,
                item.scm,
                item.sector
              ]}
              rowIndex={index}
            />
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Appendix B — Conversations awaiting SCM responses</Text>
      <View style={styles.table}>
        <TableHeader columns={awaitingColumns} />
        {data.awaitingConversations.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={{ ...styles.tableCell, flex: 1 }}>No pending SCM responses.</Text>
          </View>
        ) : (
          data.awaitingConversations.map((conversation, index) => (
            <TableRow
              key={conversation.skillId}
              columns={awaitingColumns}
              values={[
                conversation.skill,
                conversation.sa,
                conversation.scm,
                formatDuration(conversation.ageMinutes),
                truncate(conversation.summary)
              ]}
              rowIndex={index}
            />
          ))
        )}
      </View>

      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) =>
          `Generated on ${format(data.generatedAt, "yyyy-MM-dd HH:mm 'UTC'")} — Page ${pageNumber} of ${totalPages}`
        }
        fixed
      />
    </Page>
  );
};

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

async function normalizePdfOutput(output: unknown): Promise<Uint8Array> {
  if (output instanceof Uint8Array) {
    return output;
  }

  if (output instanceof ArrayBuffer) {
    return new Uint8Array(output);
  }

  const maybeReadable = output as { getReader?: () => ReadableStreamDefaultReader<Uint8Array> };

  if (typeof maybeReadable?.getReader === "function") {
    const reader = maybeReadable.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    return concatChunks(chunks);
  }

  throw new Error("Unsupported PDF output format");
}

export async function renderGlobalReportPdf(data: GlobalReportData): Promise<Uint8Array> {
  const doc = (
    <Document>
      <CoverPage data={data} />
      <ExecutiveSummaryPage data={data} />
      <SkillsOverviewPage data={data} />
      <AdvisorPerformancePage data={data} />
      <ScmPerformancePage data={data} />
      <SectorProgressPage data={data} />
      <AppendicesPage data={data} />
    </Document>
  );

  const instance = pdf(doc);
  const pdfBuffer = await instance.toBuffer();

  return normalizePdfOutput(pdfBuffer);
}

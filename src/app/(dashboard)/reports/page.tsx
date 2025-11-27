import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const reports = [
  {
    href: "/reports/pre-deliverables",
    title: "Pre competition deliverables",
    description:
      "Matrix of C-5 to C-3 deliverables showing status for each skill and advisor.",
    status: "Available"
  },
  {
    href: "/reports/at-deliverables",
    title: "At competition deliverables",
    description: "Planned reporting for deliverables due during competition.",
    status: "Coming soon"
  }
];

export default function ReportsPage() {
  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground">
          Access competition deliverables reports. Use these views to quickly check progress by
          skill.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.href}>
            <CardHeader>
              <CardTitle>{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-muted-foreground">{report.status}</p>
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline">
                <Link href={report.href}>Open report</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  );
}

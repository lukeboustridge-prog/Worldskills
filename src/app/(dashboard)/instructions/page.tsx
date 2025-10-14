import { Role } from "@prisma/client";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

const ROLE_LABELS: Record<Role, string> = {
  [Role.Pending]: "Pending access",
  [Role.SA]: "Skill Advisor",
  [Role.SCM]: "Skill Competition Manager",
  [Role.Secretariat]: "Secretariat"
};

const SUPPORT_EMAIL = "luke.boustridge@gmail.com";

type GuideSection = {
  title: string;
  description?: string;
  steps: ReactNode[];
  tips?: ReactNode[];
};

const COMMON_SECTIONS: GuideSection[] = [
  {
    title: "Signing in and navigating the dashboard",
    description: "Follow these steps every time you start work so you know exactly where to find information.",
    steps: [
      "Open the WorldSkills Skill Advisor Tracker in your web browser. Google Chrome, Microsoft Edge, and Safari all work well.",
      "Enter the email address and password you registered with. If this is your first time, click the invitation link that was emailed to you and create your password before returning to the sign-in page.",
      "After signing in you will land on the Dashboard or the Skills list depending on your permissions. Your name and role appear in the top bar so you can confirm which account is active.",
      <>
        Use the menu on the left to move between pages. The{" "}
        <Link href="/dashboard" className="font-medium text-foreground underline">
          Dashboard
        </Link>{" "}
        shows overall progress, the{" "}
        <Link href="/skills" className="font-medium text-foreground underline">
          Skills
        </Link>{" "}
        page lists every skill workspace, the{" "}
        <Link href="/settings" className="font-medium text-foreground underline">
          Settings
        </Link>{" "}
        area is reserved for administrators, and this User guide is always available for quick help.
      </>,
      "Click a page name once to open it. The highlighted link shows where you are at all times."
    ],
    tips: [
      "If you forget your password, use the “Forgot password” option on the sign-in page to request a reset email.",
      "Add the website to your browser favourites so you can return without searching for the link."
    ]
  },
  {
    title: "Reading the Skills page",
    description: "Each card summarises a skill so you can see the status before opening the workspace.",
    steps: [
      <>
        Open the{" "}
        <Link href="/skills" className="font-medium text-foreground underline">
          Skills
        </Link>{" "}
        page from the side menu.
      </>,
      "Each skill appears as a card. The left side shows the skill name and the assigned Skill Competition Manager (SCM).",
      "The right column keeps badges neatly aligned: red badges show how many deliverables are overdue, the green “On track” badge confirms there are no urgent items, and the grey dashed badge shows how many deliverables are hidden for that skill.",
      "The small badge labelled “SA” tells you who the Skill Advisor is. The arrow button rotates when the card is open.",
      "Click anywhere on the card header to expand more options. Use the buttons that appear to open the full workspace or send a quick message."
    ],
    tips: [
      "Use the hidden count to remember which deliverables were intentionally excluded from reporting.",
      "Admins can delete a skill from within an expanded card—non-admins will not see the delete button."
    ]
  },
  {
    title: "Working inside a skill workspace",
    description: "The workspace keeps deliverables, gates, notes, and chat messages together.",
    steps: [
      "Open a skill card and choose “Open workspace” to see the full detail.",
      "Use the tabs to switch between Deliverables, Gates, Notes, and the Activity log.",
      "Within Deliverables, each row shows the due date, status, and any supporting evidence. The calendar icon opens a date picker so you can choose new dates without typing.",
      "The evidence section lets you attach links or upload documents (depending on your permissions) so progress is easy to audit.",
      "Scroll to the bottom of the page to add a message. Messages appear instantly for everyone who has access to the skill."
    ],
    tips: [
      "Save changes regularly—buttons turn grey once the system is processing your update.",
      "The activity timeline records every action, so you can always see who changed a deliverable or posted a message."
    ]
  }
];

const ROLE_SECTIONS: Record<Role, GuideSection[]> = {
  [Role.Pending]: [
    {
      title: "Access awaiting approval",
      description: "You can still review these steps while the Secretariat finalises your access.",
      steps: [
        "Your invitation has been received but an administrator needs to confirm your role.",
        "You will receive an email once approval is complete. Sign in again after that message arrives to unlock your full menu.",
        "If you believe you should already have access, contact the administrator listed below for assistance."
      ]
    }
  ],
  [Role.SA]: [
    {
      title: "Managing your assigned skills",
      steps: [
        "From the Skills page, look for cards where your name appears in the “SA” badge—those are your responsibilities.",
        "Open the card and click “Open workspace” to review deliverables, gates, and notes in detail.",
        "Use the quick message panel in the card or the full conversation tab in the workspace to keep your SCM and administrators informed of progress.",
        "Check the hidden badge before each catch-up so you remember which deliverables were excluded from reporting and why."
      ],
      tips: [
        "Set aside time each week to scan every assigned skill so you can react before work becomes overdue.",
        "When you post a message, mention specific deliverables so teammates know exactly what changed."
      ]
    },
    {
      title: "Updating deliverables and statuses",
      steps: [
        "Within the Deliverables tab, click a row to reveal the editing form.",
        "Change the due date using the date picker when competition plans shift. The new date is saved once you click “Save changes”.",
        "Update the status as work progresses. Use “Not started” until tasks begin, move through the in-progress options, and choose “Validated” once you have checked the evidence yourself.",
        "Attach links or files that prove completion. This keeps the audit trail complete for the Secretariat.",
        "Only Skill Advisors and administrators can mark a deliverable as “Validated”. If you are waiting on information, leave the status at the appropriate in-progress level."
      ],
      tips: [
        "The system automatically highlights overdue work in red when the due date has passed and the status is below Validated.",
        "Every save is logged, so you can confidently correct mistakes later if you pick the wrong status."
      ]
    },
    {
      title: "Hiding or creating skill-specific deliverables",
      steps: [
        "If a deliverable is not relevant to your skill, open its row and choose “Hide from reporting”. The row will be greyed out and removed from dashboards and exports.",
        "You can unhide an item at any time by opening the row again and selecting “Show in reporting”.",
        "To add a bespoke deliverable, scroll to the bottom of the Deliverables tab and use “Add deliverable”. Provide a clear name, choose the due date from the calendar, and save.",
        "Custom deliverables behave like standard ones—you can track status, attach evidence, and hide them if circumstances change."
      ],
      tips: [
        "Add a message whenever you hide or create a deliverable so stakeholders understand the reason for the change.",
        "Review hidden items monthly to confirm they should remain excluded."
      ]
    }
  ],
  [Role.SCM]: [
    {
      title: "Supporting your Skill Advisor",
      steps: [
        "Use the Skills page to open the workspace for each skill you manage.",
        "Review the Deliverables tab to understand what your Skill Advisor has planned and which deadlines are approaching.",
        "Share updates in the message thread so your advisor has the latest information before meetings.",
        "If you notice incorrect information, leave a comment tagging the Skill Advisor so they can make official updates."
      ],
      tips: [
        "Agree on a regular rhythm (for example, weekly) to review the workspace together.",
        "Keep your updates short and factual so they are easy to scan later."
      ]
    },
    {
      title: "Providing evidence and documents",
      steps: [
        "Open a deliverable row to upload files or add links that prove progress.",
        "Use the notes field inside the row to explain what you have attached or what help you need.",
        "Let the Skill Advisor know through the message thread when evidence is ready so they can validate it.",
        "If a deliverable no longer applies, discuss it with the Skill Advisor. They can hide it from reporting once you agree."
      ],
      tips: [
        "Store working documents in shared folders and link to them instead of uploading duplicates when possible.",
        "Check overdue badges on the Skills page daily so you can support the advisor before deadlines slip."
      ]
    }
  ],
  [Role.Secretariat]: [
    {
      title: "Monitoring overall progress",
      steps: [
        "Visit the Dashboard to review the sector progress report. Each sector shows total deliverables, validated counts, and any overdue work.",
        "Click into a sector to note which skills need additional support, then open those skills from the Skills page.",
        "Use the hidden counts to ensure reports exclude deliverables that were intentionally removed by Skill Advisors.",
        "Review the Activity log inside skills to confirm when advisors validated items or when deadlines changed."
      ],
      tips: [
        "Export data after major reviews so you have a record of the status at that point in time.",
        "Keep an eye on repeated overdue flags for the same skill—they may signal a resourcing issue."
      ]
    },
    {
      title: "Coordinating with advisors and managers",
      steps: [
        "Use the message threads to nudge teams that have been quiet. Everyone with access to the skill sees Secretariat posts.",
        "Encourage advisors to document why deliverables are hidden or rescheduled so the history is clear for governance reviews.",
        "If an advisor is unavailable, liaise with an administrator to reassign the skill so progress continues.",
        "Share any global announcements through messages on key skills and via email for broader visibility."
      ],
      tips: [
        "When sharing reminders, include the due date and expected status so the request is precise.",
        "Record outcomes of major decisions in the Notes tab so future teams can see the rationale."
      ]
    }
  ]
};

const ADMIN_SECTIONS: GuideSection[] = [
  {
    title: "Managing users and invitations",
    steps: [
      <>
        Open the{" "}
        <Link href="/settings" className="font-medium text-foreground underline">
          Settings
        </Link>{" "}
        page and scroll to the Invitations area.
      </>,
      "Choose the person’s name, email address, and role. Tick the Admin checkbox only when they need full administrative rights.",
      "Send the invitation. The recipient receives an email immediately. Remind them to follow the link so they can set a password.",
      "To adjust a user after they have joined, use the User Management table on the same page. You can promote or remove admin rights and update roles here.",
      "If a mistake is made, send a new invitation or edit the user record—changes take effect as soon as you save."
    ],
    tips: [
      "Keep a record of pending invitations and resend them if someone has not responded within a few days.",
      "Remove admin access as soon as it is no longer required to keep the system secure."
    ]
  },
  {
    title: "Maintaining competition settings",
    steps: [
      "Use the Competition timeline section on the Settings page to update the C1 date. The system recalculates every deliverable when you confirm the change.",
      "Review the Standard deliverables catalog regularly. You can add new templates, adjust due dates using the date picker, or delete templates that no longer apply—deletions remove seeded deliverables across all skills.",
      "Update Gate templates in the same way so milestones remain accurate.",
      "Record major timeline changes in the Notes field provided so the rationale is stored with the settings.",
      "After making adjustments, notify Skill Advisors through the messaging system so they know what changed."
    ],
    tips: [
      "Plan catalog changes outside of peak working hours to minimise disruption.",
      "Export reports before and after large updates if you need to compare progress across timelines."
    ]
  },
  {
    title: "Overseeing skills",
    steps: [
      "From the Skills page, create new skills or reassign advisors and managers using the forms that appear inside each card.",
      "Only administrators can delete a skill. Expand the card, review the confirmation text carefully, and click “Delete skill” when you are sure. This removes the workspace and all associated data.",
      "When reallocating work, message the outgoing and incoming advisors so everyone understands the change.",
      "Monitor overdue badges across sectors and coordinate with the Secretariat to provide extra support where necessary."
    ],
    tips: [
      "Assign every skill to both an Advisor and an SCM to keep responsibilities clear.",
      "Use the Dashboard’s sector breakdown to spot areas that are falling behind before deadlines arrive."
    ]
  }
];

function GuideCard({ section }: { section: GuideSection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground">{section.title}</CardTitle>
        {section.description ? (
          <p className="text-sm text-muted-foreground">{section.description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal space-y-3 pl-6 text-sm text-muted-foreground">
          {section.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
        {section.tips ? (
          <div className="rounded-lg bg-muted/60 p-4">
            <p className="text-sm font-semibold text-foreground">Tips</p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {section.tips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function InstructionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const sections: GuideSection[] = [
    ...COMMON_SECTIONS,
    ...(ROLE_SECTIONS[user.role] ?? [])
  ];

  if (user.isAdmin) {
    sections.push(...ADMIN_SECTIONS);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">User instructions</h1>
        <p className="text-muted-foreground">
          You are signed in as <span className="font-medium text-foreground">{ROLE_LABELS[user.role] ?? user.role}</span>
          {user.isAdmin ? " with administrator permissions." : "."} Follow the steps below for day-to-day tasks.
        </p>
      </div>

      {sections.map((section) => (
        <GuideCard key={section.title} section={section} />
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Need more help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            If anything is unclear after reading this guide, please get in touch and we will walk through the process with you.
          </p>
          <p>
            Email <a className="font-medium text-foreground underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for further
            assistance. We are happy to help.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

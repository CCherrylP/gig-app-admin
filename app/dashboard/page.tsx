"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CheckmarkBadge01Icon,
  Legal01Icon,
  BuildingIcon,
} from "@hugeicons/core-free-icons";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QueuePanel } from "@/components/dashboard/data-views";
import { REVIEW_TABS } from "@/components/dashboard/review-tabs";
import { adminCounts, type AdminCounts } from "@/lib/counts";
import { listCertificates } from "@/lib/certificates";
import { listAppeals, groundLabel } from "@/lib/appeals";
import { listEmployers } from "@/lib/employers";
import { certName } from "@/lib/certs-catalogue";
import { date, relative } from "@/lib/format";

/** One plain line under each queue on the to-do list. */
const REVIEW_NOTES: Partial<Record<keyof AdminCounts, string>> = {
  employers: "Businesses waiting for a verification call.",
  certificates: "Certificates to check.",
  attendance: "Selfie check-ins and missed clock-outs.",
  appeals: "Penalty appeals to decide.",
  invoices: "Transfers to confirm against the bank.",
  payouts: "PayNow numbers to match to a name.",
};

// Home: a to-do list of everything waiting on staff, then the people who have
// waited longest in the three biggest queues. Counts come from the same request
// as the sidebar badges, so the two always agree.

/** One line per queue on the to-do list, in the order they appear under To review. */
const TODO: { label: string; note: string; url: string; count: keyof AdminCounts }[] = [
  ...REVIEW_TABS.map((tab) => ({ ...tab, note: REVIEW_NOTES[tab.count] ?? "" })),
  {
    label: "Inbox",
    note: "Questions from candidates and employers.",
    url: "/dashboard/inbox/candidates",
    count: "support",
  },
];

function TodoList() {
  const { data: counts, isLoading } = useQuery({ queryKey: ["admin", "counts"], queryFn: adminCounts });
  const waiting = TODO.reduce((sum, row) => sum + (counts?.[row.count] ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>To do</CardTitle>
        <CardDescription>
          {isLoading ? "Checking…" : waiting === 0 ? "All clear. Nothing is waiting on you." : `${waiting} things are waiting on you.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y border-t">
          {TODO.map((row) => {
            const count = counts?.[row.count] ?? 0;

            return (
              <li key={row.url}>
                <Link
                  href={row.url}
                  className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className={count > 0 ? "font-medium" : "text-muted-foreground"}>{row.label}</p>
                    <p className="truncate text-sm text-muted-foreground">{row.note}</p>
                  </div>
                  {count > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-900 tabular-nums">
                      {count}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Done</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const certificates = useQuery({
    queryKey: ["certificates", "pending"],
    queryFn: () => listCertificates("pending"),
  });
  const appeals = useQuery({
    queryKey: ["appeals", "pending"],
    queryFn: () => listAppeals("pending"),
  });
  const employers = useQuery({
    queryKey: ["employers", "pending"],
    queryFn: () => listEmployers("pending"),
  });
  const loading = certificates.isLoading || appeals.isLoading || employers.isLoading;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Home</h1>
        <p className="text-sm text-muted-foreground">What needs you today.</p>
      </div>

      <TodoList />

      <h2 className="text-lg font-semibold">Waiting longest</h2>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : (
      <div className="grid gap-4 lg:grid-cols-2">
        <QueuePanel
          title="Certificates"
          href="/dashboard/certificates"
          icon={CheckmarkBadge01Icon}
          emptyMessage="Nothing awaiting a decision."
          rows={(certificates.data?.reviews ?? []).slice(0, 3).map((review) => ({
            key: `${review.candidateId}-${review.certId}`,
            seed: review.candidateId,
            title: review.candidateName ?? "Unnamed candidate",
            subtitle: certName(review.certId),
            meta: relative(review.uploadedAt),
          }))}
        />

        <QueuePanel
          title="Appeals"
          href="/dashboard/appeals"
          icon={Legal01Icon}
          emptyMessage="No appeals to decide."
          rows={(appeals.data?.appeals ?? []).slice(0, 3).map((appeal) => ({
            key: appeal.withdrawalId,
            seed: appeal.candidateId,
            title: appeal.candidateName ?? "Unnamed candidate",
            subtitle: `${groundLabel(appeal.ground)} · shift on ${
              appeal.shiftOnDate ? date(appeal.shiftOnDate) : "an unknown date"
            }`,
            meta: relative(appeal.submittedAt),
          }))}
        />

        <QueuePanel
          title="Employers to verify"
          href="/dashboard/employers"
          icon={BuildingIcon}
          emptyMessage="Nobody waiting on a call."
          rows={(employers.data?.employers ?? []).slice(0, 3).map((employer) => ({
            key: employer.userId,
            seed: employer.userId,
            title: employer.name ?? "Unnamed",
            subtitle: `${employer.companyName} · UEN ${employer.companyUen}`,
            meta: relative(employer.createdAt),
          }))}
        />
      </div>
      )}
    </div>
  );
}

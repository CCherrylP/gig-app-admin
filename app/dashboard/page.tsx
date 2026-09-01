"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CheckmarkBadge01Icon,
  Legal01Icon,
  BuildingIcon,
  ReceiptIcon,
} from "@hugeicons/core-free-icons";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  InitialsAvatar,
  StatCard,
  initials,
} from "@/components/dashboard/data-views";
import { listCertificates } from "@/lib/certificates";
import { listAppeals, groundLabel } from "@/lib/appeals";
import { listEmployers } from "@/lib/employers";
import { listInvoices } from "@/lib/invoices";
import { certName } from "@/lib/certs-catalogue";
import { date, money, relative } from "@/lib/format";

// What needs a person today, in the order somebody would work it.
//
// Four queues, and the same four queries the pages themselves run — so opening
// one from here costs nothing. Each panel shows the three that have been waiting
// longest rather than the newest, because every one of these lists is worked
// oldest first: the person who has been waiting longest is the one being kept
// from something.

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
  const invoices = useQuery({
    queryKey: ["invoices", "unpaid"],
    queryFn: () => listInvoices("unpaid"),
  });

  const loading =
    certificates.isLoading ||
    appeals.isLoading ||
    employers.isLoading ||
    invoices.isLoading;

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back — here&apos;s what needs a person today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Certificates to review"
          count={certificates.data?.pendingCount ?? 0}
          icon={CheckmarkBadge01Icon}
          cls="text-amber-500"
        />
        <StatCard
          label="Appeals to decide"
          count={appeals.data?.pendingCount ?? 0}
          icon={Legal01Icon}
          cls="text-amber-500"
        />
        <StatCard
          label="Employers to call"
          count={employers.data?.pendingCount ?? 0}
          icon={BuildingIcon}
          cls="text-amber-500"
        />
        <StatCard
          label="Payments to confirm"
          count={invoices.data?.awaitingConfirmationCount ?? 0}
          icon={ReceiptIcon}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <QueuePanel
          title="Certificates waiting longest"
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
          title="Appeals waiting longest"
          href="/dashboard/appeals"
          icon={Legal01Icon}
          emptyMessage="No appeals to decide."
          rows={(appeals.data?.appeals ?? []).slice(0, 3).map((appeal) => ({
            key: appeal.withdrawalId,
            seed: appeal.candidateId,
            title: appeal.candidateName ?? "Unnamed candidate",
            subtitle: `${groundLabel(appeal.ground)} — shift on ${
              appeal.shiftOnDate ? date(appeal.shiftOnDate) : "an unknown date"
            }`,
            meta: relative(appeal.submittedAt),
          }))}
        />

        <QueuePanel
          title="Employers waiting on a call"
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

        {/* Not in the sidebar, because the queues above are the day's work —
            but this is the only place coins are created, so it belongs where
            somebody will see the number. */}
        <QueuePanel
          title="Payments awaiting confirmation"
          href="/dashboard/invoices"
          icon={ReceiptIcon}
          emptyMessage="No receipts waiting on staff."
          footer={
            invoices.data
              ? `${money(invoices.data.outstandingCents)} outstanding across ${
                  invoices.data.unpaidCount
                } unpaid invoice${invoices.data.unpaidCount === 1 ? "" : "s"}`
              : undefined
          }
          rows={(invoices.data?.invoices ?? [])
            // The ones staff can act on now: unpaid AND the company has said
            // they transferred. The rest of the pile is waiting on the employer.
            .filter((invoice) => invoice.paymentProofAt)
            .slice(0, 3)
            .map((invoice) => ({
              key: invoice.id,
              seed: invoice.companyId,
              title: invoice.companyName,
              subtitle: `${invoice.number} · ${money(invoice.amountCents)}`,
              meta: relative(invoice.paymentProofAt),
            }))}
        />
      </div>
    </div>
  );
}

type QueueRow = {
  key: string;
  seed: string;
  title: string;
  subtitle: string;
  meta: string;
};

function QueuePanel({
  title,
  href,
  icon,
  rows,
  emptyMessage,
  footer,
}: {
  title: string;
  href: string;
  icon: Parameters<typeof EmptyState>[0]["icon"];
  rows: QueueRow[];
  emptyMessage: string;
  footer?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Link href={href} className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <EmptyState icon={icon} message={emptyMessage} />
        ) : (
          <div className="divide-y">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-3 px-6 py-3">
                <InitialsAvatar seed={row.seed} label={initials(row.title)} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {row.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {row.subtitle}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.meta}
                </span>
              </div>
            ))}
          </div>
        )}
        {footer && (
          <p className="border-t px-6 py-3 text-xs text-muted-foreground">
            {footer}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

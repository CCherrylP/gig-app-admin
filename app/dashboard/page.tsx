"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CheckmarkBadge01Icon,
  Legal01Icon,
  BuildingIcon,
  ReceiptIcon,
} from "@hugeicons/core-free-icons";

import { Skeleton } from "@/components/ui/skeleton";
import { QueuePanel, StatCard } from "@/components/dashboard/data-views";
import { listCertificates } from "@/lib/certificates";
import { listAppeals, groundLabel } from "@/lib/appeals";
import { listEmployers } from "@/lib/employers";
import { listInvoices } from "@/lib/invoices";
import { certName } from "@/lib/certs-catalogue";
import { date, relative } from "@/lib/format";

// What needs a person today, in the order somebody would work it.
//
// Four counts across the top and the same four queries the pages themselves run
// — so opening one from here costs nothing. Each panel shows the three that have
// been waiting longest rather than the newest, because every one of these lists
// is worked oldest first: the person who has been waiting longest is the one
// being kept from something.
//
// Payments appears here only as a count, because it is worked against a bank
// statement rather than in the gaps between the other three queues. The count is
// a link to /dashboard/payments, which carries the whole waiting list and the
// way through to the invoice queue — the one screen that creates coins.

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
          {Array.from({ length: 3 }).map((_, i) => (
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
        <Link
          href="/dashboard/payments"
          className="rounded-xl transition-opacity hover:opacity-80"
        >
          <StatCard
            label="Payments to confirm"
            count={invoices.data?.awaitingConfirmationCount ?? 0}
            icon={ReceiptIcon}
          />
        </Link>
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
      </div>
    </div>
  );
}

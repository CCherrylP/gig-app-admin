"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Invoice01Icon,
  ReceiptIcon,
} from "@hugeicons/core-free-icons";

import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeader,
  QueuePanel,
  StatCard,
} from "@/components/dashboard/data-views";
import { listInvoices } from "@/lib/invoices";
import { money, relative } from "@/lib/format";

// The payments queue, on its own page.
//
// Same query the invoices page runs, filtered to the rows staff can act on now:
// unpaid AND the company has said they transferred. The rest of the unpaid pile
// is waiting on the employer, not on us, so it shows here only as a total.
//
// Nothing on this page decides anything — confirming a transfer is the only act
// in the system that creates coins, and it belongs next to the invoice's own
// receipt and PDF. Invoices is where that happens; this is where you find out
// there is something to do.
//
// `?company=<uen>` narrows it to one business, which is how an employer's page
// links here. The narrowing is announced and removable: a queue quietly showing
// a subset is how somebody concludes a payment never arrived.

export default function PaymentsPage() {
  // Required, not stylistic — a static page reading `useSearchParams` from a
  // Client Component fails the production build without a boundary, while
  // rendering fine in development.
  return (
    <Suspense fallback={<PaymentsFallback />}>
      <PaymentsQueue />
    </Suspense>
  );
}

function PaymentsQueue() {
  const company = useSearchParams().get("company")?.trim() ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", "unpaid"],
    queryFn: () => listInvoices("unpaid"),
  });

  const unpaid = data?.invoices ?? [];

  // Matched on UEN or name, because the link carries the UEN but somebody
  // pasting a company name should still land somewhere sensible.
  const term = company.toLowerCase();
  const scoped = term
    ? unpaid.filter((invoice) =>
        [invoice.companyUen ?? "", invoice.companyName]
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
    : unpaid;

  const awaiting = scoped.filter((invoice) => invoice.paymentProofAt);

  // Recomputed from the scoped rows rather than read off the response when a
  // company filter is on. The API's totals are platform-wide, and three numbers
  // about everybody sitting above a list of one business is the kind of mismatch
  // that gets read as a bug in the balance.
  const outstandingCents = term
    ? scoped.reduce((sum, invoice) => sum + invoice.amountCents, 0)
    : (data?.outstandingCents ?? 0);
  const unpaidCount = term ? scoped.length : (data?.unpaidCount ?? 0);
  const awaitingCount = term
    ? awaiting.length
    : (data?.awaitingConfirmationCount ?? 0);

  const label = scoped[0]?.companyName ?? company;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Payments"
        description={
          term
            ? `Transfers ${label} says it has made, oldest first.`
            : "Transfers employers say they have made, oldest first."
        }
      />

      {term && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Showing only</span>
          <span className="font-medium">{label}</span>
          <Link
            href="/dashboard/payments"
            className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} />
            Show every company
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Awaiting confirmation"
          count={data ? awaitingCount : "—"}
          icon={ReceiptIcon}
          cls="text-amber-500"
        />
        <StatCard
          label="Unpaid invoices"
          count={data ? unpaidCount : "—"}
          icon={Invoice01Icon}
        />
        <StatCard
          label="Outstanding"
          count={data ? money(outstandingCents) : "—"}
          icon={CheckmarkCircle02Icon}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : (
        <QueuePanel
          title="Payments awaiting confirmation"
          href={
            term
              ? `/dashboard/invoices?company=${encodeURIComponent(company)}&status=all`
              : "/dashboard/invoices"
          }
          linkLabel="View all invoices"
          icon={ReceiptIcon}
          emptyMessage={
            term
              ? "No receipts waiting from this company."
              : "No receipts waiting on staff."
          }
          footer={
            data
              ? `${money(outstandingCents)} outstanding across ${unpaidCount} unpaid invoice${
                  unpaidCount === 1 ? "" : "s"
                }`
              : undefined
          }
          rows={awaiting.map((invoice) => ({
            key: invoice.id,
            seed: invoice.companyId,
            title: invoice.companyName,
            subtitle: `${invoice.number} · ${money(invoice.amountCents)}`,
            meta: relative(invoice.paymentProofAt),
          }))}
        />
      )}
    </div>
  );
}

function PaymentsFallback() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}

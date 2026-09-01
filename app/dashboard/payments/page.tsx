"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Invoice01Icon,
  CheckmarkCircle02Icon,
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

export default function PaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", "unpaid"],
    queryFn: () => listInvoices("unpaid"),
  });

  const awaiting = (data?.invoices ?? []).filter(
    (invoice) => invoice.paymentProofAt,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Payments"
        description="Transfers employers say they have made, oldest first."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Awaiting confirmation"
          count={data?.awaitingConfirmationCount ?? "—"}
          icon={ReceiptIcon}
          cls="text-amber-500"
        />
        <StatCard
          label="Unpaid invoices"
          count={data?.unpaidCount ?? "—"}
          icon={Invoice01Icon}
        />
        <StatCard
          label="Outstanding"
          count={data ? money(data.outstandingCents) : "—"}
          icon={CheckmarkCircle02Icon}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : (
        <QueuePanel
          title="Payments awaiting confirmation"
          href="/dashboard/invoices"
          linkLabel="View all invoices"
          icon={ReceiptIcon}
          emptyMessage="No receipts waiting on staff."
          footer={
            data
              ? `${money(data.outstandingCents)} outstanding across ${
                  data.unpaidCount
                } unpaid invoice${data.unpaidCount === 1 ? "" : "s"}`
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

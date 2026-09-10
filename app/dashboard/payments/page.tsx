"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Invoice01Icon,
  ReceiptIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeader,
  QueuePanel,
  StatCard,
} from "@/components/dashboard/data-views";
import {
  decideInvoice,
  listInvoices,
  type AdminInvoice,
} from "@/lib/invoices";
import { openFreshDocument } from "@/lib/documents";
import { coins as formatCoins, date, money, relative } from "@/lib/format";

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
  const [open, setOpen] = useState<AdminInvoice | null>(null);

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
          // The row IS the invoice somebody came to look at, so it opens right
          // here. Sending them to "all invoices" and asking them to find the
          // same row again in a longer list was a hop for nothing.
          onRowClick={(id) =>
            setOpen(awaiting.find((invoice) => invoice.id === id) ?? null)
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

      <InvoiceDialog
        invoice={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpen(null);
        }}
      />
    </div>
  );
}

/** One invoice, opened from the queue.
 *
 *  It carries the DECISION as well as the detail, which is the whole point of
 *  opening it here: this page exists to find transfers waiting on staff, and
 *  making somebody navigate elsewhere to act on the one they just found is the
 *  hop that was being complained about.
 *
 *  Both documents are re-signed at click time — the links minted when the queue
 *  loaded expire in ten minutes, and a lapsed one shows a raw Supabase error
 *  page. See lib/documents. */
function InvoiceDialog({
  invoice,
  onOpenChange,
}: {
  invoice: AdminInvoice | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const decide = useMutation({
    mutationFn: (status: "paid" | "cancelled") =>
      decideInvoice(invoice!.id, status),
    onSuccess: (_r, status) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setConfirming(false);
      onOpenChange(false);
      toast.success(
        status === "paid"
          ? "Payment confirmed — coins credited"
          : "Invoice cancelled",
      );
    },
    onError: (error: Error) => {
      // ALREADY_DECIDED is the one that matters: two admins confirming the same
      // transfer is the race that would double a company's float.
      toast.error(error.message || "Could not record that decision");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  function openDoc(which: "pdf" | "proof") {
    if (!invoice) return;
    void openFreshDocument({
      queryClient,
      queryKey: ["invoices", "unpaid"],
      queryFn: () => listInvoices("unpaid"),
      select: (fresh) => {
        const row = fresh.invoices.find((i) => i.id === invoice.id);
        return which === "pdf" ? row?.pdfUrl : row?.paymentProofUrl;
      },
      onMissing: () => toast.error("That document could not be opened."),
    });
  }

  return (
    <Dialog
      open={!!invoice}
      onOpenChange={(open) => {
        if (!open) setConfirming(false);
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{invoice?.number}</DialogTitle>
          <DialogDescription>
            {invoice && (
              <>
                {invoice.companyName}
                {invoice.companyUen ? ` · UEN ${invoice.companyUen}` : ""}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="flex flex-col gap-3 px-6 pb-4">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="text-right font-medium tabular-nums">
                {money(invoice.amountCents)}
              </dd>
              <dt className="text-muted-foreground">Coins</dt>
              <dd className="text-right tabular-nums">
                {formatCoins(invoice.coins)}
              </dd>
              <dt className="text-muted-foreground">Issued</dt>
              <dd className="text-right">{date(invoice.issuedAt)}</dd>
              <dt className="text-muted-foreground">Due</dt>
              <dd className="text-right">{date(invoice.dueAt)}</dd>
              {invoice.paymentProofAt && (
                <>
                  <dt className="text-muted-foreground">Receipt sent</dt>
                  <dd className="text-right">
                    {relative(invoice.paymentProofAt)}
                  </dd>
                </>
              )}
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!invoice.pdfUrl}
                onClick={() => openDoc("pdf")}
              >
                <HugeiconsIcon icon={Invoice01Icon} strokeWidth={2} />
                Invoice
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!invoice.paymentProofUrl}
                onClick={() => openDoc("proof")}
              >
                <HugeiconsIcon icon={ReceiptIcon} strokeWidth={2} />
                {invoice.paymentProofUrl ? "Receipt" : "No receipt"}
              </Button>
            </div>

            {/* Evidence, not a decision. What settles an invoice is the transfer
                on the bank statement — a screenshot is the easiest artefact
                here to fake, and confirming is what creates the coins. */}
            <p className="rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/15 dark:text-amber-200">
              Confirm against the transfer on the bank statement, not against the
              uploaded receipt. This is the only thing in the system that creates
              coins, and it cannot be undone.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          {confirming ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={decide.isPending}
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={() => decide.mutate("paid")}
                disabled={decide.isPending}
              >
                {decide.isPending
                  ? "Confirming…"
                  : `Yes — credit ${invoice ? formatCoins(invoice.coins) : ""} coins`}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => decide.mutate("cancelled")}
                disabled={decide.isPending}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                Cancel invoice
              </Button>
              <Button
                size="sm"
                onClick={() => setConfirming(true)}
                disabled={decide.isPending}
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                Mark paid
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
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

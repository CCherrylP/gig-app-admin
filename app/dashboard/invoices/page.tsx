"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Invoice01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  File01Icon,
  ReceiptIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  FilterTabs,
  PageHeader,
  SearchInput,
  StatCard,
  StatusPill,
  TableShell,
  TableSkeleton,
} from "@/components/dashboard/data-views";
import {
  decideInvoice,
  listInvoices,
  type AdminInvoice,
  type InvoiceFilter,
} from "@/lib/invoices";
import { coins, date, isPast, money, relative } from "@/lib/format";

const FILTERS: { value: InvoiceFilter; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

// The API's own vocabulary, which the shared pill does not know by default.
const INVOICE_STATUS_STYLES: Record<string, string> = {
  UNPAID: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PAID: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

type Decision = { invoice: AdminInvoice; status: "paid" | "cancelled" };

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<InvoiceFilter>("unpaid");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", filter],
    queryFn: () => listInvoices(filter),
  });

  const mutation = useMutation({
    mutationFn: ({ invoice, status }: Decision) =>
      decideInvoice(invoice.id, status),
    onSuccess: (_result, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setDecision(null);
      toast.success(
        status === "paid"
          ? "Payment confirmed — coins credited"
          : "Invoice cancelled",
      );
    },
    onError: (error: Error) => {
      // ALREADY_DECIDED is the important one: two admins confirming the same
      // transfer is the race that would double a company's float, and the API
      // refuses the second. Say so rather than showing a generic failure.
      toast.error(error.message || "Could not record that decision");
      setDecision(null);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const invoices = useMemo(() => {
    const all = data?.invoices ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((invoice) =>
      [invoice.number, invoice.companyName, invoice.companyUen ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Invoices"
        description="Confirming a transfer is the only thing in this system that creates coins."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search number, company or UEN…"
          className="w-full sm:w-72"
        />
      </PageHeader>

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

      <FilterTabs
        options={FILTERS.map((f) => ({
          ...f,
          count: f.value === "unpaid" ? data?.unpaidCount : undefined,
        }))}
        value={filter}
        onChange={setFilter}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={Invoice01Icon}
              message={
                search ? "Nothing matches that search." : "Nothing in this queue."
              }
            />
          ) : (
            <TableShell
              headers={[
                "Invoice",
                "Company",
                "Coins",
                "Amount",
                "Due",
                "Status",
                "",
              ]}
              widths={[
                "w-[15%]",
                "w-[19%]",
                "w-[8%]",
                "w-[11%]",
                "w-[11%]",
                "w-[11%]",
                "w-[25%]",
              ]}
            >
              {invoices.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onDecide={(status) => setDecision({ invoice, status })}
                />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      <DecisionDialog
        decision={decision}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        onConfirm={() => decision && mutation.mutate(decision)}
        isPending={mutation.isPending}
      />
    </div>
  );
}

function InvoiceRow({
  invoice,
  onDecide,
}: {
  invoice: AdminInvoice;
  onDecide: (status: "paid" | "cancelled") => void;
}) {
  const overdue = invoice.status === "unpaid" && isPast(invoice.dueAt);

  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium tabular-nums">
            {invoice.number}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Issued {date(invoice.issuedAt)}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{invoice.companyName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {invoice.companyUen ?? "No UEN"}
          </span>
        </div>
      </td>

      <td className="px-4 py-3 tabular-nums">{coins(invoice.coins)}</td>

      <td className="px-4 py-3 font-medium tabular-nums">
        {money(invoice.amountCents)}
      </td>

      <td className="px-4 py-3">
        <span
          className={
            overdue
              ? "text-xs font-medium text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {date(invoice.dueAt)}
          {overdue && <span className="mt-0.5 block">overdue</span>}
        </span>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          <StatusPill status={invoice.status} styles={INVOICE_STATUS_STYLES} />
          {invoice.paymentProofAt && invoice.status === "unpaid" && (
            <span className="text-[11px] text-muted-foreground">
              Receipt {relative(invoice.paymentProofAt)}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            disabled={!invoice.pdfUrl}
            render={
              invoice.pdfUrl ? (
                <a
                  href={invoice.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ) : undefined
            }
          >
            <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
            Invoice
          </Button>

          {/* Evidence, not a decision. A row carrying a receipt is still
              unpaid — what settles an invoice is the bank statement. */}
          <Button
            variant="outline"
            size="xs"
            disabled={!invoice.paymentProofUrl}
            render={
              invoice.paymentProofUrl ? (
                <a
                  href={invoice.paymentProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ) : undefined
            }
          >
            <HugeiconsIcon icon={ReceiptIcon} strokeWidth={2} />
            {invoice.paymentProofUrl ? "Receipt" : "No receipt"}
          </Button>

          {invoice.status === "unpaid" && (
            <>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => onDecide("cancelled")}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                Cancel
              </Button>
              <Button size="xs" onClick={() => onDecide("paid")}>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                Mark paid
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function DecisionDialog({
  decision,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  decision: Decision | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const paying = decision?.status === "paid";

  return (
    <Dialog open={!!decision} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {paying ? "Confirm this payment" : "Cancel this invoice"}
          </DialogTitle>
          <DialogDescription>
            {decision && paying && (
              <>
                {decision.invoice.number} —{" "}
                <span className="font-medium text-foreground">
                  {money(decision.invoice.amountCents)}
                </span>{" "}
                from {decision.invoice.companyName}. This credits{" "}
                <span className="font-medium text-foreground">
                  {coins(decision.invoice.coins)} coins
                </span>{" "}
                and cannot be undone — only confirm it against the transfer on
                the bank statement, not against an uploaded receipt.
              </>
            )}
            {decision && !paying && (
              <>
                {decision.invoice.number} for {decision.invoice.companyName}. No
                coins are credited. The invoice stays on record as cancelled
                rather than disappearing, so it can still be reconciled.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Back
          </Button>
          <Button
            variant={paying ? "default" : "destructive"}
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending
              ? "Saving…"
              : paying
                ? "Confirm payment"
                : "Cancel invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

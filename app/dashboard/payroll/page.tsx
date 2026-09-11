"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Download04Icon,
  MoneyBag02Icon,
  WalletDone02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  FilterTabs,
  PageHeader,
  StatCard,
  StatusPill,
  TableShell,
} from "@/components/dashboard/data-views";
import {
  currentMonth,
  downloadCsv,
  downloadPayrollXlsx,
  hours,
  listPayroll,
  markPayrollPaid,
  monthLabel,
  payableCsv,
  payoutLabel,
  recentMonths,
  type PayrollRow,
  type PayrollStatus,
} from "@/lib/reports";
import { date, money } from "@/lib/format";

// Who we owe money to, and whether it has gone out.
//
// THIS SCREEN IS THE PAYMENT SYSTEM. Nothing in this platform moves money to a
// candidate — the wage-release sweep is a stub and there is no PayNow
// integration — so somebody reads this, makes the transfers in a bank app, and
// ticks them off here. Every figure on it is a number a human is about to
// type into a form, which is why the estimates are kept visibly apart from the
// amounts.
//
// THE THREE STATUSES ARE A SEQUENCE, not filters over the same thing:
//
//   Waiting   worked, employer has not confirmed the hours. The amount can
//             still move. Shown so somebody can chase, NEVER totalled as
//             payable, and not selectable.
//   Ready     confirmed. This is the money to send.
//   Paid      sent, and ticked off. Kept on screen so the month reconciles.

type Tab = PayrollStatus | "all";

const TABS: { value: Tab; label: string }[] = [
  { value: "ready", label: "Ready to pay" },
  { value: "awaiting_signoff", label: "Waiting on employer" },
  { value: "paid", label: "Paid" },
  { value: "all", label: "All" },
];

const STATUS_STYLES: Record<string, string> = {
  READY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  AWAITING_SIGNOFF: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  PAID: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
};

const STATUS_LABEL: Record<PayrollStatus, string> = {
  ready: "Ready",
  awaiting_signoff: "Waiting",
  paid: "Paid",
};

export default function PayrollPage() {
  const queryClient = useQueryClient();

  const [month, setMonth] = useState(currentMonth());
  const [company, setCompany] = useState("");
  const [tab, setTab] = useState<Tab>("ready");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["payroll", month, company],
    queryFn: () => listPayroll(month, company || undefined),
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const shown = useMemo(
    () => (tab === "all" ? rows : rows.filter((row) => row.status === tab)),
    [rows, tab],
  );

  // Only `ready` rows can be ticked. An estimate is not something anybody
  // transferred, and a paid one is already done.
  const selectable = useMemo(
    () => shown.filter((row) => row.status === "ready"),
    [shown],
  );

  const chosen = useMemo(
    () => selectable.filter((row) => selected.has(row.applicationId)),
    [selectable, selected],
  );

  const chosenCents = chosen.reduce((sum, row) => sum + (row.amountCents ?? 0), 0);

  const markPaid = useMutation({
    mutationFn: (ids: string[]) => markPayrollPaid(ids, month),
    onSuccess: (result) => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success(
        result.marked === 1
          ? "1 shift marked as paid"
          : `${result.marked} shifts marked as paid`,
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save that"),
  });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allChosen = selectable.length > 0 && chosen.length === selectable.length;

  const toggleAll = () =>
    setSelected(
      allChosen ? new Set() : new Set(selectable.map((row) => row.applicationId)),
    );

  const exportCsv = () => {
    const csv = payableCsv(rows, month);
    downloadCsv(`adhoc-payroll-${month}.csv`, csv);
  };

  // A mutation rather than a plain handler so the button can say it is
  // working: the workbook is built server-side and a big month is not
  // instant, and a button that looks idle gets pressed twice.
  const exportXlsx = useMutation({
    mutationFn: () => downloadPayrollXlsx(month, company || undefined),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not build the spreadsheet",
      ),
  });

  return (
    // p-6 and gap-6, matching every other queue on this dashboard. Without the
    // padding the table runs into the edge of the pane.
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Payroll"
        description="Finished shifts and what is owed. Transfers are made in your bank — this is where you tick them off."
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setSelected(new Set());
            }}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            {recentMonths().map((value) => (
              <option key={value} value={value}>
                {monthLabel(value)}
              </option>
            ))}
          </select>

          <select
            value={company}
            onChange={(event) => {
              setCompany(event.target.value);
              setSelected(new Set());
            }}
            className="h-9 max-w-52 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">All companies</option>
            {(data?.companies ?? []).map((item) => (
              <option key={item.companyId} value={item.companyId}>
                {item.companyName}
              </option>
            ))}
          </select>

          {/*
            Excel FIRST and CSV second, because the spreadsheet is what
            somebody actually works from — two sheets, real currency cells
            that sum, and a totals row. The CSV is the plain-text one for a
            bank's bulk-upload form, which wants a number rather than a
            rendered one.
          */}
          <Button onClick={() => exportXlsx.mutate()} disabled={exportXlsx.isPending}>
            <HugeiconsIcon icon={Download04Icon} strokeWidth={1.5} className="size-4" />
            {exportXlsx.isPending ? "Building…" : "Export Excel"}
          </Button>

          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!totals?.readyCount}
          >
            CSV for bank
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`Ready to pay · ${totals?.readyCount ?? 0} shifts`}
          count={money(totals?.readyCents ?? 0)}
          icon={MoneyBag02Icon}
          cls="text-emerald-600"
        />
        <StatCard
          label={`Waiting on employer · ${totals?.awaitingCount ?? 0} shifts`}
          count={money(totals?.awaitingCents ?? 0)}
          icon={Clock01Icon}
          cls="text-amber-600"
        />
        <StatCard
          label={`Paid · ${totals?.paidCount ?? 0} shifts`}
          count={money(totals?.paidCents ?? 0)}
          icon={WalletDone02Icon}
          cls="text-sky-600"
        />
      </div>

      {/*
        THE UNPAYABLE LIST IS ABOVE THE TABLE, not a column in it. These are
        people with money waiting and nowhere to send it, and finding that out
        halfway through a batch of transfers is how somebody gets missed for a
        month.
      */}
      {(data?.unpayable.length ?? 0) > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HugeiconsIcon
                icon={Alert02Icon}
                strokeWidth={1.5}
                className="size-5 text-amber-600"
              />
              {data!.unpayable.length} cannot be paid — no PayNow or bank details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {data!.unpayable.map((person) => (
              <div
                key={person.candidateId}
                className="flex items-center justify-between gap-4"
              >
                <span>
                  {person.candidateName ?? "Unnamed"}
                  <span className="text-muted-foreground">
                    {person.candidatePhone ? ` · ${person.candidatePhone}` : ""}
                    {" · "}
                    {person.shifts} {person.shifts === 1 ? "shift" : "shifts"}
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {money(person.amountCents)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterTabs
              options={TABS.map((option) => ({
                ...option,
                count:
                  option.value === "all"
                    ? rows.length
                    : rows.filter((row) => row.status === option.value).length,
              }))}
              value={tab}
              onChange={(value) => {
                setTab(value);
                setSelected(new Set());
              }}
            />

            {chosen.length > 0 && (
              <Button
                onClick={() => markPaid.mutate(chosen.map((row) => row.applicationId))}
                disabled={markPaid.isPending}
              >
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  strokeWidth={1.5}
                  className="size-4"
                />
                Mark {chosen.length} paid · {money(chosenCents)}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }, (_, n) => (
                <Skeleton key={n} className="h-10 w-full" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={MoneyBag02Icon}
              message={
                tab === "ready"
                  ? "Nothing to pay for this month."
                  : "Nothing here for this month."
              }
            />
          ) : (
            <TableShell
              headers={[
                <input
                  key="all"
                  type="checkbox"
                  aria-label="Select every payable row"
                  checked={allChosen}
                  onChange={toggleAll}
                  disabled={selectable.length === 0}
                  className="size-4 align-middle accent-primary"
                />,
                "Candidate",
                "Company",
                "Shift",
                "Hours",
                "Pay to",
                "Amount",
                "Status",
              ]}
              widths={[
                "w-[4%]",
                "w-[17%]",
                "w-[19%]",
                "w-[18%]",
                "w-[8%]",
                "w-[14%]",
                "w-[10%]",
                "w-[10%]",
              ]}
            >
              {shown.map((row) => (
                <Row
                  key={row.applicationId}
                  row={row}
                  checked={selected.has(row.applicationId)}
                  onToggle={() => toggle(row.applicationId)}
                />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  row,
  checked,
  onToggle,
}: {
  row: PayrollRow;
  checked: boolean;
  onToggle: () => void;
}) {
  const payTo = payoutLabel(row);

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          aria-label={`Select ${row.candidateName ?? "this shift"}`}
          checked={checked}
          onChange={onToggle}
          disabled={row.status !== "ready"}
          className="size-4 accent-primary disabled:opacity-30"
        />
      </td>

      <td className="truncate px-4 py-3">
        <div className="truncate font-medium">{row.candidateName ?? "Unnamed"}</div>
        <div className="truncate text-xs text-muted-foreground">
          {row.candidatePhone ?? "—"}
        </div>
      </td>

      <td className="truncate px-4 py-3">
        <div className="truncate">{row.companyName}</div>
        <div className="truncate text-xs text-muted-foreground">{row.roleName}</div>
      </td>

      <td className="truncate px-4 py-3">
        <div className="truncate">{date(row.shiftOnDate)}</div>
        <div className="truncate text-xs text-muted-foreground">
          {row.scheduledStart}–{row.scheduledEnd}
        </div>
      </td>

      <td className="px-4 py-3 tabular-nums">{hours(row.minutes)}</td>

      <td className="truncate px-4 py-3">
        {payTo ? (
          <span className="truncate text-xs">{payTo}</span>
        ) : (
          <span className="text-xs text-amber-600">No account</span>
        )}
      </td>

      <td className="px-4 py-3 text-right tabular-nums">
        <div className="font-medium">{money(row.amountCents ?? 0)}</div>
        {/*
          An estimate is labelled every time it appears. The whole risk of this
          screen is somebody transferring a number that was never confirmed.
        */}
        {row.estimated && (
          <div className="text-xs text-amber-600">estimate</div>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <StatusPill
          status={row.status}
          label={STATUS_LABEL[row.status]}
          styles={STATUS_STYLES}
        />
      </td>
    </tr>
  );
}

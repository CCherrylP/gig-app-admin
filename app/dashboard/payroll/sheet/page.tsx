"use client";

import { useMemo, useState } from "react";
import { MoneyTabs, PayrollSwitch } from "@/components/dashboard/section-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Download04Icon,
  MoneyBag02Icon,
  UserGroupIcon,
  WalletDone02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  FilterTabs,
  InitialsAvatar,
  PageHeader,
  SearchInput,
  StatCard,
  TableShell,
  initials,
} from "@/components/dashboard/data-views";
import { RevealNumber } from "@/components/dashboard/reveal-number";
import {
  byCandidate,
  currentMonth,
  dayRange,
  downloadCsv,
  downloadPayrollXlsx,
  hours,
  listPayroll,
  markPayrollPaid,
  monthLabel,
  monthRange,
  rangeLabel,
  rangeText,
  recentMonths,
  sheetCsv,
  isReferralRow,
  referralCentsOf,
  shiftCountOf,
  today,
  weekRange,
  type CandidateSheet,
  type DateRange,
} from "@/lib/reports";
import { date, money } from "@/lib/format";

// THE PAYOUT SHEET. One line per PERSON, not per shift.
//
// The payroll screen next door is a list of shifts, which is the right shape
// for working out whether a shift is settled and the wrong one for paying
// anybody: a transfer goes to a human being, and somebody who worked four
// shifts is one payment. Reading four rows and adding them up in your head is
// how the wrong figure gets typed into a bank app.
//
// So this groups by candidate, and each person opens to show exactly what made
// up their total — date, company, hours, and the rate it was worked out at.
//
// THE THREE MONEY COLUMNS ARE NEVER ADDED TOGETHER. Ready is the only one that
// is money to send. Paid has gone already, and Waiting is an estimate against
// hours no employer has confirmed — it is on the sheet so somebody can chase
// the employer, not so it can be transferred. See byCandidate in lib/reports.

type Mode = "day" | "week" | "month";

const MODES: { value: Mode; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export default function PayoutSheetPage() {
  const queryClient = useQueryClient();

  // A month by default, so one pay run covers everything owed.
  const [mode, setMode] = useState<Mode>("month");
  // ONE anchor for all three modes rather than a date per mode. Switching from
  // Day to Week then means "the week around the day I was looking at", which is
  // the move somebody actually makes — a second date that silently reset would
  // send them back to today every time they widened the view.
  const [anchor, setAnchor] = useState(today);
  const [month, setMonth] = useState(currentMonth);
  const [company, setCompany] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const range: DateRange = useMemo(() => {
    if (mode === "day") return dayRange(anchor);
    if (mode === "week") return weekRange(anchor);
    return monthRange(month);
  }, [mode, anchor, month]);

  const { data, isLoading } = useQuery({
    queryKey: ["payroll", "sheet", range.from, range.to, company],
    queryFn: () => listPayroll(range, company || undefined),
  });

  const people = useMemo(() => byCandidate(data?.rows ?? []), [data]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return people;
    return people.filter((person) =>
      [person.name, person.phone ?? ""].join(" ").toLowerCase().includes(term),
    );
  }, [people, search]);

  const totals = useMemo(
    () => ({
      ready: shown.reduce((sum, person) => sum + person.readyCents, 0),
      paid: shown.reduce((sum, person) => sum + person.paidCents, 0),
      awaiting: shown.reduce((sum, person) => sum + person.awaitingCents, 0),
      shifts: shown.reduce((sum, person) => sum + shiftCountOf(person.shifts), 0),
      referral: shown.reduce((sum, person) => sum + referralCentsOf(person), 0),
    }),
    [shown],
  );

  // Ready to pay with nowhere to send it. Drawn above the table for the same
  // reason the payroll page does it: finding out halfway through a batch of
  // transfers is how somebody gets missed for a month.
  const stuck = useMemo(
    () => shown.filter((person) => !person.payout && person.readyCents > 0),
    [shown],
  );

  const markPaid = useMutation({
    mutationFn: (person: CandidateSheet) =>
      markPayrollPaid(
        person.shifts
          .filter((shift) => shift.status === "ready")
          .map((shift) => shift.applicationId),
        range.from.slice(0, 7),
      ),
    onSuccess: (result) => {
      // This sheet's range, not the month the response totalled — a week that
      // crosses the 1st is not either month, so the numbers on screen have to
      // come from a refetch rather than from `result.totals`.
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success(`Marked ${result.marked} as paid`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save that"),
  });

  const exportXlsx = useMutation({
    mutationFn: () => downloadPayrollXlsx(range, company || undefined),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not build the spreadsheet",
      ),
  });

  const toggle = (candidateId: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });

  const allOpen = shown.length > 0 && open.size >= shown.length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <MoneyTabs />
      <PayrollSwitch />
      <PageHeader
        title="Payroll by person"
        description="One line per worker, with what they are owed and the shifts behind it."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or phone…"
          className="w-full sm:w-64"
        />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <FilterTabs options={MODES} value={mode} onChange={setMode} />

        {mode === "month" ? (
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            {recentMonths().map((value) => (
              <option key={value} value={value}>
                {monthLabel(value)}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="date"
            value={anchor}
            onChange={(event) => setAnchor(event.target.value || today())}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
        )}

        <select
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          className="h-9 max-w-52 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All companies</option>
          {(data?.companies ?? []).map((item) => (
            <option key={item.companyId} value={item.companyId}>
              {item.companyName}
            </option>
          ))}
        </select>

        {/* The range in words, next to the controls that set it. On Week
            especially, "which week is that" is not obvious from a date box. */}
        <span className="text-sm text-muted-foreground">{rangeText(range)}</span>

        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => exportXlsx.mutate()} disabled={exportXlsx.isPending}>
            <HugeiconsIcon icon={Download04Icon} strokeWidth={1.5} className="size-4" />
            {exportXlsx.isPending ? "Building…" : "Export Excel"}
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(`adhoc-sheet-${rangeLabel(range)}.csv`, sheetCsv(shown, range))
            }
            disabled={shown.length === 0}
          >
            CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`Ready to pay · ${shown.length} ${shown.length === 1 ? "person" : "people"}`}
          count={money(totals.ready)}
          icon={MoneyBag02Icon}
          cls="text-emerald-600"
        />
        <StatCard
          label="Waiting on employer sign-off"
          count={money(totals.awaiting)}
          icon={Clock01Icon}
          cls="text-amber-600"
        />
        <StatCard
          label={`Already paid · ${totals.shifts} shifts in range`}
          count={money(totals.paid)}
          icon={WalletDone02Icon}
          cls="text-sky-600"
        />
      </div>

      {totals.referral > 0 && (
        <p className="-mt-3 text-sm text-muted-foreground">
          Includes {money(totals.referral)} in referral bonuses, paid with wages.
        </p>
      )}

      {stuck.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HugeiconsIcon
                icon={Alert02Icon}
                strokeWidth={1.5}
                className="size-5 text-amber-600"
              />
              {stuck.length} cannot be paid — no PayNow or bank details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {stuck.map((person) => (
              <div
                key={person.candidateId}
                className="flex items-center justify-between gap-4"
              >
                <span>
                  {person.name}
                  <span className="text-muted-foreground">
                    {person.phone ? ` · ${person.phone}` : ""}
                    {` · ${shiftCountOf(person.shifts)} ${shiftCountOf(person.shifts) === 1 ? "shift" : "shifts"}`}
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {money(person.readyCents)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {shown.length} {shown.length === 1 ? "candidate" : "candidates"} ·{" "}
              {totals.shifts} {totals.shifts === 1 ? "shift" : "shifts"}
            </CardTitle>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setOpen(
                  allOpen
                    ? new Set()
                    : new Set(shown.map((person) => person.candidateId)),
                )
              }
              disabled={shown.length === 0}
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
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
              icon={UserGroupIcon}
              message={
                search
                  ? "Nobody matches that search."
                  : "Nobody worked a shift in this period."
              }
            />
          ) : (
            <TableShell
              // The leading chevron column is gone: the chevron sits at the end
              // of the row with the button, the way every other openable row on
              // this dashboard shows it. The figures are right-aligned, headers
              // included, so each column reads as one to add down.
              headers={[
                "Candidate",
                "Pay to",
                <span key="shifts" className="block text-right">
                  Shifts
                </span>,
                <span key="hours" className="block text-right">
                  Hours
                </span>,
                <span key="pay" className="block text-right">
                  To pay
                </span>,
                <span key="waiting" className="block text-right">
                  Waiting
                </span>,
                "",
              ]}
              // This page has its own Export Excel above, with every shift in it.
              exportable={false}
              // No cards view: each person opens into lines of shifts beneath
              // them, and that only reads as a ledger with columns to add down.
              cardView={false}
              // Pay to gets the widest share after the name: it carries a full
              // account number now, and a truncated one is worse than none.
              widths={[
                "w-[24%]",
                "w-[20%]",
                "w-[8%]",
                "w-[9%]",
                "w-[13%]",
                "w-[11%]",
                "w-[15%]",
              ]}
            >
              {shown.map((person) => (
                <PersonRows
                  key={person.candidateId}
                  person={person}
                  open={open.has(person.candidateId)}
                  onToggle={() => toggle(person.candidateId)}
                  onMarkPaid={() => markPaid.mutate(person)}
                  isPending={markPaid.isPending}
                />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PersonRows({
  person,
  open,
  onToggle,
  onMarkPaid,
  isPending,
}: {
  person: CandidateSheet;
  open: boolean;
  onToggle: () => void;
  onMarkPaid: () => void;
  isPending: boolean;
}) {
  const readyShifts = person.shifts.filter((shift) => shift.status === "ready");
  const shiftCount = shiftCountOf(person.shifts);
  const referral = referralCentsOf(person);

  return (
    <>
      <tr className="cursor-pointer align-top" onClick={onToggle}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <InitialsAvatar
              seed={person.candidateId}
              label={initials(person.name)}
              className="size-8"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{person.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {person.phone ?? "No phone"}
              </span>
            </div>
          </div>
        </td>

        {/* EVERYTHING NEEDED TO MAKE THE TRANSFER, in full and on the row.
            The number is mono and select-all: it is copied into a bank app,
            and a digit misread out of a proportional font pays a stranger.
            The account name is there because a bank rejects a transfer whose
            holder does not match the number — PayNow resolves the name from
            the mobile itself, so it is only shown on the bank route. */}
        <td className="px-4 py-3">
          {person.payout ? (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs text-muted-foreground">
                {person.payout.method}
              </span>
              <RevealNumber value={person.payout.number} />
              {person.payout.kind === "bank" && person.payout.holder && (
                <span className="truncate text-xs text-muted-foreground">
                  {person.payout.holder}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs font-medium text-amber-600">No account</span>
          )}
        </td>

        <td className="px-4 py-3 text-right tabular-nums">{shiftCount}</td>

        <td className="px-4 py-3 text-right tabular-nums">{hours(person.minutes)}</td>

        <td className="px-4 py-3 text-right tabular-nums">
          <div className="font-medium">{money(person.readyCents)}</div>
          {referral > 0 && (
            <div className="text-xs text-primary">incl. {money(referral)} referral</div>
          )}
          {person.paidCents > 0 && (
            <div className="text-xs text-sky-600">
              {money(person.paidCents)} paid
            </div>
          )}
        </td>

        {/* Kept in its own column and never added to Ready. An estimate against
            hours nobody has confirmed is not money to send. */}
        <td className="px-4 py-3 text-right tabular-nums">
          {person.awaitingCents > 0 ? (
            <span className="text-amber-600">{money(person.awaitingCents)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>

        {/* The stopPropagation is on the button, not the cell, unlike the
            employers queue: the chevron lives in this cell too, and a click on
            the thing that says "this opens" has to open it. */}
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {readyShifts.length > 0 && person.payout && (
              <Button
                size="xs"
                disabled={isPending}
                // stopPropagation, or paying somebody also toggles the row open
                // underneath the toast and the sheet jumps while it refetches.
                onClick={(event) => {
                  event.stopPropagation();
                  onMarkPaid();
                }}
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                Mark paid
              </Button>
            )}
            <HugeiconsIcon
              icon={open ? ArrowDown01Icon : ArrowRight01Icon}
              strokeWidth={2}
              className="size-4 shrink-0 text-muted-foreground"
            />
          </div>
        </td>
      </tr>

      {/* The breakdown keeps py-2 rather than the row's py-3: it is detail
          under a line, and at full height it competes with the people. */}
      {open &&
        person.shifts.map((shift) => (
          <tr key={shift.applicationId} className="bg-muted/30">
            {/* pl-14 lines the company up under the name, past the avatar. */}
            <td className="px-4 py-2 pl-14">
              {isReferralRow(shift) ? (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-primary">Referral bonus</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {shift.roleName} · {shift.companyName}
                  </span>
                </div>
              ) : (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{shift.companyName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {shift.roleName}
                  </span>
                </div>
              )}
            </td>

            <td className="px-4 py-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs">{date(shift.shiftOnDate)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {isReferralRow(shift)
                    ? "Referred shift"
                    : `${shift.scheduledStart}–${shift.scheduledEnd}`}
                </span>
              </div>
            </td>

            <td />

            {/* The working, so the amount can be checked: hours × hourly rate.
                The rate comes from the role, not divided out of the amount. */}
            <td className="px-4 py-2 text-right text-xs tabular-nums">
              {isReferralRow(shift) ? (
                <span className="text-muted-foreground">Bonus</span>
              ) : (
                <>
                  {hours(shift.minutes)}{" "}
                  <span className="text-muted-foreground">× {money(shift.payPerHourCents)}/h</span>
                </>
              )}
            </td>

            <td className="px-4 py-2 text-right text-xs tabular-nums">
              {shift.status === "awaiting_signoff" ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className={shift.status === "paid" ? "text-sky-600" : ""}>
                  {money(shift.amountCents ?? 0)}
                  {shift.status === "paid" && " paid"}
                </span>
              )}
            </td>

            <td className="px-4 py-2 text-right text-xs tabular-nums">
              {shift.status === "awaiting_signoff" ? (
                <span className="text-amber-600">
                  {money(shift.amountCents ?? 0)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>

            <td />
          </tr>
        ))}

      {/* The subtotal under the breakdown, matching the person's row above. */}
      {open && (
        <tr className="bg-muted/50 text-xs font-medium">
          <td colSpan={3} className="px-4 py-2 pl-14">
            Total for {person.name} · {shiftCount} {shiftCount === 1 ? "shift" : "shifts"}
            {referral > 0 && ` + ${money(referral)} referral`}
          </td>
          <td className="px-4 py-2 text-right tabular-nums">{hours(person.minutes)}</td>
          <td className="px-4 py-2 text-right tabular-nums">
            {money(person.readyCents)} to pay
            {person.paidCents > 0 && (
              <div className="font-normal text-sky-600">{money(person.paidCents)} already paid</div>
            )}
          </td>
          <td className="px-4 py-2 text-right tabular-nums text-amber-600">
            {person.awaitingCents > 0 ? money(person.awaitingCents) : ""}
          </td>
          <td />
        </tr>
      )}
    </>
  );
}

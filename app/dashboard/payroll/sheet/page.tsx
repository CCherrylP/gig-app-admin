"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
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
  today,
  weekRange,
  type CandidateSheet,
  type DateRange,
} from "@/lib/reports";
import { date, money } from "@/lib/format";
import { cn } from "@/lib/utils";

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

  const [mode, setMode] = useState<Mode>("week");
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
      shifts: shown.reduce((sum, person) => sum + person.shifts.length, 0),
    }),
    [shown],
  );

  // Ready to pay with nowhere to send it. Drawn above the table for the same
  // reason the payroll page does it: finding out halfway through a batch of
  // transfers is how somebody gets missed for a month.
  const stuck = useMemo(
    () => shown.filter((person) => !person.hasAccount && person.readyCents > 0),
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
      toast.success(
        result.marked === 1
          ? "1 shift marked as paid"
          : `${result.marked} shifts marked as paid`,
      );
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
      <PageHeader
        title="Attendance sheet"
        description="Who worked, what they are owed, and what makes up the figure. One line per person — a transfer goes to a human being, not to a shift."
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
                    {` · ${person.shifts.length} ${person.shifts.length === 1 ? "shift" : "shifts"}`}
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
              headers={["", "Candidate", "Pay to", "Shifts", "Hours", "Ready", "Waiting", ""]}
              widths={[
                "w-[3%]",
                "w-[24%]",
                "w-[16%]",
                "w-[8%]",
                "w-[9%]",
                "w-[12%]",
                "w-[12%]",
                "w-[16%]",
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

  return (
    <>
      <tr
        className="cursor-pointer border-b align-middle last:border-0 hover:bg-muted/40"
        onClick={onToggle}
      >
        <td className="px-2 py-3">
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-90",
            )}
          />
        </td>

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

        <td className="truncate px-4 py-3">
          {person.payTo ? (
            <span className="truncate text-xs">{person.payTo}</span>
          ) : (
            <span className="text-xs font-medium text-amber-600">No account</span>
          )}
        </td>

        <td className="px-4 py-3 tabular-nums">{person.shifts.length}</td>

        <td className="px-4 py-3 tabular-nums">{hours(person.minutes)}</td>

        <td className="px-4 py-3 text-right tabular-nums">
          <span className="font-medium">{money(person.readyCents)}</span>
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

        <td className="px-4 py-3 text-right">
          {readyShifts.length > 0 && person.hasAccount && (
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
        </td>
      </tr>

      {open &&
        person.shifts.map((shift) => (
          <tr key={shift.applicationId} className="border-b bg-muted/30 last:border-0">
            <td />

            <td className="px-4 py-2 pl-10">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{shift.companyName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {shift.roleName}
                </span>
              </div>
            </td>

            <td className="px-4 py-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs">{date(shift.shiftOnDate)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {shift.scheduledStart}–{shift.scheduledEnd}
                </span>
              </div>
            </td>

            <td className="px-4 py-2 text-xs text-muted-foreground">
              {/* The rate, so the total is checkable: hours × rate. Sent by the
                  API from the role rather than divided out of the amount —
                  see payPerHourCents in lib/reports. */}
              {money(shift.payPerHourCents)}/h
            </td>

            <td className="px-4 py-2 text-xs tabular-nums">{hours(shift.minutes)}</td>

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
    </>
  );
}

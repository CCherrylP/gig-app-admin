"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Coins01Icon,
  PencilEdit02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  type IconType,
} from "@/components/dashboard/data-views";
import {
  BREAK_LENGTHS,
  SHIFT_STATE_LABEL,
  listShifts,
  payableMinutes,
  seatWageCents,
  shiftHours,
  shiftState,
  updateShift,
  wageCents,
  windowMinutes,
  type AdminShift,
  type ShiftEdit,
  type ShiftFilter,
  type ShiftState,
} from "@/lib/shifts";
import { currentMonth, monthLabel, monthRange, today } from "@/lib/reports";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

// EVERY SHIFT ON THE PLATFORM, month by month, past ones included.
//
// WHY THIS SCREEN EXISTS beside Clock in / clock out and Payroll, which are both
// about shifts too. Those two start somewhere else: attendance starts from an
// APPLICATION and only lists shifts somebody turned up to, payroll from money
// owed. A shift nobody applied to appears in neither — so "what is on for the
// 14th" and "this was posted on the wrong Saturday" were questions this
// dashboard could not answer at all.
//
// THE CALENDAR AND THE LIST ARE ONE SCREEN, not two tabs. They answer different
// halves of the same question — the grid is where a missing Sunday or a
// double-booked Saturday is VISIBLE, and the table is where the detail is
// readable — and a toggle would mean seeing one and remembering the other.
// Clicking a day narrows the table to it; clicking a shift opens the correction.
//
// WHAT AN EDIT HERE ACTUALLY DOES, because it is more than it looks. The
// employer cannot make this change: their own route refuses a date or hours move
// once anybody is booked, because on their side that is a different offer rather
// than an edit. This one goes through, re-prices the listing so the employer's
// hold matches the roster, refuses a move that would double-book somebody, and
// tells everybody standing on the shift. What it will not do is touch hours that
// have been SETTLED — those are what somebody was paid.

const FILTERS: { value: ShiftFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "unfilled", label: "Seats to fill" },
];

const STATE_STYLES: Record<string, string> = {
  SETTLED: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  FULL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  PART: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  EMPTY: "bg-muted text-muted-foreground",
};

/** The calendar chip, which is the same four states in a smaller space. Left
 *  border rather than a filled block: a day with four shifts on it is four
 *  stripes that can still be told apart, where four solid colours is a mess. */
const CHIP_STYLES: Record<ShiftState, string> = {
  settled: "border-l-sky-400 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  full: "border-l-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  part: "border-l-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  empty: "border-l-border bg-muted/60 text-muted-foreground",
};

// Monday first. Singapore rosters are read that way and a week starting on
// Sunday puts the two busiest days of a weekend in different rows.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 'YYYY-MM' moved by whole months. Built from UTC parts so December cannot roll
 *  into the wrong year and the reader's own timezone never gets in. */
function stepMonth(month: string, by: number) {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1 + by, 1)).toISOString().slice(0, 7);
}

/** The cells of a month's grid: leading blanks to line the 1st up under its
 *  weekday, every day of the month, then trailing blanks so the last week is a
 *  whole row. */
function monthCells(month: string): (string | null)[] {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1));
  const length = new Date(Date.UTC(year, m, 0)).getUTCDate();

  // getUTCDay() is Sunday-based; this rotates it to Monday-based.
  const lead = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);

  for (let d = 1; d <= length; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }

  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/** 'Sat 14 Sep' — the weekday earns its space here. A roster is argued about in
 *  weekdays ("the Saturday shift"), and a date with no day name on it is one
 *  somebody has to count out on a calendar. */
function dayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-SG", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export default function ShiftsPage() {
  const queryClient = useQueryClient();

  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState<ShiftFilter>("all");
  const [search, setSearch] = useState("");
  /** The day the table is narrowed to, or the whole month. */
  const [day, setDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminShift | null>(null);

  const range = useMemo(() => monthRange(month), [month]);

  const { data, isLoading } = useQuery({
    queryKey: ["shifts", month, filter],
    queryFn: () => listShifts(range, filter),
  });

  // The search is client-side, unlike the filter tabs. The month is already in
  // hand and capped, and "Tan" typed one letter at a time should not be five
  // round trips — where a tab is a different question and is asked of the API.
  const shifts = useMemo(() => {
    const all = data?.shifts ?? [];
    const term = search.trim().toLowerCase();

    if (!term) return all;

    return all.filter((shift) =>
      [
        shift.companyName,
        shift.gigTitle,
        shift.roleName,
        shift.location,
        ...shift.bookings.map((booking) => booking.candidateName ?? ""),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data, search]);

  const byDay = useMemo(() => {
    const map = new Map<string, AdminShift[]>();
    for (const shift of shifts) {
      const list = map.get(shift.onDate);
      if (list) list.push(shift);
      else map.set(shift.onDate, [shift]);
    }
    return map;
  }, [shifts]);

  const listed = day ? (byDay.get(day) ?? []) : shifts;

  const save = useMutation({
    mutationFn: ({ id, edit }: { id: string; edit: ShiftEdit }) =>
      updateShift(id, edit),
    onSuccess: (shift) => {
      // The month, and everything downstream of a shift's hours: the attendance
      // rows carry the scheduled times beside the actual ones, and payroll pays
      // by the scheduled length.
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      setEditing(null);
      toast.success(
        shift.locked
          ? `Shift moved to ${dayLabel(shift.onDate)}, ${shift.startTime}–${shift.endTime}. Everyone on it has been told.`
          : `Shift saved — ${dayLabel(shift.onDate)}, ${shift.startTime}–${shift.endTime}.`,
      );
    },
    onError: (error: Error) => {
      // SHIFT_SETTLED, SHIFT_CLASH, SHIFT_IN_USE and CANNOT_AFFORD all land
      // here, and the API's sentence names the person or the amount — which is
      // more use than anything this screen could say about it.
      toast.error(error.message || "Could not save that change");
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });

  const goToMonth = (next: string) => {
    setMonth(next);
    // A day in the month somebody has just left is not a selection any more,
    // and leaving it set would show an empty table under a full calendar.
    setDay(null);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Shifts"
        description="Every shift on the platform, month by month, finished ones included. This is the only place a booked shift's date or hours can be corrected."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search company, job, role or candidate…"
          className="w-full sm:w-72"
        />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* The first card follows the TAB and the other two follow the month —
            which is why it is labelled "listed" rather than "this month". The
            two beside it are the same number on every tab, deliberately: see
            openCount in lib/shifts. */}
        <StatCard
          label="Shifts listed"
          count={data?.total ?? "—"}
          icon={Calendar03Icon}
        />
        <StatCard
          label="Seats still to fill"
          count={data?.openCount ?? "—"}
          icon={UserMultiple02Icon}
          cls="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          label="Shifts with somebody on"
          count={data?.bookedCount ?? "—"}
          icon={CheckmarkCircle02Icon}
          cls="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => goToMonth(stepMonth(month, -1))}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium">
            {monthLabel(month)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => goToMonth(stepMonth(month, 1))}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
          </Button>
          {month !== currentMonth() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToMonth(currentMonth())}
            >
              This month
            </Button>
          )}
        </div>
      </div>

      <MonthGrid
        cells={monthCells(month)}
        byDay={byDay}
        selected={day}
        onSelectDay={(value) => setDay(value === day ? null : value)}
        onOpenShift={setEditing}
        isLoading={isLoading}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {day ? dayLabel(day) : monthLabel(month)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {listed.length} {listed.length === 1 ? "shift" : "shifts"}
              </span>
            </CardTitle>
            {day && (
              <Button variant="outline" size="sm" onClick={() => setDay(null)}>
                Show the whole month
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : listed.length === 0 ? (
            <EmptyState
              icon={Calendar03Icon}
              message={
                search
                  ? "Nothing matches that search."
                  : day
                    ? "Nothing is on that day."
                    : "No shifts in this month."
              }
            />
          ) : (
            <TableShell
              headers={["When", "Job", "Role", "Seats", "Paid hours", "State", ""]}
              widths={[
                "w-[16%]",
                "w-[26%]",
                "w-[16%]",
                "w-[10%]",
                "w-[14%]",
                "w-[10%]",
                "w-[8%]",
              ]}
            >
              {listed.map((shift) => (
                <ShiftRow
                  key={shift.id}
                  shift={shift}
                  onEdit={() => setEditing(shift)}
                />
              ))}
            </TableShell>
          )}
          {data?.truncated && (
            <p className="border-t px-6 py-3 text-xs text-muted-foreground">
              This month has more shifts than one page holds, so the list is cut.
              Narrow it with the search or the tabs.
            </p>
          )}
        </CardContent>
      </Card>

      <EditShiftDialog
        shift={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={(edit) => editing && save.mutate({ id: editing.id, edit })}
        isPending={save.isPending}
      />
    </div>
  );
}

// --- the calendar -------------------------------------------------------------

/** How many chips fit in a cell before it says "+2 more". Three, because a cell
 *  that grows with its busiest day makes every other row in the month taller —
 *  and the day's own row in the table below is one click away. */
const CHIPS_PER_DAY = 3;

function MonthGrid({
  cells,
  byDay,
  selected,
  onSelectDay,
  onOpenShift,
  isLoading,
}: {
  cells: (string | null)[];
  byDay: Map<string, AdminShift[]>;
  selected: string | null;
  onSelectDay: (day: string) => void;
  onOpenShift: (shift: AdminShift) => void;
  isLoading: boolean;
}) {
  const now = today();

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b text-xs uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((name) => (
            <div key={name} className="px-2 py-2 text-center font-medium">
              {name}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-24 border-b border-r p-2">
                <div className="h-3 w-5 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((day, index) => {
              if (!day) {
                // A cell for a day in the neighbouring month. Left blank and
                // tinted rather than filled in with that month's dates: a grid
                // that shows the 31st of August under Monday invites somebody to
                // click it and then answers with an empty table.
                return (
                  <div
                    key={`blank-${index}`}
                    className="min-h-24 border-b border-r bg-muted/30"
                  />
                );
              }

              const onThisDay = byDay.get(day) ?? [];
              const isToday = day === now;
              const isPast = day < now;

              return (
                <div
                  key={day}
                  className={cn(
                    "flex min-h-24 flex-col gap-1 border-b border-r p-1.5",
                    selected === day && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                    // Dimmed, not hidden. A finished day is still a day somebody
                    // asks about — it just is not one anybody can staff.
                    isPast && "bg-muted/20",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="flex items-center justify-between rounded px-1 text-left text-xs transition-colors hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        isToday &&
                          "rounded-full bg-primary px-1.5 text-primary-foreground",
                        isPast && !isToday && "text-muted-foreground",
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {onThisDay.length > 0 && (
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {onThisDay.length}
                      </span>
                    )}
                  </button>

                  {onThisDay.slice(0, CHIPS_PER_DAY).map((shift) => (
                    <button
                      key={shift.id}
                      type="button"
                      onClick={() => onOpenShift(shift)}
                      title={`${shift.startTime}–${shift.endTime} · ${shift.roleName} · ${shift.companyName}`}
                      className={cn(
                        "flex min-w-0 flex-col rounded border-l-2 px-1.5 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-80",
                        CHIP_STYLES[shiftState(shift)],
                      )}
                    >
                      <span className="truncate font-medium tabular-nums">
                        {shift.startTime} {shift.roleName}
                      </span>
                      <span className="truncate opacity-75">
                        {shift.filled}/{shift.headcount} · {shift.companyName}
                      </span>
                    </button>
                  ))}

                  {onThisDay.length > CHIPS_PER_DAY && (
                    <button
                      type="button"
                      onClick={() => onSelectDay(day)}
                      className="px-1.5 text-left text-[11px] font-medium text-primary hover:underline"
                    >
                      +{onThisDay.length - CHIPS_PER_DAY} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- the list -----------------------------------------------------------------

function ShiftRow({
  shift,
  onEdit,
}: {
  shift: AdminShift;
  onEdit: () => void;
}) {
  const state = shiftState(shift);
  const breakTotal = shift.unpaidBreakMinutes * shift.unpaidBreakCount;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          <span className="text-sm font-medium">{dayLabel(shift.onDate)}</span>
          <span className="tabular-nums text-muted-foreground">
            {shift.startTime}–{shift.endTime}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          <span className="truncate text-sm font-medium">{shift.companyName}</span>
          <span className="truncate text-muted-foreground">{shift.gigTitle}</span>
          <span className="truncate text-muted-foreground">{shift.location}</span>
          {shift.gigClosedAt && (
            // The listing is down but the shift is not: people worked it and
            // were paid for it. Saying so is what stops a closed job reading as
            // a live hole in the roster.
            <span className="truncate text-muted-foreground">Listing closed</span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          <span className="truncate text-sm font-medium">{shift.roleName}</span>
          <span className="text-muted-foreground">
            {money(shift.payPerHourCents)}/h
          </span>
          <span className="text-muted-foreground">
            {money(seatWageCents(shift))} a seat
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          <span className="text-sm font-medium tabular-nums">
            {shift.filled}/{shift.headcount}
          </span>
          {shift.bookings.length > 0 && (
            <span className="truncate text-muted-foreground">
              {shift.bookings
                .map((booking) => booking.candidateName ?? "Unnamed")
                .join(", ")}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          <span className="text-sm font-medium">{shiftHours(shift.paidMinutes)}</span>
          {breakTotal > 0 && (
            <span className="text-muted-foreground">
              {shift.unpaidBreakCount}×{shift.unpaidBreakMinutes}m unpaid
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <StatusPill
          status={state}
          label={SHIFT_STATE_LABEL[state]}
          styles={STATE_STYLES}
        />
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end">
          <Button variant="outline" size="xs" onClick={onEdit}>
            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
            {shift.settled ? "Open" : "Edit"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// --- the correction -----------------------------------------------------------

function EditShiftDialog({
  shift,
  onOpenChange,
  onSave,
  isPending,
}: {
  shift: AdminShift | null;
  onOpenChange: (open: boolean) => void;
  onSave: (edit: ShiftEdit) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    onDate: "",
    startTime: "",
    endTime: "",
    headcount: 1,
    breakMinutes: 0,
    breakCount: 0,
  });
  const [prevId, setPrevId] = useState<string | null>(null);

  // Loaded from the shift when a different row opens the dialog — adjusted
  // during render rather than in an effect, the same way the release dialog on
  // the attendance screen does it. Last row's times left in the boxes is the
  // worst possible starting point for an edit that moves somebody's week.
  if ((shift?.id ?? null) !== prevId) {
    setPrevId(shift?.id ?? null);
    setForm({
      onDate: shift?.onDate ?? "",
      startTime: shift?.startTime ?? "",
      endTime: shift?.endTime ?? "",
      headcount: shift?.headcount ?? 1,
      breakMinutes: shift?.unpaidBreakMinutes ?? 0,
      breakCount: shift?.unpaidBreakCount ?? 0,
    });
  }

  const valid =
    Boolean(form.onDate) && Boolean(form.startTime) && Boolean(form.endTime);

  // What the shift would come to, computed from the form rather than fetched.
  // The point is to show the consequence BEFORE the button is pressed: an hour
  // added here is an hour of wages the employer's balance is about to hold.
  const onSite = valid ? windowMinutes(form.startTime, form.endTime) : 0;
  const paid = valid
    ? payableMinutes(form.startTime, form.endTime, form.breakMinutes, form.breakCount)
    : 0;
  const perSeat = shift ? wageCents(paid, shift.payPerHourCents) : 0;

  const breaksTooLong = onSite > 0 && form.breakMinutes * form.breakCount >= onSite;
  const belowBooked = shift ? form.headcount < shift.filled : false;

  // Only what somebody actually changed. Sending the whole form would be
  // harmless today and a trap the day the API grows a field this screen does
  // not know about.
  const edit: ShiftEdit = {};

  if (shift) {
    if (form.onDate !== shift.onDate) edit.onDate = form.onDate;
    if (form.startTime !== shift.startTime) edit.startTime = form.startTime;
    if (form.endTime !== shift.endTime) edit.endTime = form.endTime;
    if (form.headcount !== shift.headcount) edit.headcount = form.headcount;
    if (form.breakMinutes !== shift.unpaidBreakMinutes) {
      edit.unpaidBreakMinutes = form.breakMinutes;
    }
    if (form.breakCount !== shift.unpaidBreakCount) {
      edit.unpaidBreakCount = form.breakCount;
    }
  }

  const changed = Object.keys(edit).length > 0;
  const blocked = !valid || breaksTooLong || belowBooked || shift?.settled;

  return (
    <Dialog open={!!shift} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {shift?.settled ? "This shift has been settled" : "Correct this shift"}
          </DialogTitle>
          <DialogDescription>
            {shift && (
              <>
                {shift.roleName} at {shift.companyName} —{" "}
                <span className="font-medium text-foreground">{shift.gigTitle}</span>,{" "}
                {shift.location}. The role pays{" "}
                <span className="font-medium text-foreground">
                  {money(shift.payPerHourCents)}
                </span>{" "}
                an hour, and that is fixed here: the rate is the deal, and it
                belongs to the listing.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {shift && (
          <div className="flex flex-col gap-4 px-6 pb-4">
            {/* WHAT THE EDIT WILL DO TO SOMEBODY, before the fields rather than
                after them. A note under the save button is one nobody reads
                until they have already typed the change. */}
            {shift.settled ? (
              <Notice tone="blocked">
                The hours on this shift have been signed off, so somebody has
                already been paid for them. Editing them now would leave a payslip
                describing a shift that no longer exists — correct the sign-off
                from Clock in / clock out instead. Everything below is read-only.
              </Notice>
            ) : shift.locked ? (
              <Notice tone="warn">
                {shift.bookings.length === 1
                  ? "1 person is on this shift"
                  : `${shift.bookings.length} people are on this shift`}
                :{" "}
                {shift.bookings
                  .map((booking) => booking.candidateName ?? "an unnamed candidate")
                  .join(", ")}
                . Moving it changes their week, and they are told as soon as it
                saves. A move that would double-book any of them is refused.
              </Notice>
            ) : (
              <Notice tone="calm">
                Nobody is booked on this shift yet, so this is a plain correction.
              </Notice>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor="shift-date">
                <Input
                  id="shift-date"
                  type="date"
                  value={form.onDate}
                  disabled={shift.settled}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, onDate: event.target.value }))
                  }
                />
              </Field>

              <Field label="How many people" htmlFor="shift-headcount">
                <Input
                  id="shift-headcount"
                  type="number"
                  min={1}
                  max={50}
                  value={form.headcount}
                  disabled={shift.settled}
                  onChange={(event) =>
                    setForm((f) => ({
                      ...f,
                      headcount: Number(event.target.value),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {shift.filled} booked. Raising it opens a seat; it cannot go
                  below the people already on it.
                </p>
              </Field>

              <Field label="Starts" htmlFor="shift-start">
                <Input
                  id="shift-start"
                  type="time"
                  value={form.startTime}
                  disabled={shift.settled}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, startTime: event.target.value }))
                  }
                />
              </Field>

              <Field label="Ends" htmlFor="shift-end">
                <Input
                  id="shift-end"
                  type="time"
                  value={form.endTime}
                  disabled={shift.settled}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, endTime: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  An end before the start runs overnight, which is allowed.
                </p>
              </Field>

              <Field label="Unpaid break" htmlFor="shift-break-minutes">
                <select
                  id="shift-break-minutes"
                  value={form.breakMinutes}
                  disabled={shift.settled}
                  onChange={(event) => {
                    const minutes = Number(event.target.value);
                    // The pair only means anything together, so the two controls
                    // move together: no length is no break, and picking one
                    // implies at least one of them.
                    setForm((f) => ({
                      ...f,
                      breakMinutes: minutes,
                      breakCount:
                        minutes === 0 ? 0 : f.breakCount === 0 ? 1 : f.breakCount,
                    }));
                  }}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm disabled:opacity-50"
                >
                  {BREAK_LENGTHS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes === 0 ? "None" : `${minutes} minutes`}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="How many breaks" htmlFor="shift-break-count">
                <Input
                  id="shift-break-count"
                  type="number"
                  min={0}
                  max={4}
                  value={form.breakCount}
                  disabled={shift.settled || form.breakMinutes === 0}
                  onChange={(event) =>
                    setForm((f) => ({
                      ...f,
                      breakCount: Number(event.target.value),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Two half-hours on a twelve-hour shift is an ordinary roster.
                </p>
              </Field>
            </div>

            {/* The consequence, in the two numbers that matter: the hours this
                becomes and what one seat of it pays. Both are what the API will
                hold against the employer's balance. */}
            <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/40 px-4 py-3 text-xs">
              <Figure
                icon={Clock01Icon}
                label="On site"
                value={valid ? shiftHours(onSite) : "—"}
              />
              <Figure
                icon={Clock01Icon}
                label="Paid hours"
                value={valid ? shiftHours(paid) : "—"}
                was={
                  paid !== shift.paidMinutes ? shiftHours(shift.paidMinutes) : undefined
                }
              />
              <Figure
                icon={Coins01Icon}
                label="A seat pays"
                value={valid ? money(perSeat) : "—"}
                was={
                  perSeat !== seatWageCents(shift)
                    ? money(seatWageCents(shift))
                    : undefined
                }
              />
              <Figure
                icon={UserMultiple02Icon}
                label="Whole shift"
                value={valid ? money(perSeat * form.headcount) : "—"}
              />
            </div>

            {breaksTooLong && (
              <Notice tone="blocked">
                The breaks are longer than the shift. There would be nothing to
                pay.
              </Notice>
            )}

            {belowBooked && (
              <Notice tone="blocked">
                {shift.filled} {shift.filled === 1 ? "person is" : "people are"}{" "}
                already booked, so this cannot be cut to {form.headcount}. A seat
                with somebody in it is not one arithmetic can delete.
              </Notice>
            )}

            {!shift.settled && changed && (
              <p className="text-xs text-muted-foreground">
                Saving re-prices the listing: the employer&apos;s held wages and
                placement fee move by the difference, in the same transaction, and
                the change is refused if their balance cannot cover it.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {shift?.settled ? "Close" : "Back"}
          </Button>
          {!shift?.settled && (
            <Button
              size="sm"
              disabled={isPending || blocked || !changed}
              onClick={() => onSave(edit)}
            >
              {isPending ? "Saving…" : changed ? "Save the correction" : "No change yet"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function Figure({
  icon,
  label,
  value,
  was,
}: {
  icon: IconType;
  label: string;
  value: string;
  /** What it is now, when the form has changed it. Shown struck through beside
   *  the new figure — "4h" alone does not say whether anything moved, and that
   *  is the whole question somebody has this dialog open to answer. */
  was?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <HugeiconsIcon
        icon={icon}
        size={14}
        strokeWidth={2}
        className="shrink-0 text-muted-foreground"
      />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-medium tabular-nums">
          {was && (
            <span className="mr-1.5 font-normal text-muted-foreground line-through">
              {was}
            </span>
          )}
          {value}
        </span>
      </div>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "calm" | "warn" | "blocked";
  children: ReactNode;
}) {
  const styles = {
    calm: "border-border bg-muted/40 text-muted-foreground",
    warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    blocked:
      "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300",
  }[tone];

  return (
    <div className={cn("flex gap-2 rounded-lg border px-3 py-2 text-xs", styles)}>
      {tone !== "calm" && (
        <HugeiconsIcon
          icon={Alert02Icon}
          size={14}
          strokeWidth={2}
          className="mt-0.5 shrink-0"
        />
      )}
      <p>{children}</p>
    </div>
  );
}

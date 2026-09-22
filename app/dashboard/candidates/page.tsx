"use client";

import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserGroupIcon,
  Mail01Icon,
  CallIcon,
  UserBlock01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
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
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  FilterTabs,
  InitialsAvatar,
  PageHeader,
  SearchInput,
  TableShell,
  TableSkeleton,
  initials,
} from "@/components/dashboard/data-views";
import {
  CANDIDATE_PAGE_SIZE,
  hasOwnCap,
  listCandidates,
  ratingLabel,
  setHoursCap,
  setSuspension,
  type BookingFilter,
  type CandidateSummary,
} from "@/lib/candidates";
import { MIN_CAP_MINUTES, capLabel, toHours, toMinutes } from "@/lib/settings";
import { date, isPast, relative } from "@/lib/format";

type VerifiedFilter = "all" | "verified" | "unverified";

const VERIFIED_FILTERS: { value: VerifiedFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "verified", label: "Singpass verified" },
  { value: "unverified", label: "Not verified" },
];

const BOOKING_FILTERS: { value: BookingFilter; label: string }[] = [
  { value: "all", label: "Any status" },
  { value: "suspended", label: "Suspended" },
  { value: "blocked", label: "Timed block" },
  { value: "clear", label: "Can book" },
];

export default function CandidatesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [verified, setVerified] = useState<VerifiedFilter>("all");
  const [booking, setBooking] = useState<BookingFilter>("all");
  const [offset, setOffset] = useState(0);
  const [target, setTarget] = useState<CandidateSummary | null>(null);
  // A separate target from the suspension's, so the two dialogs cannot be open
  // about different people at once — and so closing one does not clear the
  // other's row out from under it.
  const [capping, setCapping] = useState<CandidateSummary | null>(null);

  // The search goes to the API rather than filtering a page in the browser —
  // this list is capped at fifty rows, so a client-side filter would only ever
  // search the fifty already fetched and silently miss everybody else.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["candidates", search, verified, booking, offset],
    queryFn: () =>
      listCandidates({ q: search || undefined, verified, booking, offset }),
    // Keeps the table on screen while the next page loads instead of flashing
    // the skeleton on every keystroke.
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: ({
      candidate,
      suspended,
      reason,
    }: {
      candidate: CandidateSummary;
      suspended: boolean;
      reason?: string;
    }) => setSuspension(candidate.userId, suspended, reason),
    onSuccess: (_result, { suspended }) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setTarget(null);
      toast.success(
        suspended
          ? "Candidate suspended, they have been told why"
          : "Suspension lifted, they can book again",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not change that suspension");
    },
  });

  const capMutation = useMutation({
    mutationFn: ({
      candidate,
      cap,
    }: {
      candidate: CandidateSummary;
      cap: {
        maxDailyMinutes: number | null;
        maxWeeklyMinutes: number | null;
        reason?: string | null;
      };
    }) => setHoursCap(candidate.userId, cap),
    onSuccess: (_result, { cap }) => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setCapping(null);
      toast.success(
        cap.maxDailyMinutes === null && cap.maxWeeklyMinutes === null
          ? "Back on the platform's hours limits"
          : "Hours limit saved for this candidate",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not save that limit");
    },
  });

  const candidates = data?.candidates ?? [];
  const total = data?.total ?? 0;
  const showing = offset + candidates.length;

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      // Page 3 of a different search is not a page anybody asked for.
      setOffset(0);
    };
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Candidates"
        description="For support. Finding the person who wrote in, and seeing what is keeping them from applying."
      >
        <SearchInput
          value={search}
          onChange={change(setSearch)}
          placeholder="Search name or phone…"
          className="w-full sm:w-72"
        />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterTabs
            options={VERIFIED_FILTERS}
            value={verified}
            onChange={change<VerifiedFilter>(setVerified)}
          />
          <FilterTabs
            options={BOOKING_FILTERS.map((f) => ({
              ...f,
              // Suspended accounts are the only queue on this page: the sweep
              // stopped them and they cannot earn until somebody looks.
              count: f.value === "suspended" ? data?.suspendedCount : undefined,
            }))}
            value={booking}
            onChange={change<BookingFilter>(setBooking)}
          />
        </div>
        {total > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Showing {offset + 1}–{showing} of {total}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : candidates.length === 0 ? (
            <EmptyState
              icon={UserGroupIcon}
              message={
                search ? "Nobody matches that search." : "No candidates yet."
              }
            />
          ) : (
            <TableShell
              headers={[
                "Candidate",
                "Contact",
                "Track record",
                "Can book?",
                "Waiting on us",
                "Actions",
              ]}
              widths={[
                "w-[20%]",
                "w-[20%]",
                "w-[15%]",
                "w-[22%]",
                "w-[11%]",
                "w-[12%]",
              ]}
            >
              {candidates.map((candidate) => (
                <CandidateRow
                  key={candidate.userId}
                  candidate={candidate}
                  onToggle={() => setTarget(candidate)}
                  onEditHours={() => setCapping(candidate)}
                />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      {total > CANDIDATE_PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0 || isFetching}
            onClick={() => setOffset(Math.max(0, offset - CANDIDATE_PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={showing >= total || isFetching}
            onClick={() => setOffset(offset + CANDIDATE_PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      )}

      <SuspensionDialog
        candidate={target}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        onConfirm={(suspended, reason) =>
          target && mutation.mutate({ candidate: target, suspended, reason })
        }
        isPending={mutation.isPending}
      />

      <HoursCapDialog
        candidate={capping}
        onOpenChange={(open) => {
          if (!open) setCapping(null);
        }}
        onSave={(cap) =>
          capping && capMutation.mutate({ candidate: capping, cap })
        }
        isPending={capMutation.isPending}
      />
    </div>
  );
}

function CandidateRow({
  candidate,
  onToggle,
  onEditHours,
}: {
  candidate: CandidateSummary;
  onToggle: () => void;
  onEditHours: () => void;
}) {
  const name = candidate.name ?? "Unnamed candidate";
  const suspended = !!candidate.suspendedAt;
  // A block whose date has passed is simply over — nothing clears the column,
  // because on the API side the comparison IS the rule.
  const timedBlock =
    !suspended &&
    !!candidate.bookingBlockedUntil &&
    !isPast(candidate.bookingBlockedUntil);

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={candidate.userId}
            label={initials(name)}
            className="size-8"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {candidate.verified ? "Verified" : "Not verified"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {candidate.area ?? "No area given"}
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon
              icon={Mail01Icon}
              size={13}
              strokeWidth={2}
              className="shrink-0 text-muted-foreground"
            />
            <span className="truncate">{candidate.email ?? "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon
              icon={CallIcon}
              size={13}
              strokeWidth={2}
              className="shrink-0 text-muted-foreground"
            />
            <span className="truncate">{candidate.phone ?? "—"}</span>
          </span>
          {/* Null means not answered, which is a different thing from not
              allowed — so it reads as a gap rather than as a refusal. */}
          <span className="truncate text-muted-foreground">
            {candidate.workStatus ?? "Work status not answered"}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          {/* 0 is NOT RATED YET, never a zero-star score — nothing in this app
              can rate somebody below 1. */}
          <span className="font-medium">{ratingLabel(candidate.rating)}</span>
          <span className="truncate text-muted-foreground">
            {candidate.shiftsDone} shift
            {candidate.shiftsDone === 1 ? "" : "s"} done
          </span>
          <span className="truncate text-muted-foreground">
            {candidate.turnUpRate == null
              ? "No turn-up rate yet"
              : `${candidate.turnUpRate}% turn-up`}
          </span>
          {candidate.lateCancels > 0 && (
            <span className="truncate font-medium text-amber-600 dark:text-amber-400">
              {candidate.lateCancels} late cancel
              {candidate.lateCancels === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </td>

      {/* The two ways of being stopped, told apart. A reviewer deciding whether
          to lift something has to know which one they are looking at: a timed
          block ends on a date they can quote, a suspension ends when they
          decide it does. */}
      <td className="px-4 py-3">
        {suspended ? (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="inline-flex w-fit items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Suspended
            </span>
            <span className="line-clamp-2 text-xs text-foreground/80">
              {candidate.suspensionReason ?? "No reason recorded"}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {relative(candidate.suspendedAt)}
              {/* Null here means the SWEEP did it, which is a different fact
                  from a missing one — and it is the first thing asked when
                  somebody writes in to argue. */}
              {candidate.suspendedById ? " · by staff" : " · automatic"}
            </span>
          </div>
        ) : timedBlock ? (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Blocked
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              Until {date(candidate.bookingBlockedUntil)}
            </span>
          </div>
        ) : (
          <span className="inline-flex w-fit items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Can book
          </span>
        )}

        {/* THE THIRD REASON A BOOKING CAN BE REFUSED, and it belongs in this
            column rather than one of its own: the question the column asks is
            "can they book", and somebody on 16 hours a week can book until
            they cannot. It is not a penalty, so it sits under the pill rather
            than replacing it. */}
        {hasOwnCap(candidate) && (
          <div className="mt-1.5 flex min-w-0 flex-col gap-0.5">
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              <HugeiconsIcon icon={Clock01Icon} size={11} strokeWidth={2} />
              {candidate.maxWeeklyMinutes !== null
                ? `${capLabel(candidate.maxWeeklyMinutes)} a week`
                : `${capLabel(candidate.maxDailyMinutes)} a day`}
            </span>
            <span className="line-clamp-2 text-[11px] text-muted-foreground">
              {candidate.hoursCapReason ?? "Own hours limit"}
            </span>
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        {/* The answer to "why can't I apply" nine times out of ten. */}
        {candidate.pendingCertificates > 0 ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {candidate.pendingCertificates} cert
            {candidate.pendingCertificates === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Nothing</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button variant="outline" size="xs" onClick={onEditHours}>
            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />
            Hours
          </Button>
          {suspended ? (
            <Button size="xs" onClick={onToggle}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
              Lift
            </Button>
          ) : (
            <Button variant="destructive" size="xs" onClick={onToggle}>
              <HugeiconsIcon icon={UserBlock01Icon} strokeWidth={2} />
              Suspend
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

/** The three things one of these numbers can say. A form with a blank box
 *  cannot tell them apart — "empty" would have to mean either "follow the
 *  platform" or "no limit", and those are opposite instructions. */
type CapMode = "default" | "none" | "custom";

const MODES: { value: CapMode; label: string }[] = [
  { value: "default", label: "Platform limit" },
  { value: "none", label: "No limit" },
  { value: "custom", label: "Their own limit" },
];

const modeOf = (minutes: number | null): CapMode =>
  minutes === null ? "default" : minutes === 0 ? "none" : "custom";

function HoursCapDialog({
  candidate,
  onOpenChange,
  onSave,
  isPending,
}: {
  candidate: CandidateSummary | null;
  onOpenChange: (open: boolean) => void;
  onSave: (cap: {
    maxDailyMinutes: number | null;
    maxWeeklyMinutes: number | null;
    reason?: string | null;
  }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    dailyMode: "default" as CapMode,
    dailyHours: "",
    weeklyMode: "default" as CapMode,
    weeklyHours: "",
    reason: "",
  });
  const [prevId, setPrevId] = useState<string | null>(null);

  // Loaded from the row when a different candidate opens the dialog, adjusted
  // during render rather than in an effect — the same pattern the suspension
  // dialog below uses. A limit left over from the last person is the worst
  // possible thing to have sitting in these boxes.
  if ((candidate?.userId ?? null) !== prevId) {
    setPrevId(candidate?.userId ?? null);
    setForm({
      dailyMode: modeOf(candidate?.maxDailyMinutes ?? null),
      dailyHours: candidate?.maxDailyMinutes
        ? String(toHours(candidate.maxDailyMinutes))
        : "",
      weeklyMode: modeOf(candidate?.maxWeeklyMinutes ?? null),
      weeklyHours: candidate?.maxWeeklyMinutes
        ? String(toHours(candidate.maxWeeklyMinutes))
        : "",
      reason: candidate?.hoursCapReason ?? "",
    });
  }

  const minutesFor = (mode: CapMode, typed: string): number | null | undefined => {
    if (mode === "default") return null;
    if (mode === "none") return 0;

    const minutes = toMinutes(Number(typed));
    // `undefined` is "they chose their own limit and have not given a usable
    // one yet" — a third answer from the null that means "follow the platform",
    // and the reason the save button can be blocked without guessing.
    if (typed.trim() === "" || !Number.isFinite(minutes)) return undefined;
    return minutes;
  };

  const daily = minutesFor(form.dailyMode, form.dailyHours);
  const weekly = minutesFor(form.weeklyMode, form.weeklyHours);

  const badNumber = (minutes: number | null | undefined) =>
    minutes === undefined || (minutes !== null && minutes !== 0 && minutes < MIN_CAP_MINUTES);

  const clearing = daily === null && weekly === null;
  // Matches the API's floor, and the reason for it is the same as the
  // suspension's: this text is shown to the candidate when a booking is refused.
  const reasonTooShort = form.reason.trim().length < 10;

  const blocked =
    badNumber(daily) ||
    badNumber(weekly) ||
    (!clearing && reasonTooShort);

  return (
    <Dialog open={!!candidate} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hours limit for this candidate</DialogTitle>
          <DialogDescription>
            {candidate && (
              <>
                The platform&apos;s own limits apply to{" "}
                <span className="font-medium text-foreground">
                  {candidate.name ?? "this candidate"}
                </span>{" "}
                unless something here says otherwise — set one only when the cap
                is a fact about them rather than policy. A student pass allows 16
                hours a week during term, and no platform-wide number can say
                that without capping everybody at 16.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {candidate && (
          <div className="flex flex-col gap-4 px-6 pb-4">
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Nothing they already hold is affected: a limit refuses the{" "}
              <span className="font-medium text-foreground">next</span> shift they
              try to take. They are not notified when one is set — it takes
              nothing away, and they meet it only at the point they would exceed
              it, where the refusal carries the reason below.
            </div>

            <CapField
              label="In one day"
              id="cap-daily"
              mode={form.dailyMode}
              hours={form.dailyHours}
              onMode={(dailyMode) => setForm((f) => ({ ...f, dailyMode }))}
              onHours={(dailyHours) => setForm((f) => ({ ...f, dailyHours }))}
            />

            <CapField
              label="In one week (Mon–Sun)"
              id="cap-weekly"
              mode={form.weeklyMode}
              hours={form.weeklyHours}
              onMode={(weeklyMode) => setForm((f) => ({ ...f, weeklyMode }))}
              onHours={(weeklyHours) => setForm((f) => ({ ...f, weeklyHours }))}
            />

            {!clearing && (
              <div className="flex flex-col gap-2">
                <label htmlFor="cap-reason" className="text-sm font-medium">
                  Why — the candidate is shown this
                </label>
                <Input
                  id="cap-reason"
                  value={form.reason}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  placeholder="Student pass — 16 hours a week during term"
                />
                <p
                  className={
                    reasonTooShort && form.reason.length > 0
                      ? "text-xs font-medium text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  At least 10 characters. It is the sentence they read when a
                  shift is refused, and a limit with nothing written against it is
                  one they cannot answer.
                </p>
              </div>
            )}

            {candidate.hoursCapSetAt && (
              <p className="text-xs text-muted-foreground">
                Current limit set {relative(candidate.hoursCapSetAt)}
                {candidate.hoursCapSetById ? " by staff" : ""}.
              </p>
            )}
          </div>
        )}

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
            size="sm"
            disabled={isPending || blocked}
            onClick={() =>
              onSave({
                // Narrowed by `blocked` above: neither can be undefined here.
                maxDailyMinutes: (daily ?? null) as number | null,
                maxWeeklyMinutes: (weekly ?? null) as number | null,
                reason: clearing ? null : form.reason.trim(),
              })
            }
          >
            {isPending
              ? "Saving…"
              : clearing
                ? "Use the platform's limits"
                : "Save this limit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CapField({
  label,
  id,
  mode,
  hours,
  onMode,
  onHours,
}: {
  label: string;
  id: string;
  mode: CapMode;
  hours: string;
  onMode: (mode: CapMode) => void;
  onHours: (hours: string) => void;
}) {
  const minutes = toMinutes(Number(hours));
  const bad =
    mode === "custom" &&
    hours.trim() !== "" &&
    (!Number.isFinite(minutes) || minutes < MIN_CAP_MINUTES);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={id}
          value={mode}
          onChange={(e) => onMode(e.target.value as CapMode)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          {MODES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {mode === "custom" && (
          <>
            <Input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={hours}
              aria-invalid={bad}
              onChange={(e) => onHours(e.target.value)}
              className="h-9 w-24 tabular-nums"
            />
            <span className="text-xs text-muted-foreground">hours</span>
          </>
        )}
      </div>
      {bad && (
        <p className="text-xs font-medium text-destructive">
          An hour at least. Choose &ldquo;No limit&rdquo; to exempt them instead.
        </p>
      )}
    </div>
  );
}

function SuspensionDialog({
  candidate,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  candidate: CandidateSummary | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (suspended: boolean, reason?: string) => void;
  isPending: boolean;
}) {
  const suspended = !!candidate?.suspendedAt;
  const [reason, setReason] = useState("");
  const [prevId, setPrevId] = useState<string | null>(null);

  // Clear the box each time a different row opens the dialog — adjusted during
  // render rather than in an effect to avoid a cascading render. A reason left
  // over from the last person is the worst possible thing to send here.
  if ((candidate?.userId ?? null) !== prevId) {
    setPrevId(candidate?.userId ?? null);
    setReason("");
  }

  // Matches the API's floor. "bad" is not a reason somebody can answer, and this
  // text is shown to the person it is about.
  const tooShort = reason.trim().length < 10;

  return (
    <Dialog open={!!candidate} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {suspended ? "Lift this suspension" : "Suspend this candidate"}
          </DialogTitle>
          <DialogDescription>
            {candidate && suspended && (
              <>
                <span className="font-medium text-foreground">
                  {candidate.name ?? "This candidate"}
                </span>{" "}
                will be able to book shifts again, and any timed block still
                standing against them is cleared at the same time — otherwise
                they would be told they are reinstated and still find the app
                refusing.
              </>
            )}
            {candidate && !suspended && (
              <>
                <span className="font-medium text-foreground">
                  {candidate.name ?? "This candidate"}
                </span>{" "}
                will not be able to book new shifts. They can still sign in,
                read their history, appeal, and be paid for shifts already
                worked — a suspension must never strand wages somebody has
                earned.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {candidate && !suspended && (
          <div className="flex flex-col gap-2 px-6 pb-4">
            <label htmlFor="reason" className="text-sm font-medium">
              Why — the candidate is shown this
            </label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Did not turn up for two confirmed shifts…"
              autoFocus
            />
            <p
              className={
                tooShort && reason.length > 0
                  ? "text-xs font-medium text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              At least 10 characters. It goes to them as a notification, and a
              block with no reason on it is one nobody can answer.
            </p>
          </div>
        )}

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
            variant={suspended ? "default" : "destructive"}
            size="sm"
            disabled={isPending || (!suspended && tooShort)}
            onClick={() =>
              onConfirm(!suspended, suspended ? undefined : reason.trim())
            }
          >
            {isPending
              ? "Saving…"
              : suspended
                ? "Lift suspension"
                : "Suspend"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

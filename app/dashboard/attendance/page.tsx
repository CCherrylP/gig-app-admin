"use client";

import { useMemo, useState } from "react";
import { ReviewTabs } from "@/components/dashboard/review-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Image01Icon,
  Location01Icon,
  QrCode01Icon,
  Alert02Icon,
  MoneyBag02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EmptyState,
  FilterTabs,
  InitialsAvatar,
  PageHeader,
  SearchInput,
  StatusPill,
  TableShell,
  TableSkeleton,
  initials,
} from "@/components/dashboard/data-views";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GEOFENCE_M,
  clockOf,
  formatHours,
  lateness,
  listAttendance,
  attendancePhoto,
  releaseWages,
  reviewAttendance,
  shiftHasEnded,
  wagesFor,
  type AttendanceFilter,
  type AttendanceRecord,
} from "@/lib/attendance";
import { toHours } from "@/lib/settings";
import { openFreshDocument } from "@/lib/documents";
import { date, money, relative } from "@/lib/format";

// All first and default — see the note on the employers page. The work piles
// keep their counts, so they still announce themselves.
//
// `upcoming` sits next to `missing` deliberately: it is where the rows that
// used to pollute that queue now live. A shift booked for next Thursday was
// being listed as "missing clock in/out" — nothing was missing, it had not
// happened — and the pair reads as one idea split the right way round: shifts
// that have run and lost their clock, and shifts that have not run yet.
const FILTERS: { value: AttendanceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs a look" },
  { value: "missing", label: "Missing clock in/out" },
  { value: "unapproved", label: "Waiting on employer" },
  { value: "upcoming", label: "Not started yet" },
  { value: "reviewed", label: "Reviewed" },
];

/** What an empty list means, which differs by tab. "Every check-in was a
 *  scanned code" is good news on the review queues and simply wrong on the two
 *  that are about shifts rather than evidence. */
const EMPTY: Record<AttendanceFilter, string> = {
  all: "Nothing here yet.",
  attention: "Nothing here. Every check-in was a scanned code inside the fence.",
  missing:
    "No shift has lost its clock. Every shift that has run was clocked at both ends, or has been settled.",
  unapproved: "No finished shift is waiting on an employer to approve it.",
  upcoming: "Nothing booked that has not already run.",
  reviewed: "No selfie check-in has been decided yet.",
};

const REVIEW_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const [search, setSearch] = useState("");
  const [releasing, setReleasing] = useState<AttendanceRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", filter],
    queryFn: () => listAttendance(filter),
  });

  const mutation = useMutation({
    mutationFn: ({
      applicationId,
      review,
    }: {
      applicationId: string;
      review: "approved" | "rejected";
    }) => reviewAttendance(applicationId, review),
    onSuccess: (_r, { review }) => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success(
        review === "approved" ? "Check-in accepted" : "Check-in rejected",
      );
    },
    onError: (error: Error) => {
      // NOTHING_TO_REVIEW lands here when somebody presses this on a scanned
      // code, and the API's sentence explains why better than a generic one.
      toast.error(error.message || "Could not record that decision");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const release = useMutation({
    mutationFn: ({
      applicationId,
      reason,
      minutes,
    }: {
      applicationId: string;
      reason: string;
      /** Undefined is the full scheduled length — the API reads an omitted
       *  `minutes` that way, so a prorate is only ever a number somebody typed. */
      minutes?: number;
    }) => releaseWages(applicationId, reason, minutes),
    onSuccess: () => {
      // Both this list and anything counting money elsewhere: the settlement
      // refunds the unearned hold, so a company's coin balance has moved.
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setReleasing(null);
      toast.success("Hours signed off. The candidate and employer have been told.");
    },
    onError: (error: Error) => {
      // ALREADY_APPROVED is the one that matters: two admins on the same row,
      // and the API refuses the second rather than paying twice.
      toast.error(error.message || "Could not release those hours");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  // Photos are signed at click time, one at a time.
  //
  // This used to re-fetch the WHOLE queue to get one fresh link, back when the
  // queue carried a signed URL per photograph — so opening a single selfie made
  // the API mint two hundred of them. The row now says only whether a
  // photograph exists and this asks for the one being looked at.
  function openPhoto(applicationId: string, which: "in" | "out") {
    void openFreshDocument({
      queryClient,
      queryKey: ["attendance", "photo", applicationId, which],
      queryFn: () => attendancePhoto(applicationId, which),
      select: (fresh) => fresh.url,
      onMissing: () => toast.error("That photo could not be opened."),
    });
  }

  const records = useMemo(() => {
    const all = data?.records ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((r) =>
      [r.candidateName ?? "", r.roleName, r.gigTitle, r.companyName]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <ReviewTabs />
      <PageHeader
        title="Clock-ins"
        description="Check selfie clock-ins, fix missing clock-outs, and approve shifts an employer has left waiting. Scanned codes are already confirmed."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search candidate, role or company…"
          className="w-full sm:w-72"
        />
      </PageHeader>

      <FilterTabs
        options={FILTERS.map((f) => ({
          ...f,
          count:
            f.value === "attention"
              ? data?.attentionCount
              : f.value === "missing"
                ? data?.missingCount
                : f.value === "unapproved"
                  ? data?.unapprovedCount
                  : f.value === "upcoming"
                    ? data?.upcomingCount
                    : undefined,
        }))}
        value={filter}
        onChange={setFilter}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : records.length === 0 ? (
            <EmptyState
              icon={Clock01Icon}
              message={search ? "Nothing matches that search." : EMPTY[filter]}
            />
          ) : (
            <TableShell
              // SIX COLUMNS, down from seven. Clocked in and Clocked out were
              // two narrow columns describing one span of time, so they are one
              // column now — "14:12 – 22:03" reads as a shift, two cells apart
              // it read as two unrelated numbers.
              headers={[
                "Candidate",
                "Shift",
                "Clock",
                "Proof",
                "Review",
                "Actions",
              ]}
              widths={[
                "w-[17%]",
                "w-[21%]",
                "w-[18%]",
                "w-[16%]",
                "w-[11%]",
                "w-[17%]",
              ]}
            >
              {records.map((record) => (
                <AttendanceRow
                  key={record.applicationId}
                  record={record}
                  onOpenPhoto={(which) => openPhoto(record.applicationId, which)}
                  onReview={(review) =>
                    mutation.mutate({
                      applicationId: record.applicationId,
                      review,
                    })
                  }
                  onRelease={() => setReleasing(record)}
                />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      <ReleaseDialog
        record={releasing}
        onOpenChange={(open) => {
          if (!open) setReleasing(null);
        }}
        onConfirm={(reason, minutes) =>
          releasing &&
          release.mutate({
            applicationId: releasing.applicationId,
            reason,
            minutes,
          })
        }
        isPending={release.isPending}
      />
    </div>
  );
}

function ReleaseDialog({
  record,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  record: AttendanceRecord | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, minutes?: number) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  // Empty means FULL. A number is only ever sent when somebody deliberately cut
  // the hours — the same shape the API reads, where an omitted `minutes` is the
  // full scheduled length rather than a default anybody typed.
  const [hours, setHours] = useState("");
  const [prevId, setPrevId] = useState<string | null>(null);

  // Clear the boxes when a different row opens the dialog — adjusted during
  // render rather than in an effect. A note or an hours figure left over from
  // the last shift is the worst possible thing to write against a payment.
  if ((record?.applicationId ?? null) !== prevId) {
    setPrevId(record?.applicationId ?? null);
    setReason("");
    setHours("");
  }

  const tooShort = reason.trim().length < 10;
  const scheduled = record?.scheduledMinutes ?? 0;

  // PRORATED, when somebody types hours. Rounded to whole minutes because that
  // is the unit the API settles in, and a half-minute is not a thing anybody
  // means — see toMinutes in lib/settings, which this mirrors.
  const prorated = hours.trim() === "" ? null : Math.round(Number(hours) * 60);
  const proratedValid =
    prorated === null ||
    (Number.isFinite(prorated) && prorated > 0 && prorated <= scheduled);

  const minutes = prorated ?? scheduled;
  const amount = record ? wagesFor(minutes, record.payPerHourCents) : 0;
  // Both ends clocked means the employer just has not signed it off.
  const force = !!record?.checkInAt && !!record?.clockOutAt;
  // What the clock actually recorded, where it recorded anything. Offered as a
  // one-tap prorate because it is the figure a dispute is usually settled at —
  // and typing it by hand from two timestamps is where a slip costs somebody an
  // hour's pay.
  const clocked =
    record?.workedMinutes && record.workedMinutes > 0 ? record.workedMinutes : null;

  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{force ? "Force approve this shift" : "Release the full shift"}</DialogTitle>
          <DialogDescription>
            {record && force ? (
              <>
                The employer has not approved this shift. This pays{" "}
                <span className="font-medium text-foreground">
                  {record.candidateName ?? "this candidate"}
                </span>{" "}
                the full scheduled{" "}
                <span className="font-medium text-foreground">
                  {formatHours(minutes)}
                </span>{" "}
                of their {record.roleName} shift,{" "}
                <span className="font-medium text-foreground">
                  {money(amount)}
                </span>
                . The employer is told, any unused hold is refunded to them, and
                this cannot be undone.
              </>
            ) : record && (
              <>
                Pays{" "}
                <span className="font-medium text-foreground">
                  {record.candidateName ?? "this candidate"}
                </span>{" "}
                for the whole scheduled{" "}
                <span className="font-medium text-foreground">
                  {formatHours(minutes)}
                </span>{" "}
                of their {record.roleName} shift —{" "}
                <span className="font-medium text-foreground">
                  {money(amount)}
                </span>
                . Pay is the scheduled hours anyway, so a clock that missed an
                end changes what we can prove rather than what is owed. The
                employer&apos;s unearned hold is refunded in the same
                transaction, and this cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* FULL OR PRORATED, and full is the default rather than a choice
            somebody has to make. The scheduled hours are what the employer set
            aside and what the hold already covers, so paying them in full is the
            ordinary answer; cutting them is the exception and takes a deliberate
            number. Below what was clocked, the API asks for a reason — and this
            route always requires one anyway. */}
        {record && (
          <div className="flex flex-col gap-2 px-6 pb-2">
            <span className="text-sm font-medium">How much to pay</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant={prorated === null ? "default" : "outline"}
                size="sm"
                onClick={() => setHours("")}
              >
                Full {formatHours(scheduled)}
              </Button>
              {clocked !== null && clocked !== scheduled && (
                <Button
                  type="button"
                  variant={prorated === clocked ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHours(String(toHours(clocked)))}
                >
                  Clocked {formatHours(clocked)}
                </Button>
              )}
              <Input
                inputMode="decimal"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="Other"
                aria-label="Hours to pay"
                aria-invalid={!proratedValid}
                className="h-8 w-24 tabular-nums"
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
            <p
              className={
                proratedValid
                  ? "text-xs text-muted-foreground"
                  : "text-xs font-medium text-destructive"
              }
            >
              {proratedValid ? (
                prorated === null ? (
                  <>
                    The full scheduled hours. The employer set that time aside
                    and the hold already covers it.
                  </>
                ) : (
                  <>
                    Prorated to {formatHours(prorated)} of{" "}
                    {formatHours(scheduled)}. The rest of the hold goes back to
                    the employer, and the platform fee follows the hours — we do
                    not keep a fee for hours nobody worked.
                  </>
                )
              ) : (
                <>
                  Between 0 and the scheduled {formatHours(scheduled)}. Paying
                  more than was posted would come out of a hold that only ever
                  covered the scheduled hours.
                </>
              )}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 px-6 pb-4">
          <label htmlFor="release-reason" className="text-sm font-medium">
            Why is this being settled by hand?
          </label>
          <Input
            id="release-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              force
                ? "Candidate wrote in, employer did not reply after 2 reminders"
                : "Phone died before clock-out; supervisor confirmed by phone"
            }
            autoFocus
          />
          <p
            className={
              tooShort && reason.length > 0
                ? "text-xs font-medium text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            At least 10 characters. Somebody is being paid for hours no clock
            recorded, and a payment with nothing written against it is one
            nobody can account for later.
          </p>
        </div>

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
            disabled={isPending || tooShort || !proratedValid}
            onClick={() => onConfirm(reason.trim(), prorated ?? undefined)}
          >
            {isPending
              ? "Releasing…"
              : force
                ? `Approve ${money(amount)}`
                : `Release ${money(amount)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceRow({
  record,
  onOpenPhoto,
  onReview,
  onRelease,
}: {
  record: AttendanceRecord;
  onOpenPhoto: (which: "in" | "out") => void;
  onReview: (review: "approved" | "rejected") => void;
  onRelease: () => void;
}) {
  const name = record.candidateName ?? "Unnamed candidate";

  // HAS IT EVEN RUN? The row can be a booking for next week — the `all` tab
  // lists those, and so does `upcoming` — and nothing about the clock means
  // anything until the shift is over.
  const ended = shiftHasEnded(record);

  // Either end of the clock missing, and nobody paid yet. The employer's own
  // sign-off cannot touch these — it requires a clock-out — so the wages are
  // stuck until staff release them.
  //
  // `ended` is the condition this was missing. Without it every confirmed
  // future booking drew a "Release 8h" button, offering to pay the full
  // scheduled day for work nobody had done; the API now refuses that with 409
  // SHIFT_NOT_OVER, and the button should never have been there to press.
  const missingClock =
    ended && !record.approvedAt && (!record.checkInAt || !record.clockOutAt);
  // Fully clocked, but the employer has not signed it off.
  const waitingOnEmployer =
    ended && !record.approvedAt && !missingClock && record.status === "completed";
  const late = lateness(record.minutesLate);
  // Beyond the geofence is the one automatic signal on a route with no
  // supervisor in it, so it is called out rather than left as a number.
  const tooFar =
    record.checkInDistance !== null && record.checkInDistance > GEOFENCE_M;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={record.candidateId}
            label={initials(name)}
            className="size-8"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {record.status}
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          <span className="truncate text-sm font-medium">{record.roleName}</span>
          <span className="truncate text-muted-foreground">
            {record.companyName}
          </span>
          <span className="truncate text-muted-foreground">
            {date(record.shiftOnDate)} · {record.scheduledStart}–
            {record.scheduledEnd}
          </span>
        </div>
      </td>

      {/* The actual time against the scheduled one. "14:12" means nothing until
          you know the shift started at 14:00, which is the whole reason both
          are on the row. */}
      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          {/* In and out on one line, each end's detail stacked under it. */}
          <span className="truncate text-sm font-medium tabular-nums">
            {clockOf(record.checkInAt)} – {clockOf(record.clockOutAt)}
          </span>
          {late && (
            <span
              className={
                record.minutesLate && record.minutesLate > 0
                  ? "truncate font-medium text-amber-600 dark:text-amber-400"
                  : "truncate text-muted-foreground"
              }
            >
              {late}
            </span>
          )}
          <span className="truncate text-muted-foreground">
            {record.checkInAt
              ? `Clocked in ${relative(record.checkInAt)}`
              : "Not clocked in"}
          </span>
          {record.workedMinutes !== null && (
            <span className="truncate text-muted-foreground">
              {Math.floor(record.workedMinutes / 60)}h{" "}
              {record.workedMinutes % 60}m worked
            </span>
          )}
          {record.approvedAt && (
            <span className="truncate text-muted-foreground">
              Signed off {relative(record.approvedAt)}
            </span>
          )}
        </div>
      </td>

      {/* What actually stands behind the claim. */}
      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="inline-flex items-center gap-1.5 text-xs">
            <HugeiconsIcon
              icon={record.checkInMethod === "code" ? QrCode01Icon : Image01Icon}
              size={13}
              strokeWidth={2}
              className="shrink-0 text-muted-foreground"
            />
            {record.checkInMethod === "code"
              ? "Supervisor code"
              : record.checkInMethod === "selfie"
                ? "Selfie"
                : "No method"}
          </span>

          {record.checkInDistance !== null && (
            <span
              className={
                tooFar
                  ? "inline-flex items-center gap-1.5 text-xs font-medium text-destructive"
                  : "inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              }
            >
              <HugeiconsIcon
                icon={tooFar ? Alert02Icon : Location01Icon}
                size={13}
                strokeWidth={2}
                className="shrink-0"
              />
              {record.checkInDistance}m
              {tooFar && ` — outside ${GEOFENCE_M}m`}
            </span>
          )}

          <div className="flex flex-wrap gap-1">
            {record.hasCheckInPhoto && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => onOpenPhoto("in")}
              >
                <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                Arrival
              </Button>
            )}
            {record.hasClockOutPhoto && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => onOpenPhoto("out")}
              >
                <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                Leaving
              </Button>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        {record.checkInReview ? (
          <StatusPill status={record.checkInReview} styles={REVIEW_STYLES} />
        ) : (
          // Null is not "unreviewed" — it is "nothing to review". A supervisor
          // scanned, and there is no photograph for staff to judge.
          <span className="text-xs text-muted-foreground">Vouched</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {record.checkInReview === "pending" && (
            <>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => onReview("rejected")}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                Reject
              </Button>
              <Button size="xs" onClick={() => onReview("approved")}>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                Accept
              </Button>
            </>
          )}
          {missingClock && (
            <Button size="xs" onClick={onRelease}>
              <HugeiconsIcon icon={MoneyBag02Icon} strokeWidth={2} />
              Release {formatHours(record.scheduledMinutes)}
            </Button>
          )}
          {waitingOnEmployer && (
            <Button size="xs" onClick={onRelease}>
              <HugeiconsIcon icon={MoneyBag02Icon} strokeWidth={2} />
              Force approve
            </Button>
          )}
          {record.approvedAt && record.earnedCents !== null && (
            <span className="text-xs font-medium tabular-nums text-green-700 dark:text-green-400">
              {money(record.earnedCents)} paid
            </span>
          )}
          {/* Said rather than left blank. An empty Actions cell reads as a row
              somebody forgot to build a button for; this one is a shift that
              has not run, and there is nothing to do about it yet. */}
          {!ended && !record.approvedAt && (
            <span className="text-xs text-muted-foreground">
              {record.checkInAt ? "On shift now" : "Not started yet"}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

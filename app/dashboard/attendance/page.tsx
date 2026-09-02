"use client";

import { useMemo, useState } from "react";
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
  releaseWages,
  reviewAttendance,
  wagesFor,
  type AttendanceFilter,
  type AttendanceRecord,
} from "@/lib/attendance";
import { openFreshDocument } from "@/lib/documents";
import { date, money, relative } from "@/lib/format";

const FILTERS: { value: AttendanceFilter; label: string }[] = [
  { value: "attention", label: "Needs a look" },
  { value: "missing", label: "Missing clock in/out" },
  { value: "reviewed", label: "Reviewed" },
  { value: "all", label: "All" },
];

const REVIEW_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AttendanceFilter>("attention");
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
    }: {
      applicationId: string;
      reason: string;
    }) => releaseWages(applicationId, reason),
    onSuccess: () => {
      // Both this list and anything counting money elsewhere: the settlement
      // refunds the unearned hold, so a company's coin balance has moved.
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setReleasing(null);
      toast.success("Hours signed off — the candidate has been told");
    },
    onError: (error: Error) => {
      // ALREADY_APPROVED is the one that matters: two admins on the same row,
      // and the API refuses the second rather than paying twice.
      toast.error(error.message || "Could not release those hours");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  // Photos are re-signed at click time. The link on the row was minted when the
  // page loaded and lives ten minutes — see lib/documents.
  function openPhoto(applicationId: string, which: "in" | "out") {
    void openFreshDocument({
      queryClient,
      queryKey: ["attendance", filter],
      queryFn: () => listAttendance(filter),
      select: (fresh) => {
        const row = fresh.records.find((r) => r.applicationId === applicationId);
        return which === "in" ? row?.checkInPhotoUrl : row?.clockOutPhotoUrl;
      },
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
      <PageHeader
        title="Clock in / clock out"
        description="A scanned code is a supervisor vouching on the spot. A selfie is a photo and a location fix with nobody behind it — those are the ones worth reading."
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
              message={
                search
                  ? "Nothing matches that search."
                  : "Nothing here — every check-in was a scanned code inside the fence."
              }
            />
          ) : (
            <TableShell
              headers={[
                "Candidate",
                "Shift",
                "Clocked in",
                "Clocked out",
                "Proof",
                "Review",
                "Actions",
              ]}
              widths={[
                "w-[16%]",
                "w-[20%]",
                "w-[13%]",
                "w-[12%]",
                "w-[15%]",
                "w-[9%]",
                "w-[15%]",
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
        onConfirm={(reason) =>
          releasing &&
          release.mutate({ applicationId: releasing.applicationId, reason })
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
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [prevId, setPrevId] = useState<string | null>(null);

  // Clear the box when a different row opens the dialog — adjusted during
  // render rather than in an effect. A note left over from the last shift is
  // the worst possible thing to write against a payment.
  if ((record?.applicationId ?? null) !== prevId) {
    setPrevId(record?.applicationId ?? null);
    setReason("");
  }

  const tooShort = reason.trim().length < 10;
  const minutes = record?.scheduledMinutes ?? 0;
  const amount = record ? wagesFor(minutes, record.payPerHourCents) : 0;

  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Release the full shift</DialogTitle>
          <DialogDescription>
            {record && (
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

        <div className="flex flex-col gap-2 px-6 pb-4">
          <label htmlFor="release-reason" className="text-sm font-medium">
            Why is this being settled by hand?
          </label>
          <Input
            id="release-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Phone died before clock-out; supervisor confirmed by phone"
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
            disabled={isPending || tooShort}
            onClick={() => onConfirm(reason.trim())}
          >
            {isPending ? "Releasing…" : `Release ${money(amount)}`}
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
  // Either end of the clock missing, and nobody paid yet. The employer's own
  // sign-off cannot touch these — it requires a clock-out — so the wages are
  // stuck until staff release them.
  const missingClock =
    !record.approvedAt && (!record.checkInAt || !record.clockOutAt);
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
          <span className="text-sm font-medium tabular-nums">
            {clockOf(record.checkInAt)}
          </span>
          {late && (
            <span
              className={
                record.minutesLate && record.minutesLate > 0
                  ? "font-medium text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              }
            >
              {late}
            </span>
          )}
          <span className="truncate text-muted-foreground">
            {relative(record.checkInAt)}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          <span className="text-sm font-medium tabular-nums">
            {clockOf(record.clockOutAt)}
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
            {record.checkInPhotoUrl && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => onOpenPhoto("in")}
              >
                <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                Arrival
              </Button>
            )}
            {record.clockOutPhotoUrl && (
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
          {record.approvedAt && record.earnedCents !== null && (
            <span className="text-xs font-medium text-green-700 dark:text-green-400">
              {money(record.earnedCents)} paid
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

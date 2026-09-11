"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  File01Icon,
  Legal01Icon,
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
  InitialsAvatar,
  PageHeader,
  SearchInput,
  StatusPill,
  TableShell,
  TableSkeleton,
  initials,
} from "@/components/dashboard/data-views";
import {
  APPEAL_GROUNDS,
  decideAppeal,
  groundLabel,
  listAppeals,
  type AppealFilter,
  type AppealReview,
} from "@/lib/appeals";
import {
  blockState,
  decideAccountAppeal,
  listAccountAppeals,
  type AccountAppealReview,
} from "@/lib/account-appeals";
import { openFreshDocument } from "@/lib/documents";
import { date, relative } from "@/lib/format";

// All first and default — see the note on the employers page.
const FILTERS: { value: AppealFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "waived", label: "Waived" },
  { value: "upheld", label: "Upheld" },
];

// WHICH KIND OF BAN, and both live on this page rather than on two.
//
// The API has two queues because they are two decisions — one asks "was this
// shift their fault", the other "should this person work here again" — but from
// a reviewer's side they are the same job: somebody is blocked and is asking not
// to be. Splitting them across two nav entries meant the second was never built
// at all, and an account ban applied by hand had a route in and nowhere to land.
//
// Kept as a switch above the outcome filter rather than as four more filter
// tabs, because the two queues carry different COLUMNS: an incident appeal is
// read against the date of one shift, an account appeal against a strike count
// and a history. One table cannot honestly show both.
type Queue = "incident" | "account";

const QUEUES: { value: Queue; label: string }[] = [
  { value: "incident", label: "Shift penalties" },
  { value: "account", label: "Account bans" },
];

// `waived` is the good outcome for the candidate and `upheld` is the penalty
// standing — which reads backwards if you are used to "upheld = they won", so
// the pills are coloured by what happened to the person rather than by the word.
const OUTCOME_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  WAIVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  UPHELD: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type Decision = { appeal: AppealReview; outcome: "waived" | "upheld" };

export default function AppealsPage() {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<Queue>("incident");
  const [filter, setFilter] = useState<AppealFilter>("all");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [accountDecision, setAccountDecision] = useState<{
    appeal: AccountAppealReview;
    outcome: "waived" | "upheld";
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["appeals", filter],
    queryFn: () => listAppeals(filter),
  });

  // Both queues load, whichever tab is showing. They are small, they share the
  // outcome filter, and the badge on the OTHER tab is the point — a reviewer
  // clearing shift penalties has to be able to see that three people are
  // waiting on their account without clicking to find out.
  const account = useQuery({
    queryKey: ["account-appeals", filter],
    queryFn: () => listAccountAppeals(filter),
  });

  const mutation = useMutation({
    mutationFn: ({ appeal, outcome }: Decision) =>
      decideAppeal(appeal.withdrawalId, outcome),
    onSuccess: (_result, { outcome }) => {
      queryClient.invalidateQueries({ queryKey: ["appeals"] });
      setDecision(null);
      toast.success(
        outcome === "waived" ? "Penalty waived" : "Appeal declined",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not record that decision");
      setDecision(null);
      queryClient.invalidateQueries({ queryKey: ["appeals"] });
    },
  });

  // Evidence is opened by RE-FETCHING the queue and taking the URL off the
  // fresh response, never off the row on screen. The signed link lives ten
  // minutes, so the one drawn with the page is dead by the time a reviewer has
  // read three appeals — and what Supabase returns for a lapsed token is a raw
  // `InvalidJWT` page that reads as the dashboard being broken.
  //
  // Found by withdrawalId rather than by row position, because the queue is
  // sorted server-side and a decision made in another tab can have moved it.
  function openEvidence(withdrawalId: string, index: number) {
    void openFreshDocument({
      queryClient,
      queryKey: ["appeals", filter],
      queryFn: () => listAppeals(filter),
      select: (fresh) =>
        fresh.appeals.find((a) => a.withdrawalId === withdrawalId)?.documents[
          index
        ]?.url,
      onMissing: () =>
        toast.error("That document could not be opened. Try again."),
    });
  }

  // Same rule as the incident queue: the signed link on screen lives ten
  // minutes and is dead by the time a reviewer has read three of these, so the
  // URL is taken off a FRESH fetch at click time rather than off the row.
  function openAccountEvidence(id: string, index: number) {
    void openFreshDocument({
      queryClient,
      queryKey: ["account-appeals", filter],
      queryFn: () => listAccountAppeals(filter),
      select: (fresh) =>
        fresh.appeals.find((a) => a.id === id)?.documents[index]?.url,
      onMissing: () =>
        toast.error("That document could not be opened. Try again."),
    });
  }

  const accountMutation = useMutation({
    mutationFn: ({
      appeal,
      outcome,
    }: {
      appeal: AccountAppealReview;
      outcome: "waived" | "upheld";
    }) => decideAccountAppeal(appeal.id, outcome),
    onSuccess: (_result, { outcome }) => {
      queryClient.invalidateQueries({ queryKey: ["account-appeals"] });
      // The candidate row carries the block, so a lifted ban changes that queue
      // too — and a stale Candidates page still showing "Suspended" after this
      // is how somebody gets told two different things by one dashboard.
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setAccountDecision(null);
      toast.success(outcome === "waived" ? "Account unblocked" : "Ban stands");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not record that decision");
      setAccountDecision(null);
      queryClient.invalidateQueries({ queryKey: ["account-appeals"] });
    },
  });

  const appeals = useMemo(() => {
    const all = data?.appeals ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((appeal) =>
      [
        appeal.candidateName ?? "",
        groundLabel(appeal.ground),
        appeal.gigTitle ?? "",
        appeal.companyName ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data, search]);

  const accountAppeals = useMemo(() => {
    const all = account.data?.appeals ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((appeal) =>
      [
        appeal.candidateName ?? "",
        groundLabel(appeal.ground),
        appeal.suspensionReason ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [account.data, search]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Appeals"
        description={
          queue === "incident"
            ? "Somebody dropped one confirmed shift and says it should not count. Read the document against the date of that shift."
            : "Somebody is blocked from booking at all and is asking to be let back. There is no single date to check — weigh the pattern and what they say has changed."
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={
            queue === "incident"
              ? "Search candidate, ground or shift…"
              : "Search candidate, ground or reason…"
          }
          className="w-full sm:w-72"
        />
      </PageHeader>

      {/* WHICH BAN, above the outcome filter. Both counts are live whichever
          tab is open, so a reviewer clearing one queue can see the other
          filling up rather than having to go and look. */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          options={QUEUES.map((q) => ({
            ...q,
            count:
              q.value === "incident"
                ? data?.pendingCount
                : account.data?.pendingCount,
          }))}
          value={queue}
          onChange={setQueue}
        />
        <FilterTabs
          options={FILTERS.map((f) => ({
            ...f,
            count:
              f.value === "pending"
                ? queue === "incident"
                  ? data?.pendingCount
                  : account.data?.pendingCount
                : undefined,
          }))}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {queue === "account" ? (
        <Card>
          <CardContent className="p-0">
            {account.isLoading ? (
              <TableSkeleton />
            ) : accountAppeals.length === 0 ? (
              <EmptyState
                icon={Legal01Icon}
                message={
                  search
                    ? "Nothing matches that search."
                    : "Nobody is asking to be unblocked."
                }
              />
            ) : (
              <TableShell
                headers={[
                  "Candidate",
                  "Block",
                  "Record",
                  "Ground",
                  "Evidence",
                  "Filed",
                  "Outcome",
                  "Decision",
                ]}
                widths={[
                  "w-[15%]",
                  "w-[14%]",
                  "w-[17%]",
                  "w-[14%]",
                  "w-[10%]",
                  "w-[7%]",
                  "w-[9%]",
                  "w-[14%]",
                ]}
              >
                {accountAppeals.map((appeal) => (
                  <AccountAppealRow
                    key={appeal.id}
                    appeal={appeal}
                    onDecide={(outcome) =>
                      setAccountDecision({ appeal, outcome })
                    }
                    onOpen={(index) => openAccountEvidence(appeal.id, index)}
                  />
                ))}
              </TableShell>
            )}
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : appeals.length === 0 ? (
            <EmptyState
              icon={Legal01Icon}
              message={
                search ? "Nothing matches that search." : "Nothing in this queue."
              }
            />
          ) : (
            <TableShell
              headers={[
                "Candidate",
                "Ground",
                "Shift dropped",
                "Evidence",
                "Filed",
                "Outcome",
                "Decision",
              ]}
              // Outcome (what it IS) and Decision (what you can DO) are kept
              // apart and the buttons get real room. Sat side by side at the
              // old widths, a Pending pill and a Decline button read as three
              // states of one thing rather than a state and two actions.
              widths={[
                "w-[16%]",
                "w-[20%]",
                "w-[16%]",
                "w-[12%]",
                "w-[8%]",
                "w-[10%]",
                "w-[18%]",
              ]}
            >
              {appeals.map((appeal) => (
                <AppealRow
                  key={appeal.withdrawalId}
                  appeal={appeal}
                  onDecide={(outcome) => setDecision({ appeal, outcome })}
                  onOpen={(index) => openEvidence(appeal.withdrawalId, index)}
                />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>
      )}

      <DecisionDialog
        decision={decision}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        onConfirm={() => decision && mutation.mutate(decision)}
        isPending={mutation.isPending}
      />

      <AccountDecisionDialog
        decision={accountDecision}
        onOpenChange={(open) => {
          if (!open) setAccountDecision(null);
        }}
        onConfirm={() =>
          accountDecision && accountMutation.mutate(accountDecision)
        }
        isPending={accountMutation.isPending}
      />
    </div>
  );
}

function AppealRow({
  appeal,
  onDecide,
  onOpen,
}: {
  appeal: AppealReview;
  onDecide: (outcome: "waived" | "upheld") => void;
  /** Opens evidence by INDEX, re-signed at click time — see lib/documents. */
  onOpen: (index: number) => void;
}) {
  const name = appeal.candidateName ?? "Unnamed candidate";
  // A repeat late-canceller is not a reason to refuse on its own, but it is the
  // context the decision is made in — and it is the number a reviewer would
  // otherwise have to go and look up.
  const repeat = appeal.lateCancels > 1;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={appeal.candidateId}
            label={initials(name)}
            className="size-8"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {appeal.candidateVerified ? "Verified" : "Not verified"}
            </span>
            <span
              className={
                repeat
                  ? "truncate text-xs font-medium text-amber-600 dark:text-amber-400"
                  : "truncate text-xs text-muted-foreground"
              }
            >
              {appeal.lateCancels} late cancel
              {appeal.lateCancels === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">
            {groundLabel(appeal.ground)}
          </span>
          {/* What the evidence is SUPPOSED to show. Without it "illness" is a
              word, and the check — does this MC cover that date — is the whole
              decision. Clamped to two lines: it has to be readable without
              being what sets the height of every row in the queue. */}
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {APPEAL_GROUNDS[appeal.ground]?.evidence ?? "Supporting document."}
          </span>
          {appeal.note && (
            <span className="line-clamp-2 text-xs italic text-foreground/80">
              “{appeal.note}”
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{appeal.roleName ?? "—"}</span>
          <span className="truncate text-xs text-muted-foreground">
            {appeal.companyName ?? appeal.gigTitle ?? "Listing deleted"}
          </span>
          {/* The date the document has to cover. */}
          <span className="mt-0.5 truncate text-xs font-medium">
            {appeal.shiftOnDate ? date(appeal.shiftOnDate) : "Date unknown"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Dropped {relative(appeal.withdrawnAt)}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        {appeal.documents.length === 0 ? (
          <span className="flex items-start gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <HugeiconsIcon
              icon={Alert02Icon}
              size={13}
              strokeWidth={2}
              className="mt-0.5 shrink-0"
            />
            Nothing attached
          </span>
        ) : (
          <div className="flex flex-col items-start gap-1">
            {appeal.documents.map((document, i) => (
              <Button
                key={i}
                variant="outline"
                size="xs"
                disabled={!document.url}
                // NOT an <a href>. The URL on this row was signed when the queue
                // loaded and lives ten minutes; clicking it later hands the
                // browser a dead token and Supabase answers with a raw
                // InvalidJWT page. onOpen re-fetches and opens the fresh one.
                onClick={() => onOpen(i)}
              >
                <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
                <span className="truncate">{document.kind}</span>
              </Button>
            ))}
          </div>
        )}
      </td>

      <td className="px-4 py-3 text-xs text-muted-foreground">
        {relative(appeal.submittedAt)}
      </td>

      <td className="px-4 py-3">
        <StatusPill status={appeal.outcome} styles={OUTCOME_STYLES} />
      </td>

      <td className="px-4 py-3">
        {appeal.outcome === "pending" && (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="destructive"
              size="xs"
              onClick={() => onDecide("upheld")}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              Decline
            </Button>
            <Button size="xs" onClick={() => onDecide("waived")}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
              Waive
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function AccountAppealRow({
  appeal,
  onDecide,
  onOpen,
}: {
  appeal: AccountAppealReview;
  onDecide: (outcome: "waived" | "upheld") => void;
  onOpen: (index: number) => void;
}) {
  const name = appeal.candidateName ?? "Unnamed candidate";
  const block = blockState(appeal);
  // Every incident already argued and won. It is the number that changes the
  // decision most: three strikes with two waived is a different person from
  // three that nobody ever explained.
  const waived = appeal.incidents.filter(
    (incident) => incident.appealOutcome === "waived" || incident.liftedAt,
  ).length;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={appeal.candidateId}
            label={initials(name)}
            className="size-8"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {appeal.candidateVerified ? "Verified" : "Not verified"}
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{block.label}</span>
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {block.detail}
          </span>
          {appeal.suspendedAt && (
            <span className="truncate text-xs text-muted-foreground">
              Since {date(appeal.suspendedAt)}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {/* THE PATTERN, which is what this decision is actually about. */}
          <span
            className={
              appeal.strikes > 2
                ? "truncate text-xs font-medium text-amber-600 dark:text-amber-400"
                : "truncate text-xs font-medium"
            }
          >
            {appeal.strikes} strike{appeal.strikes === 1 ? "" : "s"} standing
            {waived > 0 && ` · ${waived} waived`}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {appeal.shiftsDone} shift{appeal.shiftsDone === 1 ? "" : "s"} worked
          </span>
          {appeal.incidents.slice(0, 2).map((incident) => (
            <span
              key={incident.applicationId}
              className="truncate text-xs text-muted-foreground"
            >
              {incident.kind === "no_show" ? "No-show" : "Late drop"}
              {incident.shiftOnDate ? ` · ${date(incident.shiftOnDate)}` : ""}
              {incident.roleName ? ` · ${incident.roleName}` : ""}
            </span>
          ))}
          {appeal.incidents.length > 2 && (
            <span className="truncate text-xs text-muted-foreground">
              +{appeal.incidents.length - 2} more
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">
            {groundLabel(appeal.ground)}
          </span>
          {appeal.note && (
            <span className="line-clamp-3 text-xs italic text-foreground/80">
              “{appeal.note}”
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        {appeal.documents.length === 0 ? (
          // NOT a warning here, unlike the incident queue. A document is
          // required there and optional on this one — "I understand and it will
          // not happen again" is a real thing to say with nothing to attach.
          <span className="text-xs text-muted-foreground">None attached</span>
        ) : (
          <div className="flex flex-col items-start gap-1">
            {appeal.documents.map((document, i) => (
              <Button
                key={i}
                variant="outline"
                size="xs"
                disabled={!document.url}
                onClick={() => onOpen(i)}
              >
                <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
                <span className="truncate">{document.kind}</span>
              </Button>
            ))}
          </div>
        )}
      </td>

      <td className="px-4 py-3 text-xs text-muted-foreground">
        {relative(appeal.submittedAt)}
      </td>

      <td className="px-4 py-3">
        <StatusPill status={appeal.outcome} styles={OUTCOME_STYLES} />
      </td>

      <td className="px-4 py-3">
        {appeal.outcome === "pending" && (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="destructive"
              size="xs"
              onClick={() => onDecide("upheld")}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              Keep ban
            </Button>
            <Button size="xs" onClick={() => onDecide("waived")}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
              Unblock
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function AccountDecisionDialog({
  decision,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  decision: { appeal: AccountAppealReview; outcome: "waived" | "upheld" } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const granting = decision?.outcome === "waived";

  return (
    <Dialog open={!!decision} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {granting ? "Let them book again" : "Keep this account blocked"}
          </DialogTitle>
          <DialogDescription>
            {decision && (
              <>
                <span className="font-medium text-foreground">
                  {decision.appeal.candidateName ?? "This candidate"}
                </span>{" "}
                has {decision.appeal.strikes} strike
                {decision.appeal.strikes === 1 ? "" : "s"} standing and has
                worked {decision.appeal.shiftsDone} shift
                {decision.appeal.shiftsDone === 1 ? "" : "s"}.{" "}
                {granting ? (
                  <>
                    Unblocking clears the suspension AND any timed block still
                    running, so they can book immediately.{" "}
                    <span className="font-medium text-foreground">
                      The strikes are not cleared
                    </span>{" "}
                    — this is a decision about access, not a finding that the
                    incidents never happened, so the next one still escalates
                    from where they are.
                  </>
                ) : (
                  <>
                    The block stands and they stay unable to take work. They can
                    file again — unlike a shift appeal, this one has no deadline
                    and no one-per-customer rule.
                  </>
                )}
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
            variant={granting ? "default" : "destructive"}
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Saving…" : granting ? "Unblock account" : "Keep ban"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  const waiving = decision?.outcome === "waived";

  return (
    <Dialog open={!!decision} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {waiving ? "Waive this penalty" : "Decline this appeal"}
          </DialogTitle>
          <DialogDescription>
            {decision && (
              <>
                {groundLabel(decision.appeal.ground)} appeal from{" "}
                <span className="font-medium text-foreground">
                  {decision.appeal.candidateName ?? "this candidate"}
                </span>
                , against a shift on{" "}
                {decision.appeal.shiftOnDate
                  ? date(decision.appeal.shiftOnDate)
                  : "an unknown date"}
                .{" "}
                {waiving
                  ? "The late cancellation stops counting against them."
                  : "The rating drop stands."}{" "}
                There is one appeal per withdrawal, so this cannot be re-filed
                and it cannot be set back to pending.
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
            variant={waiving ? "default" : "destructive"}
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Saving…" : waiving ? "Waive penalty" : "Decline"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

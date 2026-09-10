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
import { openFreshDocument } from "@/lib/documents";
import { date, relative } from "@/lib/format";

// All first and default — see the note on the employers page.
const FILTERS: { value: AppealFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "waived", label: "Waived" },
  { value: "upheld", label: "Upheld" },
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
  const [filter, setFilter] = useState<AppealFilter>("all");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["appeals", filter],
    queryFn: () => listAppeals(filter),
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Penalty appeals"
        description="A late cancellation costs rating. These are the people saying it should not — read the document against the date of the shift."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search candidate, ground or shift…"
          className="w-full sm:w-72"
        />
      </PageHeader>

      <FilterTabs
        options={FILTERS.map((f) => ({
          ...f,
          count: f.value === "pending" ? data?.pendingCount : undefined,
        }))}
        value={filter}
        onChange={setFilter}
      />

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

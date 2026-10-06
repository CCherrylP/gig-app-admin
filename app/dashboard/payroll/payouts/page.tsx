"use client";

import { useMemo, useState } from "react";
import { ReviewTabs } from "@/components/dashboard/review-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Alert02Icon,
  Image01Icon,
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
  listPayouts,
  payoutProof,
  reviewPayout,
  type PayoutAccount,
} from "@/lib/payouts";
import { VERIFICATION_LABEL, type PayoutVerification } from "@/lib/reports";
import { relative } from "@/lib/format";
import { RevealNumber } from "@/components/dashboard/reveal-number";

// DOES THIS PAYNOW NUMBER BELONG TO THE PERSON WE ARE ABOUT TO PAY.
//
// The number and the name on a payout record are both typed by the candidate
// into one form, so they agree with each other whatever the truth is. A PayNow
// transfer clears immediately and cannot be reversed, so a mistyped digit pays
// a stranger permanently and there is no way to get it back.
//
// So they upload a screenshot of their own PayNow profile — the registered name
// against the registered number — and this is where somebody compares the two.
//
// THE COMPARISON THIS SCREEN EXISTS FOR is the three columns side by side: the
// number they gave for payment, the mobile on their account, and the name on
// each. A screenshot on its own proves nothing; it is only evidence next to
// what we are about to type into a bank app.
//
// NOTHING HERE BLOCKS A PAYMENT. Payroll shows the state beside each number so
// the person transferring can see it, but an unchecked account is still
// payable. A gate would mean somebody who worked a shift goes unpaid because
// this queue is behind, which puts the cost of our check on them.

const FILTERS: { value: PayoutVerification | "all"; label: string }[] = [
  { value: "pending", label: "To check" },
  { value: "verified", label: "Checked" },
  { value: "rejected", label: "Did not match" },
  { value: "unverified", label: "No proof" },
  { value: "all", label: "All" },
];

/** StatusPill colours by the status STRING, so the four states are given the
 *  classes rather than a tone name. Keyed uppercase, which is what it does to
 *  whatever it is handed. */
const PILL_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-900",
  REJECTED: "bg-red-100 text-red-800",
  UNVERIFIED: "bg-muted text-muted-foreground",
};

type Decision = { account: PayoutAccount; verification: "verified" | "rejected" };

export default function PayoutChecksPage() {
  const queryClient = useQueryClient();

  // OPENS ON THE WORK, unlike the certificate queue which opens on All. This
  // one is short — most people never change their number — so an empty "to
  // check" tab is a good sign rather than a wasted screen.
  const [filter, setFilter] = useState<PayoutVerification | "all">("pending");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [opening, setOpening] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["payouts", filter],
    queryFn: () => listPayouts(filter),
  });

  const mutation = useMutation({
    mutationFn: ({ account, verification }: Decision) =>
      reviewPayout(account.candidateId, verification, note.trim() || undefined),
    onSuccess: (_result, { verification }) => {
      // Every tab, and payroll too — the state is drawn beside the number on
      // the pay run, and a decision here has to move it there.
      queryClient.invalidateQueries({ queryKey: ["payouts"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });

      setDecision(null);
      setNote("");

      toast.success(
        verification === "verified" ? "Marked as checked" : "Turned down, they have been told",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not record that decision");
    },
  });

  /** The screenshot, signed at the moment of the click.
   *
   *  The tab is claimed before the await or the browser blocks it as a popup —
   *  a window.open that runs after a promise has lost the click that allowed
   *  it. Same reason openFreshDocument does it this way. */
  async function openProof(candidateId: string) {
    if (opening) return;

    const tab = window.open("", "_blank");

    if (tab) tab.opener = null;

    setOpening(candidateId);

    try {
      const { url } = await payoutProof(candidateId);

      // `location.assign`, not an assignment to `window.location.href`. They do
      // the same thing, but the react-hooks immutability rule reads the second
      // as writing to a variable declared outside the component and fails the
      // lint — see the same fallback in lib/documents.
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch {
      tab?.close();
      toast.error("That screenshot could not be opened.");
    } finally {
      setOpening(null);
    }
  }

  const accounts = useMemo(() => {
    const all = data?.payouts ?? [];
    const term = search.trim().toLowerCase();

    if (!term) return all;

    return all.filter((account) =>
      [account.candidateName ?? "", account.candidateEmail ?? "", account.number]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <ReviewTabs />
      <PageHeader
        title="PayNow checks"
        description="Check each PayNow number belongs to the worker. A wrong transfer cannot be undone."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email or number…"
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
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={CheckmarkBadge01Icon}
              message={
                search ? "Nothing matches that search." : "Nothing in this queue."
              }
            />
          ) : (
            <TableShell
              // FIVE COLUMNS, down from six. Proof was a column holding one
              // button, and a button is an action — it sits with the other two
              // now, first, because looking at the screenshot is the step
              // before either decision. Where there is no screenshot, that is
              // said under the state instead of in a column of its own.
              headers={[
                "Candidate",
                "Paying to",
                "On their account",
                "State",
                "Actions",
              ]}
              widths={["w-[24%]", "w-[18%]", "w-[16%]", "w-[16%]", "w-[26%]"]}
            >
              {accounts.map((account) => (
                <tr key={account.candidateId} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar
                        seed={account.candidateId}
                        label={initials(account.candidateName ?? "?")}
                        className="size-8"
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {account.candidateName ?? "Unnamed"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {account.candidateEmail ?? "—"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* THE PAIR THIS SCREEN IS FOR. What they asked to be paid
                      into, and the mobile already on their account — if those
                      differ, the screenshot is the only thing that settles it.
                      Mono so a digit cannot be misread. */}
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 flex-col">
                      <div className="truncate">
                        <RevealNumber value={account.number} />
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {account.holderName ?? "no name given"}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="truncate font-mono text-xs text-muted-foreground select-all">
                      {account.candidatePhone ?? "—"}
                    </div>
                    {account.candidatePhone &&
                      !account.number.endsWith(account.candidatePhone.replace(/\D/g, "").slice(-8)) && (
                        // Not an error — paying into a family member's PayNow is
                        // legitimate and common. It is the case where the
                        // screenshot actually matters, so it is worth saying out
                        // loud rather than leaving somebody to spot it.
                        <div className="truncate text-[11px] text-amber-600">
                          different number
                        </div>
                      )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      {/* Wrapped, or the column stretches the pill full width. */}
                      <div>
                        <StatusPill
                          status={account.verification}
                          label={VERIFICATION_LABEL[account.verification]}
                          styles={PILL_STYLES}
                        />
                      </div>
                      {account.verification === "rejected" && account.reviewNote && (
                        <span className="text-[11px] text-muted-foreground">
                          {account.reviewNote}
                        </span>
                      )}
                      {/* What the Proof column used to say when it had no
                          button to show. Skipped under "No proof sent", which
                          already says it. */}
                      {!account.hasProof && account.verification !== "unverified" && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          No screenshot sent
                        </span>
                      )}
                      <span className="truncate text-[11px] text-muted-foreground">
                        {relative(account.updatedAt)}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {account.hasProof && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => openProof(account.candidateId)}
                          disabled={opening === account.candidateId}
                        >
                          <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                          {opening === account.candidateId ? "Opening…" : "View proof"}
                        </Button>
                      )}

                      <Button
                        variant="destructive"
                        size="xs"
                        disabled={account.verification === "rejected"}
                        onClick={() => {
                          setNote("");
                          setDecision({ account, verification: "rejected" });
                        }}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                        Does not
                      </Button>

                      {/* Nothing to check it against, so nothing to approve.
                          Marking an account checked with no screenshot would
                          produce exactly the tick this feature exists to
                          prevent — the API refuses it too. */}
                      <Button
                        size="xs"
                        disabled={!account.hasProof || account.verification === "verified"}
                        onClick={() => {
                          setNote("");
                          setDecision({ account, verification: "verified" });
                        }}
                      >
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                        Matches
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      <Dialog open={decision !== null} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.verification === "verified"
                ? "Mark this number as checked?"
                : "Turn this down?"}
            </DialogTitle>
            <DialogDescription>
              {decision?.verification === "verified" ? (
                <>
                  You are saying the screenshot shows{" "}
                  <span className="font-medium">{decision?.account.holderName ?? "this person"}</span>{" "}
                  registered to{" "}
                  <span className="font-mono">{decision?.account.number}</span>. Payroll will show
                  it as checked from now on.
                </>
              ) : (
                <>
                  <span className="font-medium">
                    {decision?.account.candidateName ?? "They"}
                  </span>{" "}
                  will see your reason and can send another screenshot. Their pay is not held up
                  either way.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {decision?.verification === "rejected" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="payout-note" className="text-xs font-medium">
                Why not? They read this.
              </label>
              <textarea
                id="payout-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="The name on the screenshot is not the name on the account."
                className="rounded-md border px-3 py-2 text-sm"
              />
              {/* Required, and the API refuses without it — a refusal with no
                  reason produces the same upload again, and a second refusal
                  after it. */}
              {!note.trim() && (
                <span className="text-[11px] text-amber-600">
                  Say what was wrong, or they cannot fix it.
                </span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                (decision?.verification === "rejected" && !note.trim())
              }
              onClick={() => decision && mutation.mutate(decision)}
            >
              {mutation.isPending
                ? "Saving…"
                : decision?.verification === "verified"
                  ? "Yes, it matches"
                  : "Turn it down"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
        <span>
          This does not hold anybody&rsquo;s pay. An unchecked number is still payable — Payroll
          shows the state beside it so whoever makes the transfer can see it. Holding wages behind
          this queue would put the cost of our check on the person who worked the shift.
        </span>
      </div>
    </div>
  );
}

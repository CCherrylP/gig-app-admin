"use client";

import { useMemo, useState } from "react";
import { ReviewTabs } from "@/components/dashboard/review-tabs";
import { PeopleTabs } from "@/components/dashboard/section-tabs";
import { ReferredByField, suggestedReferralCode } from "@/components/dashboard/referred-by-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BuildingIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  ArrowRight01Icon,
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
  decideEmployer,
  listEmployers,
  type EmployerFilter,
  type EmployerReview,
} from "@/lib/employers";
import { relative } from "@/lib/format";

// One screen, two ways in. Under To review it opens on Pending, the calls to
// make. Under People (/dashboard/people/employers) it opens on All, as a list.
const FILTERS: { value: EmployerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

type Decision = {
  employer: EmployerReview;
  status: "approved" | "rejected";
};

export default function EmployersPage() {
  const queryClient = useQueryClient();
  const directory = usePathname().startsWith("/dashboard/people");
  const [filter, setFilter] = useState<EmployerFilter>(directory ? "all" : "pending");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["employers", filter],
    queryFn: () => listEmployers(filter),
  });

  const mutation = useMutation({
    // ONE CALL AGAIN. This used to save a negotiated rate first and approve
    // second, so that a refused rate left the employer pending rather than live
    // on a price nobody had agreed. There is no rate to agree any more — one
    // published price, the same for everybody — so the decision is the whole
    // request.
    mutationFn: async ({
      employer,
      status,
      companyVerified,
      referralCode,
    }: Decision & { companyVerified?: boolean; referralCode?: string }) =>
      decideEmployer(employer.userId, status, companyVerified, referralCode),
    onSuccess: (_result, { status, employer }) => {
      queryClient.invalidateQueries({ queryKey: ["employers"] });
      setDecision(null);

      toast.success(
        status !== "approved"
          ? "Employer rejected"
          : `${employer.companyName} approved`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not record that decision");
      // Nothing was saved, so a mistyped referral code can be fixed in place.
      queryClient.invalidateQueries({ queryKey: ["employers"] });
    },
  });

  const employers = useMemo(() => {
    const all = data?.employers ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((employer) =>
      [
        employer.name ?? "",
        employer.email ?? "",
        employer.companyName,
        employer.companyUen,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {directory ? <PeopleTabs /> : <ReviewTabs />}
      <PageHeader
        title="Employers"
        description={
          directory
            ? "Every business on the platform."
            : "Call each new business to check it is real. They cannot post jobs until you approve them."
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search person, company or UEN…"
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
          ) : employers.length === 0 ? (
            <EmptyState
              icon={BuildingIcon}
              message={
                search
                  ? "Nothing matches that search."
                  : filter === "all"
                    ? "No employers have signed up yet."
                    : "Nothing in this queue."
              }
            />
          ) : (
            <TableShell
              // FIVE COLUMNS, down from eight.
              //
              // The three that went — Contact, Billed to, Signed up — were not
              // wrong, they were just never read HERE. This is a queue: the
              // questions it answers are "who is this, where do they work, what
              // state are they in, and do I approve them". An email address and
              // a billing address are answers to a different question, asked
              // when somebody is actually looking at one business, and the
              // detail page already shows both properly rather than truncated
              // into eighty pixels.
              //
              // Nothing was lost. The row opens that page on a click, and the
              // waiting time moved into the Person cell, where it belongs next
              // to the name it is about.
              headers={["Person", "Company", "Status", "Actions"]}
              widths={["w-[26%]", "w-[30%]", "w-[18%]", "w-[26%]"]}
            >
              {employers.map((employer) => (
                <EmployerRow
                  key={employer.userId}
                  employer={employer}
                  onDecide={(status) => setDecision({ employer, status })}
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
        onConfirm={(companyVerified, referralCode) =>
          decision && mutation.mutate({ ...decision, companyVerified, referralCode })
        }
        isPending={mutation.isPending}
      />
    </div>
  );
}

function EmployerRow({
  employer,
  onDecide,
}: {
  employer: EmployerReview;
  onDecide: (status: "approved" | "rejected") => void;
}) {
  const router = useRouter();
  const name = employer.name ?? "Unnamed";
  const href = `/dashboard/employers/${employer.userId}`;

  // THE WHOLE ROW OPENS THE PAGE, not just a link in one cell.
  //
  // It is the same gesture the payments queue uses, and making every table work
  // the same way is most of what "intuitive" means here: a row is a thing, and
  // clicking a thing opens it. The name stays a real <a> underneath so
  // middle-click, ctrl-click and "copy link" still behave — a div that merely
  // calls router.push() takes all of that away and looks identical.
  return (
    <tr
      className="cursor-pointer align-top"
      onClick={() => router.push(href)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={employer.userId}
            label={initials(name)}
            className="size-8"
          />
          <div className="flex min-w-0 flex-col">
            <Link
              href={href}
              className="truncate font-medium hover:text-primary hover:underline"
            >
              {name}
            </Link>
            <span className="truncate text-xs text-muted-foreground">
              {employer.jobTitle ?? "No job title"}
            </span>
            {/* How long they have been waiting, moved here from a column of its
                own. It is a fact about this person and reads better beside
                their name than four cells away under a heading. */}
            <span className="truncate text-xs text-muted-foreground">
              Signed up {relative(employer.createdAt)}
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{employer.companyName}</span>
          <span className="truncate text-xs tabular-nums text-muted-foreground">
            UEN {employer.companyUen}
          </span>
          {/* A first employee at a new business and the fourth at an
              established one are different calls. */}
          <span className="truncate text-xs text-muted-foreground">
            {employer.companySeats} seat
            {employer.companySeats === 1 ? "" : "s"} · {employer.phone ?? "no phone"}
          </span>
          {/* Referral stays. It is not background detail — it is something the
              person on the call has to confirm, so it belongs where the call is
              being prepared. */}
          {employer.referredBy && (
            <span className="truncate text-xs font-medium text-violet-600 dark:text-violet-400">
              Referred by {employer.referredBy.name ?? "someone"}
            </span>
          )}
          {!employer.referredBy && employer.signupReferral?.valid && (
            <span className="truncate text-xs font-medium text-amber-600 dark:text-amber-400">
              From {employer.signupReferral.name ?? "someone"}&apos;s link. Confirm
              on the call.
            </span>
          )}
        </div>
      </td>

      {/* ONE status column, not two.
          The person's approval and the business's check are separate fields and
          are set by the same phone call, so they agree on almost every row and
          two pills side by side just read as the same fact twice. What is NOT
          redundant is the case where they disagree — an approved person at an
          unverified business still cannot post, and that would be invisible if
          the second column simply went away. So it is shown only then. */}
      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          {/* ONE status, full stop.
              The person's approval and the business's check are set by the same
              phone call and say the same thing on every real row, so a second
              line was the same fact twice however narrowly it was gated. The
              rare case where they disagree is still visible where somebody is
              actually looking at that business — the detail page shows a second
              badge in its header and warns before billing — and the row opens
              it in one click. */}
          <StatusPill status={employer.status} />
          {employer.companyIsAgency && (
            <span className="truncate text-[11px] font-medium text-violet-600 dark:text-violet-400">
              Agency · EA {employer.companyEaLicenceNo ?? "missing"}
            </span>
          )}
        </div>
      </td>

      {/* stopPropagation, or every decision also navigates. The buttons sit
          inside a row that is itself a link now, and a click that both rejects
          somebody and leaves the queue is the worst of both. */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {/* Decided employers can be decided again, unlike a certificate:
              somebody approved in error has to be removable, and a manager who
              left and came back is an ordinary call. */}
          {employer.status !== "rejected" && (
            <Button
              variant="destructive"
              size="xs"
              onClick={() => onDecide("rejected")}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              Reject
            </Button>
          )}
          {employer.status !== "approved" && (
            <Button size="xs" onClick={() => onDecide("approved")}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
              Approve
            </Button>
          )}
          {/* A chevron rather than a "Details" button. The whole row opens it
              now, so a button competing with that would be two ways to do one
              thing — this is just the affordance saying the row is openable. */}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            className="size-4 shrink-0 text-muted-foreground"
          />
        </div>
      </td>
    </tr>
  );
}

// THE RATE QUESTION IS GONE FROM THIS DIALOG, along with the radio group and
// the cents box that went with it. Approving used to ask what the company paid
// per coin, because a business that went live with nobody having discussed money
// was indistinguishable from one where the list price was agreed on the call.
// There is one published price now — see the Config screen — so there is nothing
// to settle and nothing to get wrong.

function DecisionDialog({
  decision,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  decision: Decision | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (companyVerified?: boolean, referralCode?: string) => void;
  isPending: boolean;
}) {
  const approving = decision?.status === "approved";
  const employer = decision?.employer;
  const [referralCode, setReferralCode] = useState("");

  // A fresh box for each employer.
  const [openFor, setOpenFor] = useState<string | null>(null);
  if ((employer?.userId ?? null) !== openFor) {
    setOpenFor(employer?.userId ?? null);
    setReferralCode(employer ? suggestedReferralCode(employer) : "");
  }

  // The business's own check RIDES ALONG, and is no longer a tick.
  //
  // It was one, defaulted on, on every approval — and its off state produced
  // somebody approved and still unable to do anything, because both halves gate
  // posting. The two are settled by the same phone call; asking twice only
  // invited the answer that breaks it. See DecisionBand on the detail page,
  // which lost the same checkbox.
  //
  // Left alone when the business is already verified: confirming that Ali works
  // at a checked cafe should not re-open a decision about the cafe.
  const companyDecided = employer?.companyVerificationStatus === "verified";
  const verifyCompanyToo = companyDecided ? undefined : true;

  return (
    <Dialog open={!!decision} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {approving ? "Approve this employer" : "Reject this employer"}
          </DialogTitle>
          <DialogDescription>
            {employer && (
              <>
                <span className="font-medium text-foreground">
                  {employer.name ?? "This person"}
                </span>{" "}
                at {employer.companyName} (UEN {employer.companyUen}).{" "}
                {approving
                  ? "They will be able to post jobs and spend the company's coins."
                  : "They keep their seat but can do nothing in the company's name."}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {employer && (
          <div className="flex flex-col gap-3 px-6 pb-4">
            {/* TOLD, not asked — and only where it changes something. */}
            {approving && !companyDecided && (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Approving also marks{" "}
                <span className="font-medium text-foreground">
                  {employer.companyName}
                </span>{" "}
                verified — it is currently{" "}
                {employer.companyVerificationStatus}, and both halves have to
                pass before anyone at this UEN can post.
              </p>
            )}

            {approving && (
              <ReferredByField
                employer={employer}
                value={referralCode}
                onChange={setReferralCode}
              />
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
            variant={approving ? "default" : "destructive"}
            size="sm"
            onClick={() =>
              // Only on an approval: a rejection must not quietly verify the
              // business it is turning somebody down at.
              onConfirm(
                approving ? verifyCompanyToo : undefined,
                approving ? referralCode.trim() || undefined : undefined,
              )
            }
            disabled={isPending}
          >
            {isPending ? "Saving…" : approving ? "Approve" : "Reject"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

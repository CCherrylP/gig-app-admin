"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BuildingIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CallIcon,
  Mail01Icon,
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
import { money, relative } from "@/lib/format";

// ALL FIRST, and it is the default.
//
// Opening on Pending meant a screen that said "Nothing in this queue" whenever
// there was nothing to decide — on a page listing every employer on the
// platform. That reads as an empty database rather than as an empty queue, and
// it is the wrong first impression of a page whose main job is looking people
// up. The work still announces itself: Pending carries a count, so an empty
// queue is visible without being the only thing on offer.
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
  const [filter, setFilter] = useState<EmployerFilter>("all");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["employers", filter],
    queryFn: () => listEmployers(filter),
  });

  const mutation = useMutation({
    mutationFn: ({
      employer,
      status,
      companyVerified,
    }: Decision & { companyVerified?: boolean }) =>
      decideEmployer(employer.userId, status, companyVerified),
    onSuccess: (_result, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["employers"] });
      setDecision(null);
      toast.success(
        status === "approved" ? "Employer approved" : "Employer rejected",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not record that decision");
      setDecision(null);
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
      <PageHeader
        title="Employers"
        description="A UEN is public, so signing up against one proves nothing. Nobody can post a job until this call has been made."
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
              headers={[
                "Person",
                "Contact",
                "Company",
                "Billed to",
                "Per coin",
                "Signed up",
                "Status",
                "Actions",
              ]}
              // The actions get a fifth of the table. Three buttons at ~80px
              // plus their gaps is ~250px, and anything less makes them spill
              // over the status pill — which is exactly what it looked like.
              widths={[
                "w-[15%]",
                "w-[16%]",
                "w-[18%]",
                "w-[14%]",
                "w-[8%]",
                "w-[8%]",
                "w-[10%]",
                "w-[11%]",
              ]}
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
        onConfirm={(companyVerified) =>
          decision && mutation.mutate({ ...decision, companyVerified })
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
  const name = employer.name ?? "Unnamed";

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={employer.userId}
            label={initials(name)}
            className="size-8"
          />
          <div className="flex min-w-0 flex-col">
            {/* The name is the way in. A queue row is decidable from the table
                for the ordinary call; the page behind this is for the one where
                the address is wrong or somebody wants the company's invoices. */}
            <Link
              href={`/dashboard/employers/${employer.userId}`}
              className="truncate font-medium hover:text-primary hover:underline"
            >
              {name}
            </Link>
            <span className="truncate text-xs text-muted-foreground">
              {employer.jobTitle ?? "No job title"}
            </span>
            {/* No Singpass line. An employer is not asked to verify personally —
                what makes them trustworthy here is the call confirming they work
                for the business, which is the Status column. Printing "Not
                verified" against every employer implied a missing step that does
                not exist, and made a normal account look like a problem. */}
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
            <span className="truncate">{employer.email ?? "—"}</span>
          </span>
          {/* The number to ring. This queue IS a phone call. */}
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon
              icon={CallIcon}
              size={13}
              strokeWidth={2}
              className="shrink-0 text-muted-foreground"
            />
            <span className="truncate font-medium">{employer.phone ?? "—"}</span>
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{employer.companyName}</span>
          <span className="truncate text-xs tabular-nums text-muted-foreground">
            UEN {employer.companyUen}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {employer.companyIndustry ?? "No industry given"}
          </span>
          {/* A first employee at a new business and the fourth at an
              established one are different calls. */}
          <span className="truncate text-xs text-muted-foreground">
            {employer.companySeats} seat
            {employer.companySeats === 1 ? "" : "s"} at this UEN
          </span>
        </div>
      </td>

      {/* Where the BILL goes, which is not where the work is.
          Null does not mean "nowhere to send it" — it means the invoice is
          addressed to the outlet address, which is what every bill did before
          the column existed. Saying that in words stops somebody filling one in
          because they think the invoices were going nowhere. */}
      <td className="px-4 py-3">
        {employer.companyBillingAddress ? (
          <span
            className="line-clamp-2 text-xs"
            title={employer.companyBillingAddress}
          >
            {employer.companyBillingAddress}
          </span>
        ) : employer.companyAddress ? (
          <span
            className="line-clamp-2 text-xs text-muted-foreground"
            title={employer.companyAddress}
          >
            Outlet address
          </span>
        ) : (
          // Neither one. The bill would print no address at all, which is worth
          // flagging on a row somebody might be about to invoice.
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            No address
          </span>
        )}
      </td>

      {/* What this business pays for a coin. Null is the LIST PRICE and is said
          in words rather than shown as a number, because "100" and "on the list
          price" are different agreements: the second follows a platform price
          change, the first is frozen at a dollar. */}
      <td className="px-4 py-3">
        {employer.companyCoinPriceCents === null ? (
          <span className="text-xs text-muted-foreground">List price</span>
        ) : (
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium tabular-nums">
              {money(employer.companyCoinPriceCents)}
            </span>
            <span className="truncate text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Negotiated
            </span>
          </div>
        )}
      </td>

      <td className="px-4 py-3 text-xs text-muted-foreground">
        {relative(employer.createdAt)}
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
          <StatusPill status={employer.status} />
          {employer.companyVerificationStatus !== "verified" && (
            <span className="truncate text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Business {employer.companyVerificationStatus}
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
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
          <Button
            variant="ghost"
            size="xs"
            render={<Link href={`/dashboard/employers/${employer.userId}`} />}
          >
            Details
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
          </Button>
        </div>
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
  onConfirm: (companyVerified?: boolean) => void;
  isPending: boolean;
}) {
  const approving = decision?.status === "approved";
  const employer = decision?.employer;

  // The business's own check, offered in the same dialog because it is settled
  // by the same phone call. Defaulted to "leave alone" when the company has
  // already been verified — confirming that Ali works at a checked cafe should
  // not re-open a decision about the cafe.
  const companyDecided = employer?.companyVerificationStatus === "verified";
  const [alsoVerifyCompany, setAlsoVerifyCompany] = useState(false);
  const [prevKey, setPrevKey] = useState<string | null>(null);

  // Reset the tick each time a different row opens the dialog, adjusted during
  // render rather than in an effect to avoid a cascading render.
  const key = employer ? `${employer.userId}-${decision?.status}` : null;
  if (key !== prevKey) {
    setPrevKey(key);
    setAlsoVerifyCompany(!companyDecided && approving);
  }

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
          <div className="px-6 pb-4">
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <input
                type="checkbox"
                checked={alsoVerifyCompany}
                onChange={(e) => setAlsoVerifyCompany(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border accent-primary"
              />
              <span>
                <span className="font-medium">
                  Also mark {employer.companyName} verified
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {companyDecided
                    ? "This business is already verified — leave unticked to change nothing about it."
                    : "Both halves have to pass before anyone at this UEN can post. Currently " +
                      employer.companyVerificationStatus +
                      "."}
                </span>
              </span>
            </label>
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
              onConfirm(alsoVerifyCompany ? true : undefined)
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

"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BuildingIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CallIcon,
  Mail01Icon,
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

const FILTERS: { value: EmployerFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const COMPANY_STYLES: Record<string, string> = {
  VERIFIED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  UNVERIFIED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type Decision = {
  employer: EmployerReview;
  status: "approved" | "rejected";
};

export default function EmployersPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<EmployerFilter>("pending");
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
                search ? "Nothing matches that search." : "Nothing in this queue."
              }
            />
          ) : (
            <TableShell
              headers={[
                "Person",
                "Contact",
                "Company",
                "Business",
                "Signed up",
                "Status",
                "",
              ]}
              widths={[
                "w-[18%]",
                "w-[19%]",
                "w-[22%]",
                "w-[9%]",
                "w-[9%]",
                "w-[8%]",
                "w-[15%]",
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
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {employer.jobTitle ?? "No job title"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {employer.personVerified ? "Verified" : "Not verified"}
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

      <td className="px-4 py-3">
        <StatusPill
          status={employer.companyVerificationStatus}
          styles={COMPANY_STYLES}
        />
      </td>

      <td className="px-4 py-3 text-xs text-muted-foreground">
        {relative(employer.createdAt)}
      </td>

      <td className="px-4 py-3">
        <StatusPill status={employer.status} />
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
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

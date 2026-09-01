"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkBadge01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  File01Icon,
  Alert02Icon,
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
  listCertificates,
  reviewCertificate,
  type CertFilter,
  type CertificateReview,
} from "@/lib/certificates";
import { certById, certName } from "@/lib/certs-catalogue";
import { date, isExpired, relative } from "@/lib/format";

const FILTERS: { value: CertFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

type Decision = { review: CertificateReview; status: "verified" | "rejected" };

export default function CertificatesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CertFilter>("pending");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["certificates", filter],
    queryFn: () => listCertificates(filter),
  });

  const mutation = useMutation({
    mutationFn: ({ review, status }: Decision) =>
      reviewCertificate(review.candidateId, review.certId, status),
    onSuccess: (_result, { status }) => {
      // Every tab, not just this one — the API answers a decision with the
      // pending queue whatever was on screen, and the sidebar badge reads the
      // same query.
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      setDecision(null);
      toast.success(
        status === "verified" ? "Certificate verified" : "Certificate rejected",
      );
    },
    onError: (error: Error) => {
      // ALREADY_DECIDED lands here: somebody else worked this row while this
      // queue was open, and the message says so rather than pretending it
      // failed.
      toast.error(error.message || "Could not record that decision");
      setDecision(null);
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
  });

  const reviews = useMemo(() => {
    const all = data?.reviews ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((review) =>
      [review.candidateName ?? "", certName(review.certId), review.certId]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Certificate reviews"
        description="Oldest first — the person waiting longest is the one being kept from applying for work."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search candidate or certificate…"
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
          ) : reviews.length === 0 ? (
            <EmptyState
              icon={CheckmarkBadge01Icon}
              message={
                search
                  ? "Nothing matches that search."
                  : "Nothing in this queue."
              }
            />
          ) : (
            <TableShell
              headers={[
                "Candidate",
                "Certificate",
                "Expires",
                "Uploaded",
                "Status",
                "",
              ]}
              // The decision buttons get the widest share. Everything left of
              // them is context for a judgement that is made on the right.
              widths={[
                "w-[20%]",
                "w-[26%]",
                "w-[12%]",
                "w-[10%]",
                "w-[9%]",
                "w-[23%]",
              ]}
            >
              {reviews.map((review) => (
                <CertificateRow
                  key={`${review.candidateId}-${review.certId}`}
                  review={review}
                  onDecide={(status) => setDecision({ review, status })}
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

function CertificateRow({
  review,
  onDecide,
}: {
  review: CertificateReview;
  onDecide: (status: "verified" | "rejected") => void;
}) {
  const meta = certById(review.certId);
  const expired = isExpired(review.expiresAt);
  const name = review.candidateName ?? "Unnamed candidate";

  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={review.candidateId}
            label={initials(name)}
            className="size-8"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{name}</span>
            {/* Whether Singpass has confirmed the PERSON — a different question
                from this document, and the one this queue exists to catch. */}
            <span
              className={
                review.candidateVerified
                  ? "truncate text-xs text-muted-foreground"
                  : "truncate text-xs font-medium text-amber-600 dark:text-amber-400"
              }
            >
              {review.candidateVerified ? "Verified" : "Not verified"}
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{certName(review.certId)}</span>
          {/* The issuer, on one line. It runs to fifty characters for half the
              catalogue, and letting it set the column width would push the
              decision buttons off the screen. */}
          <span className="truncate text-xs text-muted-foreground">
            {meta?.issuer ?? review.certId}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        {review.expiresAt ? (
          <span
            className={
              expired
                ? "text-xs font-medium text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {date(review.expiresAt)}
            {expired && (
              <span className="mt-0.5 flex items-center gap-1">
                <HugeiconsIcon icon={Alert02Icon} size={12} strokeWidth={2} />
                expired
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Does not lapse</span>
        )}
      </td>

      <td className="px-4 py-3 text-xs text-muted-foreground">
        {relative(review.uploadedAt)}
      </td>

      <td className="px-4 py-3">
        <StatusPill status={review.status} />
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          {/* Signed and short-lived — minutes, not hours. Re-fetch the queue
              rather than keeping this link anywhere. */}
          <Button
            variant="outline"
            size="xs"
            disabled={!review.fileUrl}
            render={
              review.fileUrl ? (
                <a
                  href={review.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ) : undefined
            }
          >
            <HugeiconsIcon icon={File01Icon} strokeWidth={2} />
            {review.fileUrl ? "Document" : "No file"}
          </Button>

          {review.status === "pending" && (
            <>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => onDecide("rejected")}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                Reject
              </Button>
              <Button size="xs" onClick={() => onDecide("verified")}>
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                Verify
              </Button>
            </>
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
  onConfirm: () => void;
  isPending: boolean;
}) {
  const verifying = decision?.status === "verified";

  return (
    <Dialog open={!!decision} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {verifying ? "Verify this certificate" : "Reject this certificate"}
          </DialogTitle>
          <DialogDescription>
            {decision && (
              <>
                {certName(decision.review.certId)} for{" "}
                <span className="font-medium text-foreground">
                  {decision.review.candidateName ?? "this candidate"}
                </span>
                .{" "}
                {verifying
                  ? "Employers will treat it as checked, and it cannot be set back to pending — only the candidate re-uploading returns it to this queue."
                  : "The candidate can upload a replacement, which returns it to this queue."}
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
            Cancel
          </Button>
          <Button
            variant={verifying ? "default" : "destructive"}
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Saving…" : verifying ? "Verify" : "Reject"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

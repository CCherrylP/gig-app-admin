"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ReviewTabs } from "@/components/dashboard/review-tabs";
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
import { openFreshDocument } from "@/lib/documents";
import { date, isExpired, relative } from "@/lib/format";

// All first and default — see the note on the employers page. Pending keeps its
// count, so work still announces itself without an empty queue being the first
// thing anybody sees.
const FILTERS: { value: CertFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

type Decision = { review: CertificateReview; status: "verified" | "rejected" };

export default function CertificatesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CertFilter>("all");
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

  // Re-signed at click time rather than read off the row — the link drawn with
  // the page lives ten minutes, and a lapsed one shows the reviewer a raw
  // Supabase `InvalidJWT` page. Keyed by the pair that identifies the row, since
  // the queue re-sorts server-side.
  function openDocument(candidateId: string, certId: string) {
    void openFreshDocument({
      queryClient,
      queryKey: ["certificates", filter],
      queryFn: () => listCertificates(filter),
      select: (fresh) =>
        fresh.reviews.find(
          (r) => r.candidateId === candidateId && r.certId === certId,
        )?.fileUrl,
      onMissing: () =>
        toast.error("That document could not be opened. Try again."),
    });
  }

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
      <ReviewTabs />
      <PageHeader
        title="Certificates"
        description="Check uploaded certificates. Oldest first, since these workers cannot apply yet."
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
              // FOUR COLUMNS, down from six. Expiry moved under the certificate
              // it is about, and the upload time under the person who uploaded
              // it — two narrow date columns read better as a line beside the
              // thing they date.
              headers={["Candidate", "Certificate", "Status", "Actions"]}
              // The decision buttons still get a wide share. Everything left of
              // them is context for a judgement that is made on the right.
              widths={["w-[26%]", "w-[32%]", "w-[14%]", "w-[28%]"]}
            >
              {reviews.map((review) => (
                <CertificateRow
                  key={`${review.candidateId}-${review.certId}`}
                  review={review}
                  onDecide={(status) => setDecision({ review, status })}
                  onOpen={() => openDocument(review.candidateId, review.certId)}
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
  onOpen,
}: {
  review: CertificateReview;
  onDecide: (status: "verified" | "rejected") => void;
  /** Opens the document on a link re-signed at click time. */
  onOpen: () => void;
}) {
  const meta = certById(review.certId);
  const expired = isExpired(review.expiresAt);
  const name = review.candidateName ?? "Unnamed candidate";

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={review.candidateId}
            label={initials(name)}
            className="size-8"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{name}</span>
            {/* Whether staff have approved the PERSON's NRIC on ID checks — a
                different question from this document, and the one that catches
                a licence in somebody else's name. Links to the photos, so the
                face on the licence can be held against the face on the NRIC. */}
            <Link
              href={`/dashboard/identity?candidate=${review.candidateId}`}
              className={
                review.candidateVerified
                  ? "truncate text-xs text-muted-foreground hover:underline"
                  : "truncate text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
              }
            >
              {review.candidateVerified ? "ID approved" : "ID not approved"}
            </Link>
            {/* How long it has waited, moved here from a column of its own. */}
            <span className="truncate text-xs text-muted-foreground">
              Uploaded {relative(review.uploadedAt)}
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
          {/* Expiry, moved here from its own column — it is a fact about this
              document, and an expired one should be seen beside its name. */}
          {review.expiresAt ? (
            <span
              className={
                expired
                  ? "inline-flex min-w-0 items-center gap-1 text-xs font-medium text-destructive"
                  : "truncate text-xs text-muted-foreground"
              }
            >
              {expired && (
                <HugeiconsIcon
                  icon={Alert02Icon}
                  size={12}
                  strokeWidth={2}
                  className="shrink-0"
                />
              )}
              <span className="truncate">
                {expired ? "Expired" : "Expires"} {date(review.expiresAt)}
              </span>
            </span>
          ) : (
            <span className="truncate text-xs text-muted-foreground">
              Does not lapse
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <StatusPill status={review.status} />
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {/* Signed and short-lived — minutes, not hours. Re-fetch the queue
              rather than keeping this link anywhere. */}
          <Button
            variant="outline"
            size="xs"
            disabled={!review.fileUrl}
            // NOT an <a href>. The URL on this row was signed when the queue
            // loaded and lives ten minutes; clicking it later hands the browser
            // a dead token and Supabase answers with a raw InvalidJWT page.
            onClick={onOpen}
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
                  ? "Employers will treat it as checked, and it cannot be set back to pending, only the candidate re-uploading returns it to this queue."
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

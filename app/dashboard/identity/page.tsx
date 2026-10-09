"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Image01Icon,
  UserShield01Icon,
} from "@hugeicons/core-free-icons";

import { ReviewTabs } from "@/components/dashboard/review-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  decideIdentity,
  identityDocument,
  listIdentity,
  type IdentityFilter,
  type IdentityRecord,
  type IdentitySide,
} from "@/lib/identity";
import { openFreshDocument } from "@/lib/documents";
import { COUNTS_KEY } from "@/hooks/use-admin-counts";
import { date, relative } from "@/lib/format";

// Candidate ID documents. Approving one is what lets a candidate apply for shifts.

const FILTERS: { value: IdentityFilter; label: string }[] = [
  { value: "pending", label: "To check" },
  { value: "verified", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  VERIFIED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// `?candidate=<id>` opens on one person's record, whatever its status — it is
// how the "ID approved" tag on Candidates and Certificates links here. The
// narrowing is announced and removable, as on Payments.

export default function IdentityPage() {
  // Required, not stylistic — a static page reading `useSearchParams` from a
  // Client Component fails the production build without a boundary.
  return (
    <Suspense fallback={<div className="p-6"><TableSkeleton /></div>}>
      <IdentityRoute />
    </Suspense>
  );
}

function IdentityRoute() {
  const candidate = useSearchParams().get("candidate")?.trim() ?? "";
  // Keyed, so following a second link from inside the page starts fresh rather
  // than keeping the first one's tab.
  return <IdentityQueue key={candidate} candidate={candidate} />;
}

function IdentityQueue({ candidate }: { candidate: string }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<IdentityFilter>(candidate ? "all" : "pending");
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<IdentityRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["identity", filter],
    queryFn: () => listIdentity(filter),
  });

  const decide = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "verified" | "rejected"; note?: string }) =>
      decideIdentity(id, decision, note),
    onSuccess: (_r, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ["identity"] });
      queryClient.invalidateQueries({ queryKey: COUNTS_KEY });
      setRejecting(null);
      toast.success(decision === "verified" ? "ID approved. They can apply now." : "ID rejected. They have been told why.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not save that decision"),
  });

  const openDocument = (id: string, side: IdentitySide = "front") =>
    void openFreshDocument({
      queryClient,
      queryKey: ["identity", "document", id, side],
      queryFn: () => identityDocument(id, side),
      select: (fresh) => fresh.url,
      onMissing: () => toast.error("That document could not be opened."),
    });

  const term = search.trim().toLowerCase();
  const records = (data?.records ?? []).filter((record) =>
    candidate
      ? record.candidateId === candidate
      : !term || [record.name ?? "", record.phone ?? ""].join(" ").toLowerCase().includes(term),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <ReviewTabs />
      <PageHeader
        title="ID checks"
        description="Candidates send the front and back of their NRIC and a selfie. Check the face matches, and approve only pink (citizen) or blue (PR) cards. They can apply for shifts once approved."
      >
        {!candidate && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name or phone…"
            className="w-full sm:w-72"
          />
        )}
      </PageHeader>

      {candidate ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
          <span>Showing one candidate&apos;s ID.</span>
          <Link href="/dashboard/identity" className="text-xs font-medium text-primary hover:underline">
            Show everyone
          </Link>
        </div>
      ) : (
        <FilterTabs
          options={FILTERS.map((f) => ({ ...f, count: f.value === "pending" ? data?.pendingCount : undefined }))}
          value={filter}
          onChange={setFilter}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : records.length === 0 ? (
            <EmptyState
              icon={UserShield01Icon}
              message={
                candidate
                  ? "This candidate has not sent an ID yet."
                  : search
                    ? "Nothing matches that search."
                    : filter === "pending"
                      ? "No IDs waiting. Every one sent in has been checked."
                      : "Nothing here."
              }
            />
          ) : (
            <TableShell
              headers={["Candidate", "Document", "Submitted", "Status", "Actions"]}
              widths={["w-[26%]", "w-[18%]", "w-[16%]", "w-[14%]", "w-[26%]"]}
            >
              {records.map((record) => (
                <tr key={record.candidateId} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar
                        seed={record.candidateId}
                        label={initials(record.name ?? "")}
                        className="size-8"
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{record.name ?? "Unnamed"}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[record.phone, record.dateOfBirth ? `Born ${date(record.dateOfBirth)}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {record.hasFront === false ? (
                        <span className="text-xs text-muted-foreground">IC photos deleted after review</span>
                      ) : (
                        <Button variant="outline" size="xs" onClick={() => openDocument(record.candidateId)}>
                          <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                          {record.hasBack ? `${record.docLabel} front` : record.docLabel}
                        </Button>
                      )}
                      {record.hasBack && (
                        <Button variant="outline" size="xs" onClick={() => openDocument(record.candidateId, "back")}>
                          <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                          Back
                        </Button>
                      )}
                      {record.hasSelfie && (
                        <Button variant="outline" size="xs" onClick={() => openDocument(record.candidateId, "selfie")}>
                          <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                          Selfie
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {record.submittedAt ? relative(record.submittedAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={record.status} styles={STYLES} />
                    {record.status === "rejected" && record.reviewNote && (
                      <span className="mt-1 block text-xs text-muted-foreground">{record.reviewNote}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {record.status === "pending" && (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button variant="destructive" size="xs" onClick={() => setRejecting(record)}>
                          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                          Reject
                        </Button>
                        <Button
                          size="xs"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: record.candidateId, decision: "verified" })}
                        >
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
                          Approve
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      <RejectDialog
        record={rejecting}
        busy={decide.isPending}
        onClose={() => setRejecting(null)}
        onConfirm={(note) =>
          rejecting && decide.mutate({ id: rejecting.candidateId, decision: "rejected", note })
        }
      />
    </div>
  );
}

function RejectDialog({
  record,
  busy,
  onClose,
  onConfirm,
}: {
  record: IdentityRecord | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [prevId, setPrevId] = useState<string | null>(null);

  // A fresh box for each candidate.
  if ((record?.candidateId ?? null) !== prevId) {
    setPrevId(record?.candidateId ?? null);
    setNote("");
  }

  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject this ID</DialogTitle>
          <DialogDescription>
            {record?.name ?? "The candidate"} will see your reason and can upload it again.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 px-6 pb-4">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="The photo is blurry. Please retake it in good light."
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy || note.trim().length < 3}
            onClick={() => onConfirm(note.trim())}
          >
            {busy ? "Saving…" : "Reject"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

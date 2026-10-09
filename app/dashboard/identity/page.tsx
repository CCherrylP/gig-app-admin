"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Image01Icon,
  UserShield01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";

import { ReviewTabs } from "@/components/dashboard/review-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  identityCard,
  identityDocument,
  listIdentity,
  type IdentityFilter,
  type IdentityRecord,
  type IdentitySide,
} from "@/lib/identity";
import { openFreshDocument } from "@/lib/documents";
import { COUNTS_KEY } from "@/hooks/use-admin-counts";
import { date, relative } from "@/lib/format";
import { isLocal, workStatusLabel } from "@/lib/work-status";
import { cn } from "@/lib/utils";

// Candidate ID documents. Approving one is what lets a candidate apply for shifts.
//
// WHAT A REVIEWER NEEDS, ALL IN ONE PLACE. A decision here is three questions —
// is the card real and theirs (front, back), is it them (selfie against the card
// photo), and is it the card they said it was (pink citizen or blue PR, against
// the work status they declared). The row says how each stands; Review opens the
// three photos side by side beside what was read off the card, so nobody is
// juggling three browser tabs and the profile page to answer them.
//
// WHAT WAS READ is the candidate's own scan, kept by the API from the moment the
// app showed it to them. The page only asks the API to read the photo itself for
// a submission from an older app build that kept nothing.

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

const CARD_LABEL = { singaporean: "Pink · Citizen", pr: "Blue · PR" } as const;

/** The rejection to send when a photo the reviewer needs was never sent. */
const RESEND_NOTE =
  "Please update the app and send your ID again, with the back of your NRIC and a selfie.";

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

/** The kept read when there is one; otherwise ask the API to read the photo. */
function useCard(record: IdentityRecord, enabled = true) {
  const kept = record.card ?? null;
  const query = useQuery({
    queryKey: ["identity", "card", record.candidateId],
    queryFn: () => identityCard(record.candidateId),
    enabled: enabled && !kept && record.hasFront !== false,
    staleTime: 10 * 60_000,
    retry: false,
  });

  return {
    card: kept ?? query.data ?? null,
    isLoading: !kept && query.isLoading,
    failed: !kept && !!query.error,
  };
}

function IdentityQueue({ candidate }: { candidate: string }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<IdentityFilter>(candidate ? "all" : "pending");
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<{ record: IdentityRecord; note: string } | null>(null);
  const [reviewing, setReviewing] = useState<IdentityRecord | null>(null);

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
      setReviewing(null);
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

  const approve = (record: IdentityRecord) => decide.mutate({ id: record.candidateId, decision: "verified" });
  const reject = (record: IdentityRecord, note = "") => setRejecting({ record, note });

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
              // Candidate, then what the card says, then the photos — the order
              // a reviewer works in — then the decision.
              headers={["Candidate", "What the NRIC says", "Photos", "Status", "Actions"]}
              widths={["w-[22%]", "w-[26%]", "w-[20%]", "w-[12%]", "w-[20%]"]}
            >
              {records.map((record) => (
                <IdentityRow
                  key={record.candidateId}
                  record={record}
                  busy={decide.isPending}
                  onOpen={(side) => openDocument(record.candidateId, side)}
                  onReview={() => setReviewing(record)}
                  onReject={(note) => reject(record, note)}
                />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      <ReviewDialog
        record={reviewing}
        busy={decide.isPending}
        onClose={() => setReviewing(null)}
        onApprove={() => reviewing && approve(reviewing)}
        onReject={(note) => reviewing && reject(reviewing, note)}
      />

      <RejectDialog
        record={rejecting?.record ?? null}
        initialNote={rejecting?.note ?? ""}
        busy={decide.isPending}
        onClose={() => setRejecting(null)}
        onConfirm={(note) =>
          rejecting && decide.mutate({ id: rejecting.record.candidateId, decision: "rejected", note })
        }
      />
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function IdentityRow({
  record,
  busy,
  onOpen,
  onReview,
  onReject,
}: {
  record: IdentityRecord;
  busy: boolean;
  onOpen: (side: IdentitySide) => void;
  onReview: () => void;
  onReject: (note?: string) => void;
}) {
  const pending = record.status === "pending";
  const photosGone = record.hasFront === false;
  // Something the reviewer needs was never sent — usually an app from before
  // the back and the selfie were asked for. Said in red on the row, because an
  // NRIC with no selfie cannot be matched to a face at all.
  const missingPhotos = !photosGone && (!record.hasBack || !record.hasSelfie);

  return (
    <tr className={cn("align-top", pending && "cursor-pointer")} onClick={pending ? onReview : undefined}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar seed={record.candidateId} label={initials(record.name ?? "")} className="size-8" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{record.name ?? "Unnamed"}</span>
            <span className="truncate text-xs text-muted-foreground">
              {[record.phone, record.dateOfBirth ? `Born ${date(record.dateOfBirth)}` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {/* What they declared. Only a declaration — no pass is uploaded —
                so anything but citizen or PR is amber for a second look. */}
            {record.workStatus !== undefined && (
              <span
                className={cn(
                  "truncate text-xs",
                  record.workStatus && !isLocal(record.workStatus)
                    ? "font-medium text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
                )}
              >
                Says: {workStatusLabel(record.workStatus ?? null) ?? "work status not answered"}
              </span>
            )}
            <span className="truncate text-xs text-muted-foreground">
              Sent {record.submittedAt ? relative(record.submittedAt) : "—"}
            </span>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <CardSummary record={record} enabled={pending} />
      </td>

      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {photosGone ? (
          <span className="text-xs text-muted-foreground">Photos deleted after review</span>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="xs" onClick={() => onOpen("front")}>
                <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                Front
              </Button>
              {record.hasBack && (
                <Button variant="outline" size="xs" onClick={() => onOpen("back")}>
                  <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                  Back
                </Button>
              )}
              {record.hasSelfie && (
                <Button variant="outline" size="xs" onClick={() => onOpen("selfie")}>
                  <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                  Selfie
                </Button>
              )}
            </div>
            {missingPhotos && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                {!record.hasBack && !record.hasSelfie
                  ? "No back, no selfie"
                  : !record.hasBack
                    ? "No back of NRIC"
                    : "No selfie"}{" "}
                · older app
              </span>
            )}
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        <StatusPill status={record.status} styles={STYLES} />
        {record.status === "rejected" && record.reviewNote && (
          <span className="mt-1 block text-[11px] text-muted-foreground">{record.reviewNote}</span>
        )}
      </td>

      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {pending && (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {missingPhotos ? (
              // Approving without the selfie would be approving a card nobody
              // has matched to a face, so the one-click answer here is to ask
              // for the photos again — with the reason already written.
              <Button variant="destructive" size="xs" onClick={() => onReject(RESEND_NOTE)}>
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                Ask to resend
              </Button>
            ) : (
              <Button variant="destructive" size="xs" onClick={() => onReject()}>
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                Reject
              </Button>
            )}
            <Button size="xs" onClick={onReview} disabled={busy}>
              <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
              Review
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

/** What was read off the card, with anything that disagrees with the profile in red. */
function CardSummary({ record, enabled }: { record: IdentityRecord; enabled: boolean }) {
  const { card, isLoading, failed } = useCard(record, enabled);

  if (isLoading) return <span className="text-xs text-muted-foreground">Reading the NRIC…</span>;
  if (!card) {
    if (record.hasFront === false) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <span className="text-xs text-muted-foreground">
        {failed ? "Not read automatically. Check the photos by eye." : "Open Review to read it."}
      </span>
    );
  }

  const bad = "font-medium text-red-600 dark:text-red-400";

  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-xs">
      <span className="truncate font-medium tabular-nums">{card.masked ?? "Number not read"}</span>
      {card.name && (
        <span className={cn("truncate", card.nameMatches === false ? bad : "text-muted-foreground")}>
          {card.name}
          {card.nameMatches === false && " · name differs"}
        </span>
      )}
      {card.dob && (
        <span className={cn("truncate", card.dobMatches === false ? bad : "text-muted-foreground")}>
          Born {date(card.dob)}
          {card.dobMatches === false && " · birthday differs"}
        </span>
      )}
      {card.cardType && (
        <span className={cn("truncate", card.cardTypeMatches === false ? bad : "text-muted-foreground")}>
          {CARD_LABEL[card.cardType]}
          {card.cardTypeMatches === false && " · not what they declared"}
        </span>
      )}
      {record.back?.issued && (
        <span className="truncate text-muted-foreground">Issued {record.back.issued}</span>
      )}
      {!!card.missing?.length && (
        <span className="truncate text-amber-600 dark:text-amber-400">Not read: {card.missing.join(", ")}</span>
      )}
    </div>
  );
}

// ─── Review ───────────────────────────────────────────────────────────────────

/** One photo, fetched fresh when the dialog opens — the links live ten minutes. */
function Photo({
  candidateId,
  side,
  label,
  present,
}: {
  candidateId: string;
  side: IdentitySide;
  label: string;
  present: boolean;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["identity", "document", candidateId, side],
    queryFn: () => identityDocument(candidateId, side),
    enabled: present,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</figcaption>
      <div className="flex aspect-4/3 items-center justify-center overflow-hidden rounded-lg border bg-muted">
        {!present ? (
          <span className="flex flex-col items-center gap-1 px-3 text-center text-xs font-medium text-red-600 dark:text-red-400">
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5" />
            Not sent
          </span>
        ) : isLoading ? (
          <Skeleton className="size-full" />
        ) : error || !data ? (
          <span className="text-xs text-muted-foreground">Could not load</span>
        ) : (
          // Click for full size in a new tab — zooming into a card number or a
          // face is half of this job.
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="size-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed, ten-minute storage link: nothing for next/image to optimise or cache */}
            <img src={data.url} alt={label} className="size-full object-contain transition-transform hover:scale-[1.02]" />
          </a>
        )}
      </div>
    </figure>
  );
}

function Compare({
  label,
  profile,
  card,
  matches,
}: {
  label: string;
  profile: React.ReactNode;
  card: React.ReactNode;
  matches: boolean | null | undefined;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-3 text-xs text-muted-foreground">{label}</td>
      <td className="py-2 pr-3 text-sm">{profile ?? "—"}</td>
      <td className={cn("py-2 pr-3 text-sm", matches === false && "font-medium text-red-600 dark:text-red-400")}>
        {card ?? <span className="text-muted-foreground">Not read</span>}
      </td>
      <td className="py-2 text-right">
        {matches === true ? (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="ml-auto size-4 text-emerald-600" />
        ) : matches === false ? (
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="ml-auto size-4 text-red-600" />
        ) : null}
      </td>
    </tr>
  );
}

function ReviewDialog({
  record,
  busy,
  onClose,
  onApprove,
  onReject,
}: {
  record: IdentityRecord | null;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: (note?: string) => void;
}) {
  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        {record && <ReviewBody record={record} busy={busy} onApprove={onApprove} onReject={onReject} />}
      </DialogContent>
    </Dialog>
  );
}

function ReviewBody({
  record,
  busy,
  onApprove,
  onReject,
}: {
  record: IdentityRecord;
  busy: boolean;
  onApprove: () => void;
  onReject: (note?: string) => void;
}) {
  const { card, isLoading } = useCard(record);
  const missingPhotos = !record.hasBack || !record.hasSelfie;
  const declared = workStatusLabel(record.workStatus ?? null);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Check {record.name ?? "this candidate"}&apos;s ID</DialogTitle>
        <DialogDescription>
          Sent {record.submittedAt ? relative(record.submittedAt) : "—"}. Match the selfie to the card photo,
          then check the details below against their profile.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5 px-6 pb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Photo candidateId={record.candidateId} side="front" label="NRIC front" present={record.hasFront !== false} />
          <Photo candidateId={record.candidateId} side="back" label="NRIC back" present={record.hasBack} />
          <Photo candidateId={record.candidateId} side="selfie" label="Selfie" present={record.hasSelfie} />
        </div>

        {missingPhotos && (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
            {!record.hasSelfie
              ? "No selfie, so the card cannot be matched to a face. Ask them to update the app and send it again."
              : "No back of the NRIC. Ask them to update the app and send it again."}
          </p>
        )}

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Profile against the card
          </h3>
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 font-medium"></th>
                  <th className="py-1.5 font-medium">Profile</th>
                  <th className="py-1.5 font-medium">On the NRIC</th>
                  <th className="py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                <Compare label="NRIC no." profile={null} card={card?.masked} matches={null} />
                <Compare label="Name" profile={record.name} card={card?.name} matches={card?.nameMatches} />
                <Compare
                  label="Date of birth"
                  profile={record.dateOfBirth ? date(record.dateOfBirth) : null}
                  card={card?.dob ? date(card.dob) : null}
                  matches={card?.dobMatches}
                />
                <Compare
                  label="Citizen / PR"
                  profile={declared ?? "Not answered"}
                  card={card?.cardType ? CARD_LABEL[card.cardType] : null}
                  matches={card?.cardTypeMatches}
                />
                <Compare
                  label="Back of card"
                  profile={null}
                  card={
                    record.back
                      ? [record.back.issued && `Issued ${record.back.issued}`, record.back.hasAddress && "address read"]
                          .filter(Boolean)
                          .join(" · ") || null
                      : null
                  }
                  matches={null}
                />
              </tbody>
            </table>
          )}
          {!card && !isLoading && (
            <p className="mt-2 text-xs text-muted-foreground">
              The card could not be read automatically. Check the details on the photos by eye.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
        {missingPhotos && (
          <Button variant="outline" size="sm" onClick={() => onReject(RESEND_NOTE)} disabled={busy}>
            Ask to resend
          </Button>
        )}
        <Button variant="destructive" size="sm" onClick={() => onReject()} disabled={busy}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          Reject
        </Button>
        {/* No selfie, no approval: there is nothing to match the card's face to. */}
        <Button size="sm" onClick={onApprove} disabled={busy || !record.hasSelfie}>
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
          {busy ? "Saving…" : "Approve"}
        </Button>
      </div>
    </>
  );
}

// ─── Reject ───────────────────────────────────────────────────────────────────

function RejectDialog({
  record,
  initialNote,
  busy,
  onClose,
  onConfirm,
}: {
  record: IdentityRecord | null;
  initialNote: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [prevId, setPrevId] = useState<string | null>(null);

  // A fresh box for each candidate, pre-filled when the reason is already known.
  if ((record?.candidateId ?? null) !== prevId) {
    setPrevId(record?.candidateId ?? null);
    setNote(initialNote);
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

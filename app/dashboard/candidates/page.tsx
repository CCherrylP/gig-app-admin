"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserGroupIcon, Mail01Icon, CallIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EmptyState,
  FilterTabs,
  InitialsAvatar,
  PageHeader,
  SearchInput,
  TableShell,
  TableSkeleton,
  initials,
} from "@/components/dashboard/data-views";
import {
  CANDIDATE_PAGE_SIZE,
  listCandidates,
  ratingLabel,
  type CandidateSummary,
} from "@/lib/candidates";
import { relative } from "@/lib/format";

type VerifiedFilter = "all" | "verified" | "unverified";

const FILTERS: { value: VerifiedFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "verified", label: "Singpass verified" },
  { value: "unverified", label: "Not verified" },
];

export default function CandidatesPage() {
  const [search, setSearch] = useState("");
  const [verified, setVerified] = useState<VerifiedFilter>("all");
  const [offset, setOffset] = useState(0);

  // The search goes to the API rather than filtering a page in the browser —
  // this list is capped at fifty rows, so a client-side filter would only ever
  // search the fifty already fetched and silently miss everybody else.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["candidates", search, verified, offset],
    queryFn: () => listCandidates({ q: search || undefined, verified, offset }),
    // Keeps the table on screen while the next page loads instead of flashing
    // the skeleton on every keystroke.
    placeholderData: keepPreviousData,
  });

  const candidates = data?.candidates ?? [];
  const total = data?.total ?? 0;
  const showing = offset + candidates.length;

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      // Page 3 of a different search is not a page anybody asked for.
      setOffset(0);
    };
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Candidates"
        description="For support — finding the person who wrote in, and seeing what is keeping them from applying."
      >
        <SearchInput
          value={search}
          onChange={change(setSearch)}
          placeholder="Search name or phone…"
          className="w-full sm:w-72"
        />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          options={FILTERS}
          value={verified}
          onChange={change<VerifiedFilter>(setVerified)}
        />
        {total > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Showing {offset + 1}–{showing} of {total}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : candidates.length === 0 ? (
            <EmptyState
              icon={UserGroupIcon}
              message={
                search ? "Nobody matches that search." : "No candidates yet."
              }
            />
          ) : (
            <TableShell
              headers={[
                "Candidate",
                "Contact",
                "Right to work",
                "Track record",
                "Waiting on us",
                "Joined",
              ]}
              widths={[
                "w-[22%]",
                "w-[22%]",
                "w-[13%]",
                "w-[18%]",
                "w-[15%]",
                "w-[10%]",
              ]}
            >
              {candidates.map((candidate) => (
                <CandidateRow key={candidate.userId} candidate={candidate} />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>

      {total > CANDIDATE_PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0 || isFetching}
            onClick={() => setOffset(Math.max(0, offset - CANDIDATE_PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={showing >= total || isFetching}
            onClick={() => setOffset(offset + CANDIDATE_PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function CandidateRow({ candidate }: { candidate: CandidateSummary }) {
  const name = candidate.name ?? "Unnamed candidate";

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={candidate.userId}
            label={initials(name)}
            className="size-8"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {candidate.verified ? "Verified" : "Not verified"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {candidate.area ?? "No area given"}
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
            <span className="truncate">{candidate.email ?? "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon
              icon={CallIcon}
              size={13}
              strokeWidth={2}
              className="shrink-0 text-muted-foreground"
            />
            <span className="truncate">{candidate.phone ?? "—"}</span>
          </span>
        </div>
      </td>

      <td className="px-4 py-3 truncate text-xs text-muted-foreground">
        {/* Null means not answered, which is a different thing from not
            allowed — so it reads as a gap rather than as a refusal. */}
        {candidate.workStatus ?? "Not answered"}
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          {/* 0 is NOT RATED YET, never a zero-star score — nothing in this app
              can rate somebody below 1. */}
          <span className="font-medium">{ratingLabel(candidate.rating)}</span>
          <span className="text-muted-foreground">
            {candidate.shiftsDone} shift
            {candidate.shiftsDone === 1 ? "" : "s"} done
          </span>
          <span className="text-muted-foreground">
            {candidate.turnUpRate == null
              ? "No turn-up rate yet"
              : `${candidate.turnUpRate}% turn-up`}
          </span>
          {candidate.lateCancels > 0 && (
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {candidate.lateCancels} late cancellation
              {candidate.lateCancels === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </td>

      <td className="px-6 py-4">
        {/* The answer to "why can't I apply" nine times out of ten. */}
        {candidate.pendingCertificates > 0 ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {candidate.pendingCertificates} certificate
            {candidate.pendingCertificates === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Nothing</span>
        )}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
        {relative(candidate.createdAt)}
      </td>
    </tr>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon, UserBlock01Icon, Alert02Icon } from "@hugeicons/core-free-icons";

import { Card, CardContent } from "@/components/ui/card";
import {
  EmptyState,
  FilterTabs,
  InitialsAvatar,
  PageHeader,
  SearchInput,
  StatCard,
  StatusPill,
  TableShell,
  TableSkeleton,
  initials,
} from "@/components/dashboard/data-views";
import {
  listBlocks,
  listRatings,
  ratingText,
  type BlockedCandidate,
  type Rating,
} from "@/lib/reputation";
import { date, relative } from "@/lib/format";

// Reputation, read-only.
//
// Three views of the same question — how is somebody seen here — kept on one
// page because they are read together. Somebody looking at a candidate blocked
// by four companies wants their ratings in the next tab, not the next screen.
//
// NOTHING ON THIS PAGE DECIDES ANYTHING, and that is the design rather than an
// omission. A block belongs to the employer who made it and is deliberately not
// a platform ban; a review is its author's opinion, which the employer already
// has a route to contest. What staff get here is the PATTERN, which no single
// row can show. Acting on one is the candidates screen, by a person, with a
// reason the candidate is told.

type Tab = "blacklist" | "candidates" | "companies";

const TABS: { value: Tab; label: string }[] = [
  { value: "blacklist", label: "Blacklisted" },
  { value: "candidates", label: "Candidate ratings" },
  { value: "companies", label: "Company ratings" },
];

const REVIEW_STYLES: Record<string, string> = {
  PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function ReputationPage() {
  const [tab, setTab] = useState<Tab>("blacklist");
  const [search, setSearch] = useState("");

  const blocks = useQuery({
    queryKey: ["blocks", "all"],
    queryFn: () => listBlocks("all"),
    enabled: tab === "blacklist",
  });

  const about = tab === "companies" ? "companies" : "candidates";
  const ratings = useQuery({
    queryKey: ["ratings", about],
    queryFn: () => listRatings(about),
    enabled: tab !== "blacklist",
  });

  const term = search.trim().toLowerCase();

  const shownBlocks = useMemo(() => {
    const all = blocks.data?.blocks ?? [];
    if (!term) return all;
    return all.filter((b) =>
      [b.candidateName ?? "", b.companyName, b.companyUen, b.reason]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [blocks.data, term]);

  const shownRatings = useMemo(() => {
    const all = ratings.data?.ratings ?? [];
    if (!term) return all;
    return all.filter((r) =>
      [r.candidateName ?? "", r.companyName ?? "", r.roleName ?? "", r.body ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [ratings.data, term]);

  const loading = tab === "blacklist" ? blocks.isLoading : ratings.isLoading;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Reputation"
        description="Who has been blocked where, and every rating behind the averages the app shows. Read-only — a block is the employer's own, and a review is its author's."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search candidate, company or reason…"
          className="w-full sm:w-72"
        />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Live blocks"
          count={blocks.data?.activeCount ?? "—"}
          icon={UserBlock01Icon}
          cls="text-amber-500"
        />
        <StatCard
          label="People blocked somewhere"
          count={blocks.data?.blockedCandidateCount ?? "—"}
          icon={UserBlock01Icon}
        />
        <StatCard
          label="Reviews awaiting the employer"
          count={ratings.data?.pendingCount ?? "—"}
          icon={StarIcon}
        />
      </div>

      <FilterTabs options={TABS} value={tab} onChange={setTab} />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : tab === "blacklist" ? (
            shownBlocks.length === 0 ? (
              <EmptyState
                icon={UserBlock01Icon}
                message={
                  term
                    ? "Nothing matches that search."
                    : "No employer has blocked anybody."
                }
              />
            ) : (
              <TableShell
                headers={[
                  "Candidate",
                  "Blocked by",
                  "Reason",
                  "Blocked",
                  "Status",
                  "Elsewhere",
                ]}
                widths={[
                  "w-[20%]",
                  "w-[20%]",
                  "w-[26%]",
                  "w-[12%]",
                  "w-[11%]",
                  "w-[11%]",
                ]}
              >
                {shownBlocks.map((block) => (
                  <BlockRow
                    key={`${block.companyId}-${block.candidateId}-${block.blockedAt}`}
                    block={block}
                  />
                ))}
              </TableShell>
            )
          ) : shownRatings.length === 0 ? (
            <EmptyState
              icon={StarIcon}
              message={
                term
                  ? "Nothing matches that search."
                  : tab === "companies"
                    ? "No candidate has rated a company yet."
                    : "No ratings about candidates yet."
              }
            />
          ) : (
            <TableShell
              headers={[
                tab === "companies" ? "Company" : "Candidate",
                "Rated by",
                "Rating",
                "What they wrote",
                "Shift",
                "Status",
              ]}
              widths={[
                "w-[18%]",
                "w-[16%]",
                "w-[10%]",
                "w-[26%]",
                "w-[16%]",
                "w-[14%]",
              ]}
            >
              {shownRatings.map((row) => (
                <RatingRow key={row.id} row={row} tab={tab} />
              ))}
            </TableShell>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BlockRow({ block }: { block: BlockedCandidate }) {
  const name = block.candidateName ?? "Unnamed candidate";
  const lifted = !!block.liftedAt;
  // The number this page exists for. One block is an employer's bad afternoon;
  // several across different businesses is a pattern worth somebody reading.
  const pattern = !lifted && block.activeBlocksForCandidate > 1;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={block.candidateId}
            label={initials(name)}
            className="size-8"
          />
          <span className="truncate font-medium">{name}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{block.companyName}</span>
          <span className="truncate text-xs tabular-nums text-muted-foreground">
            UEN {block.companyUen}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{block.reason}</span>
          {/* The employer's private note. Here because "rude" with nothing
              behind it is not something to act on. */}
          {block.note && (
            <span className="line-clamp-2 text-xs italic text-muted-foreground">
              “{block.note}”
            </span>
          )}
        </div>
      </td>

      <td className="px-4 py-3 text-xs text-muted-foreground">
        {relative(block.blockedAt)}
      </td>

      <td className="px-4 py-3">
        {lifted ? (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="inline-flex w-fit items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              Lifted
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {relative(block.liftedAt)}
            </span>
          </div>
        ) : (
          <span className="inline-flex w-fit items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Blocked
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        {pattern ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <HugeiconsIcon icon={Alert02Icon} size={13} strokeWidth={2} />
            {block.activeBlocksForCandidate} companies
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {lifted ? "—" : "Only here"}
          </span>
        )}
      </td>
    </tr>
  );
}

function RatingRow({ row, tab }: { row: Rating; tab: Tab }) {
  // Whose name leads depends on which list this is: the subject of the review,
  // never its author.
  const subject =
    tab === "companies"
      ? (row.companyName ?? "Listing deleted")
      : (row.candidateName ?? "Unnamed candidate");
  const subjectSeed = tab === "companies" ? (row.companyId ?? row.id) : row.candidateId;

  const author =
    row.by === "system"
      ? "Automatic penalty"
      : row.by === "employer"
        ? (row.companyName ?? "An employer")
        : (row.candidateName ?? "A candidate");

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            seed={subjectSeed}
            label={initials(subject)}
            className="size-8"
          />
          <span className="truncate font-medium">{subject}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className="truncate text-xs text-muted-foreground">{author}</span>
      </td>

      <td className="px-4 py-3">
        {/* A system row carries POINTS DEDUCTED, not a star score — printing
            "-1.0 ★" would read as a rating below anything the pickers can
            produce. */}
        <span
          className={
            row.by === "system"
              ? "text-sm font-medium tabular-nums text-destructive"
              : "text-sm font-medium tabular-nums"
          }
        >
          {ratingText(row)}
        </span>
      </td>

      <td className="px-4 py-3">
        {row.body ? (
          <span className="line-clamp-2 text-xs">{row.body}</span>
        ) : (
          <span className="text-xs text-muted-foreground">No words, just a score</span>
        )}
        {row.editedAt && (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            Edited {relative(row.editedAt)}
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col text-xs">
          <span className="truncate">{row.roleName ?? "—"}</span>
          <span className="truncate text-muted-foreground">
            {row.shiftOnDate ? date(row.shiftOnDate) : "Listing deleted"}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <StatusPill status={row.status} styles={REVIEW_STYLES} />
          {/* Only reviews about an EMPLOYER wait on a decision. One about a
              candidate publishes at once — a private reference the next
              employer reads, not a public page. */}
          {row.status === "pending" && row.about === "company" && (
            <span className="truncate text-[11px] text-muted-foreground">
              With the employer
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

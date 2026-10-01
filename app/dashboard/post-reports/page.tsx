"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Cancel01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import { ReviewTabs } from "@/components/dashboard/review-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  REASON_LABELS,
  decidePostReport,
  listPostReports,
  type PostReportFilter,
  type ReportedPost,
} from "@/lib/post-reports";
import { openFreshDocument } from "@/lib/documents";
import { relative } from "@/lib/format";

const FILTERS: { value: PostReportFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "reviewed", label: "Reviewed" },
  { value: "all", label: "All" },
];

const STATE_STYLES: Record<string, string> = {
  HIDDEN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  VISIBLE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  REVIEWED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

type Decision = { post: ReportedPost; action: "keep" | "remove" };

export default function PostReportsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<PostReportFilter>("open");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["post-reports", filter],
    queryFn: () => listPostReports(filter),
  });

  const mutation = useMutation({
    mutationFn: ({ post, action }: Decision) => decidePostReport(post.postId, action),
    onSuccess: (_result, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["post-reports"] });
      // The sidebar badge counts open reports.
      queryClient.invalidateQueries({ queryKey: ["admin", "counts"] });
      setDecision(null);
      toast.success(action === "remove" ? "Post removed" : "Post kept");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not record that decision");
      setDecision(null);
      queryClient.invalidateQueries({ queryKey: ["post-reports"] });
    },
  });

  // Photos open from a fresh fetch: the signed link on screen expires after ten minutes.
  function openPhoto(postId: string, index: number) {
    void openFreshDocument({
      queryClient,
      queryKey: ["post-reports", filter],
      queryFn: () => listPostReports(filter),
      select: (fresh) => fresh.posts.find((post) => post.postId === postId)?.photoUrls[index],
      onMissing: () => toast.error("That photo could not be opened. Try again."),
    });
  }

  const posts = useMemo(() => {
    const all = data?.posts ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;

    return all.filter((post) =>
      [post.author.name, post.caption ?? "", ...post.reports.map((report) => report.note ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <ReviewTabs />
      <PageHeader
        title="Reported posts"
        description="Feed posts people flagged. Three reports hide a post from everyone but its author until you decide. Keep it if it is fine, or remove it."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search author, caption or note…"
          className="w-full sm:w-72"
        />
      </PageHeader>

      <FilterTabs
        options={FILTERS.map((option) => ({
          ...option,
          count: option.value === "open" ? data?.openCount : undefined,
        }))}
        value={filter}
        onChange={setFilter}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : posts.length === 0 ? (
            <EmptyState
              icon={Alert02Icon}
              message={search ? "Nothing matches that search." : "No reported posts here."}
            />
          ) : (
            <TableShell
              headers={["Post", "Author", "Reports", "What they said", "State", "Decision"]}
              widths={["w-[26%]", "w-[14%]", "w-[16%]", "w-[20%]", "w-[9%]", "w-[15%]"]}
            >
              {posts.map((post) => (
                <PostRow
                  key={post.postId}
                  post={post}
                  onOpenPhoto={(index) => openPhoto(post.postId, index)}
                  onDecide={(action) => setDecision({ post, action })}
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

function PostRow({
  post,
  onOpenPhoto,
  onDecide,
}: {
  post: ReportedPost;
  onOpenPhoto: (index: number) => void;
  onDecide: (action: "keep" | "remove") => void;
}) {
  const state = post.openCount === 0 ? "reviewed" : post.hiddenAt ? "hidden" : "visible";
  const notes = post.reports.filter((report) => report.note);

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          {post.photoUrls.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.photoUrls.slice(0, 4).map((url, index) => (
                // Opens a freshly signed copy, full size, in a new tab.
                <button
                  key={index}
                  type="button"
                  onClick={() => onOpenPhoto(index)}
                  className="overflow-hidden rounded-md border"
                  aria-label={`Open photo ${index + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-16 object-cover" />
                </button>
              ))}
              {post.photoUrls.length > 4 && (
                <span className="self-center text-xs text-muted-foreground">+{post.photoUrls.length - 4}</span>
              )}
            </div>
          )}
          {post.caption ? (
            <span className="line-clamp-3 text-sm">{post.caption}</span>
          ) : (
            <span className="text-xs text-muted-foreground">No caption</span>
          )}
          <span className="text-xs text-muted-foreground">
            {post.visibility === "public" ? "Public" : "Friends only"} · posted {relative(post.postedAt)}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar seed={post.author.id} label={initials(post.author.name)} className="size-8" />
          <span className="truncate font-medium">{post.author.name}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">
            {post.reportCount} report{post.reportCount === 1 ? "" : "s"}
            {post.openCount > 0 && post.openCount !== post.reportCount && ` · ${post.openCount} open`}
          </span>
          {post.reasons.map((entry) => (
            <span key={entry.reason} className="text-xs text-muted-foreground">
              {REASON_LABELS[entry.reason]} × {entry.count}
            </span>
          ))}
          <span className="text-xs text-muted-foreground">Last {relative(post.lastReportedAt)}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        {notes.length === 0 ? (
          <span className="text-xs text-muted-foreground">No notes</span>
        ) : (
          <div className="flex flex-col gap-1">
            {notes.slice(0, 3).map((report) => (
              <span key={report.id} className="line-clamp-2 text-xs italic text-foreground/80">
                “{report.note}” <span className="not-italic text-muted-foreground">({report.reporterName})</span>
              </span>
            ))}
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        <StatusPill status={state} styles={STATE_STYLES} />
      </td>

      <td className="px-4 py-3">
        {post.openCount > 0 && (
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="destructive" size="xs" onClick={() => onDecide("remove")}>
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              Remove
            </Button>
            <Button size="xs" onClick={() => onDecide("keep")}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
              Keep
            </Button>
          </div>
        )}
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
  const removing = decision?.action === "remove";

  return (
    <Dialog open={!!decision} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{removing ? "Remove this post" : "Keep this post"}</DialogTitle>
          <DialogDescription>
            {decision && (
              <>
                A post by <span className="font-medium text-foreground">{decision.post.author.name}</span> with{" "}
                {decision.post.openCount} open report{decision.post.openCount === 1 ? "" : "s"}.{" "}
                {removing
                  ? "The post and its photos are deleted for good, and the author is told it was removed for breaking the community rules. This cannot be undone."
                  : "Its reports are marked reviewed. If it was hidden, it shows in the feed again. People who reported it still won't see it."}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Back
          </Button>
          <Button variant={removing ? "destructive" : "default"} size="sm" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Saving…" : removing ? "Remove post" : "Keep post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

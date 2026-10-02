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
  decideCommentReport,
  decidePostReport,
  listCommentReports,
  listPostReports,
  type PostReportEntry,
  type PostReportFilter,
  type PostReportReason,
  type ReportedComment,
  type ReportedPost,
} from "@/lib/post-reports";
import { openFreshDocument } from "@/lib/documents";
import { relative } from "@/lib/format";

// Reported posts and reported comments. Two queues because they carry different columns.
type Queue = "posts" | "comments";

const QUEUES: { value: Queue; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
];

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

type Decision =
  | { kind: "post"; item: ReportedPost; action: "keep" | "remove" }
  | { kind: "comment"; item: ReportedComment; action: "keep" | "remove" };

export default function SocialReportsPage() {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<Queue>("posts");
  const [filter, setFilter] = useState<PostReportFilter>("open");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);

  // Both load, so the badge on the other queue stays live.
  const postsQuery = useQuery({ queryKey: ["post-reports", filter], queryFn: () => listPostReports(filter) });
  const commentsQuery = useQuery({
    queryKey: ["comment-reports", filter],
    queryFn: () => listCommentReports(filter),
  });

  const mutation = useMutation({
    mutationFn: async (choice: Decision): Promise<void> => {
      if (choice.kind === "post") await decidePostReport(choice.item.postId, choice.action);
      else await decideCommentReport(choice.item.commentId, choice.action);
    },
    onSuccess: (_result, choice) => {
      queryClient.invalidateQueries({ queryKey: [choice.kind === "post" ? "post-reports" : "comment-reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "counts"] });
      setDecision(null);
      toast.success(
        `${choice.kind === "post" ? "Post" : "Comment"} ${choice.action === "remove" ? "removed" : "kept"}`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not record that decision");
      setDecision(null);
      queryClient.invalidateQueries({ queryKey: ["post-reports"] });
      queryClient.invalidateQueries({ queryKey: ["comment-reports"] });
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

  const term = search.trim().toLowerCase();
  const matches = (parts: string[]) => !term || parts.join(" ").toLowerCase().includes(term);

  const posts = useMemo(
    () =>
      (postsQuery.data?.posts ?? []).filter((post) =>
        matches([post.author.name, post.caption ?? "", ...post.reports.map((r) => r.note ?? "")]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [postsQuery.data, term],
  );

  const comments = useMemo(
    () =>
      (commentsQuery.data?.comments ?? []).filter((comment) =>
        matches([comment.author.name, comment.body, ...comment.reports.map((r) => r.note ?? "")]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commentsQuery.data, term],
  );

  const loading = queue === "posts" ? postsQuery.isLoading : commentsQuery.isLoading;
  const empty = queue === "posts" ? posts.length === 0 : comments.length === 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <ReviewTabs />
      <PageHeader
        title="Social posting reports"
        description="Feed posts and comments people flagged. Three reports hide one from everyone but its writer until you decide. Keep it if it is fine, or remove it."
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search writer, text or note…"
          className="w-full sm:w-72"
        />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          options={QUEUES.map((option) => ({
            ...option,
            count: option.value === "posts" ? postsQuery.data?.openCount : commentsQuery.data?.openCount,
          }))}
          value={queue}
          onChange={setQueue}
        />
        <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : empty ? (
            <EmptyState
              icon={Alert02Icon}
              message={search ? "Nothing matches that search." : `No reported ${queue} here.`}
            />
          ) : queue === "posts" ? (
            <TableShell
              headers={["Post", "Writer", "Reports", "What they said", "State", "Decision"]}
              widths={["w-[26%]", "w-[14%]", "w-[16%]", "w-[20%]", "w-[9%]", "w-[15%]"]}
            >
              {posts.map((post) => (
                <PostRow
                  key={post.postId}
                  post={post}
                  onOpenPhoto={(index) => openPhoto(post.postId, index)}
                  onDecide={(action) => setDecision({ kind: "post", item: post, action })}
                />
              ))}
            </TableShell>
          ) : (
            <TableShell
              headers={["Comment", "Writer", "Reports", "What they said", "State", "Decision"]}
              widths={["w-[26%]", "w-[14%]", "w-[16%]", "w-[20%]", "w-[9%]", "w-[15%]"]}
            >
              {comments.map((comment) => (
                <CommentRow
                  key={comment.commentId}
                  comment={comment}
                  onDecide={(action) => setDecision({ kind: "comment", item: comment, action })}
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

const stateOf = (item: { openCount: number; hiddenAt: string | null }) =>
  item.openCount === 0 ? "reviewed" : item.hiddenAt ? "hidden" : "visible";

function Writer({ id, name }: { id: string; name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <InitialsAvatar seed={id} label={initials(name)} className="size-8" />
      <span className="truncate font-medium">{name}</span>
    </div>
  );
}

function ReportsCell({
  reportCount,
  openCount,
  reasons,
  lastReportedAt,
}: {
  reportCount: number;
  openCount: number;
  reasons: { reason: PostReportReason; count: number }[];
  lastReportedAt: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">
        {reportCount} report{reportCount === 1 ? "" : "s"}
        {openCount > 0 && openCount !== reportCount && ` · ${openCount} open`}
      </span>
      {reasons.map((entry) => (
        <span key={entry.reason} className="text-xs text-muted-foreground">
          {REASON_LABELS[entry.reason]} × {entry.count}
        </span>
      ))}
      <span className="text-xs text-muted-foreground">Last {relative(lastReportedAt)}</span>
    </div>
  );
}

function NotesCell({ reports }: { reports: PostReportEntry[] }) {
  const notes = reports.filter((report) => report.note);

  if (notes.length === 0) return <span className="text-xs text-muted-foreground">No notes</span>;

  return (
    <div className="flex flex-col gap-1">
      {notes.slice(0, 3).map((report) => (
        <span key={report.id} className="line-clamp-2 text-xs italic text-foreground/80">
          “{report.note}” <span className="not-italic text-muted-foreground">({report.reporterName})</span>
        </span>
      ))}
    </div>
  );
}

function Actions({ show, onDecide }: { show: boolean; onDecide: (action: "keep" | "remove") => void }) {
  if (!show) return null;

  return (
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
        <Writer id={post.author.id} name={post.author.name} />
      </td>
      <td className="px-4 py-3">
        <ReportsCell {...post} />
      </td>
      <td className="px-4 py-3">
        <NotesCell reports={post.reports} />
      </td>
      <td className="px-4 py-3">
        <StatusPill status={stateOf(post)} styles={STATE_STYLES} />
      </td>
      <td className="px-4 py-3">
        <Actions show={post.openCount > 0} onDecide={onDecide} />
      </td>
    </tr>
  );
}

function CommentRow({
  comment,
  onDecide,
}: {
  comment: ReportedComment;
  onDecide: (action: "keep" | "remove") => void;
}) {
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <span className="line-clamp-4 text-sm">{comment.body}</span>
          {/* The post it was left on, for context. */}
          <span className="line-clamp-2 text-xs text-muted-foreground">
            On {comment.post.authorName}&apos;s post
            {comment.post.caption ? `: “${comment.post.caption}”` : ""}
          </span>
          <span className="text-xs text-muted-foreground">Written {relative(comment.postedAt)}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Writer id={comment.author.id} name={comment.author.name} />
      </td>
      <td className="px-4 py-3">
        <ReportsCell {...comment} />
      </td>
      <td className="px-4 py-3">
        <NotesCell reports={comment.reports} />
      </td>
      <td className="px-4 py-3">
        <StatusPill status={stateOf(comment)} styles={STATE_STYLES} />
      </td>
      <td className="px-4 py-3">
        <Actions show={comment.openCount > 0} onDecide={onDecide} />
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
  const noun = decision?.kind === "comment" ? "comment" : "post";

  return (
    <Dialog open={!!decision} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{removing ? `Remove this ${noun}` : `Keep this ${noun}`}</DialogTitle>
          <DialogDescription>
            {decision && (
              <>
                A {noun} by <span className="font-medium text-foreground">{decision.item.author.name}</span> with{" "}
                {decision.item.openCount} open report{decision.item.openCount === 1 ? "" : "s"}.{" "}
                {removing
                  ? `The ${noun} is deleted for good, and its writer is told it was removed for breaking the community rules. This cannot be undone.`
                  : `Its reports are marked reviewed. If it was hidden, it shows again. People who reported it still won't see it.`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Back
          </Button>
          <Button variant={removing ? "destructive" : "default"} size="sm" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Saving…" : removing ? `Remove ${noun}` : `Keep ${noun}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

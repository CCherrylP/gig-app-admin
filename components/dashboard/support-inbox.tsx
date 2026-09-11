"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BubbleChatQuestionIcon,
  CheckmarkCircle02Icon,
  ArrowLeft02Icon,
  SentIcon,
  ArrowTurnBackwardIcon,
  Robot01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EmptyState,
  FilterTabs,
  InitialsAvatar,
  PageHeader,
  SearchInput,
  StatusPill,
  initials,
} from "@/components/dashboard/data-views";
import {
  categoryLabel,
  getSupportThread,
  listSupportThreads,
  replyToSupportThread,
  setSupportThreadStatus,
  SUPPORT_STATUS_STYLES,
  type SupportFilter,
  type SupportMessage,
  type SupportRole,
  type SupportThreadResponse,
  type SupportThreadSummary,
} from "@/lib/inbox";
import { dateTime, relative } from "@/lib/format";
import { cn } from "@/lib/utils";

// The support queue, drawn as a MESSAGING INBOX rather than as a table.
//
// Every other queue in this dashboard is a table because every other queue is a
// decision over a row: approve the certificate, waive the penalty. This one is a
// conversation, and a table of it would hide the only thing that matters —
// what was actually said. So it is the shape people already know: threads down
// the left, the conversation on the right, a composer under it.
//
// ONE COMPONENT, TWO PAGES. The candidate and employer inboxes are the same
// query with a different `role`; the split is which staff answer which, not a
// difference in the row. See app/dashboard/inbox/*.

const FILTERS: { value: SupportFilter; label: string }[] = [
  // Open first in the row, but NOT the default any more — see `filter` below.
  { value: "open", label: "Open" },
  { value: "answered", label: "Answered" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

/** One bubble.
 *
 *  Three shapes rather than two, because `bot` is neither side of the
 *  conversation: it is what the app already tried and failed with. Drawing it
 *  like the person's own message would have staff answering a question the
 *  person never asked. */
function MessageBubble({ message }: { message: SupportMessage }) {
  if (message.author === "bot") {
    return (
      <div className="flex justify-center px-4 py-1">
        <div className="flex max-w-[85%] items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <HugeiconsIcon
            icon={Robot01Icon}
            size={14}
            strokeWidth={2}
            className="mt-px shrink-0 opacity-60"
          />
          <span>
            <span className="font-medium">Automated reply — </span>
            {message.body}
          </span>
        </div>
      </div>
    );
  }

  const mine = message.author === "admin";

  return (
    <div className={cn("flex px-4 py-1", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[75%]", mine && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
            mine
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-muted text-foreground",
          )}
        >
          {message.body}
        </div>
        <span
          className="mt-1 px-1 text-[11px] text-muted-foreground"
          title={dateTime(message.createdAt)}
        >
          {relative(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: SupportThreadSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors",
        active ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <InitialsAvatar
        seed={thread.userId}
        label={initials(thread.name ?? "?")}
        className="mt-0.5 size-8 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {/* An account that never finished setup has no name, and that is
                itself a common reason for writing in — so the row falls back to
                the id rather than rendering an empty line. */}
            {thread.name ?? `${thread.userId.slice(0, 8)}…`}
          </span>
          <span
            className="shrink-0 text-[11px] text-muted-foreground"
            title={dateTime(thread.lastMessageAt)}
          >
            {relative(thread.lastMessageAt)}
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {thread.question}
        </p>

        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {categoryLabel(thread.category)}
          </span>
          {thread.unreadCount > 0 && (
            <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {thread.unreadCount}
            </span>
          )}
          {thread.status === "closed" && (
            <StatusPill status="closed" styles={SUPPORT_STATUS_STYLES} />
          )}
        </div>
      </div>
    </button>
  );
}

export function SupportInbox({
  role,
  title,
  description,
}: {
  role: SupportRole;
  title: string;
  description: string;
}) {
  const queryClient = useQueryClient();
  // ALL, not Open.
  //
  // Open was the default on the reasoning that the waiting conversations are the
  // job and everything else is history. The trouble is that answering one is
  // exactly what moves it OUT of Open: staff replied, the thread went to
  // `answered`, and the tab they were standing on emptied itself — "Nothing
  // waiting. Every question has been answered." next to a conversation they had
  // been in the middle of. Nothing was lost, it was one tab away, but a queue
  // that empties as you work it reads as one that ate your work.
  //
  // All keeps the history in front of them and makes replying visibly additive.
  // The count on the Open tab still says how much is actually waiting, which was
  // the only thing the old default really provided.
  const [filter, setFilter] = useState<SupportFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  /** True while a reply is in flight. State rather than the mutation's own
   *  `isPending` only because it has to be readable ABOVE the mutation, by the
   *  polling below — see the note on the thread query. */
  const [sending, setSending] = useState(false);

  // THE QUEUE REFRESHES ITSELF. Nothing else in this dashboard polls, because
  // nothing else in it is a conversation: a certificate sits in its queue until
  // somebody works it, and a list that only moves when you act on it is right
  // there. Here the other side is a person typing WHILE staff are looking at
  // the screen, and a message that arrives when nobody clicks anything is the
  // normal case rather than the edge — until this, it stayed invisible until
  // the tab was refocused or a row was clicked, which reads as the candidate
  // not having replied.
  //
  // 15s on the list, and react-query's default `refetchIntervalInBackground:
  // false` is doing real work here: a dashboard left open on a spare monitor
  // overnight polls nothing at all, and picks up the moment it is looked at.
  const { data, isLoading } = useQuery({
    queryKey: ["inbox", role, filter],
    queryFn: () => listSupportThreads(role, filter),
    refetchInterval: 15_000,
  });

  const threads = useMemo(() => data?.threads ?? [], [data]);

  // Client-side, over a list the API has already filtered. The queue is the
  // dead ends rather than every question asked, so it is small enough that a
  // round trip per keystroke would be the slower answer.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter(
      (thread) =>
        (thread.name ?? "").toLowerCase().includes(needle) ||
        thread.question.toLowerCase().includes(needle) ||
        categoryLabel(thread.category).toLowerCase().includes(needle),
    );
  }, [threads, search]);

  // Faster than the list: this is the conversation somebody is reading right
  // now, and a reply landing in it is the thing they are waiting for.
  //
  // PAUSED WHILE SENDING. The composer paints its own message optimistically,
  // and a poll that fires during the POST would answer with the thread as it was
  // a moment before — pulling the bubble back off the screen until the reply
  // resolves and puts it back. A cancelled in-flight read is handled by
  // `cancelQueries` in onMutate; this is the one that would START mid-flight.
  const { data: openedThread, isFetching: loadingThread } = useQuery({
    queryKey: ["inbox", "thread", selectedId],
    queryFn: () => getSupportThread(selectedId as string),
    enabled: Boolean(selectedId),
    refetchInterval: sending ? false : 10_000,
  });

  const thread = openedThread?.thread ?? null;

  /** The list as drawn: `visible`, plus the conversation being read when the
   *  current filter has stopped containing it.
   *
   *  THIS IS WHAT KEEPS A REPLY FROM CLOSING THE THREAD IT ANSWERS. Replying
   *  moves a thread to `answered`, so the Open tab — the default, and the one
   *  staff live on — drops it the instant Send is pressed. The selection used to
   *  be dropped with it: the right-hand pane went back to "Pick a conversation
   *  to read it." and the list said "Nothing waiting", both as the reply landed.
   *  From where staff are sitting, the conversation they were part-way through
   *  answering vanished, and the obvious reading is that the message went
   *  nowhere. Closing a thread while looking at it did the same.
   *
   *  So the row stays where it is, keeps its highlight, and the conversation
   *  stays open and writable until staff move off it themselves. The status pill
   *  beside the name is what reports the thread changed state; a row
   *  disappearing is not a way to tell somebody their reply worked.
   *
   *  A thread that is genuinely GONE — hidden by the person, or a stale id — is
   *  a different case and still handled: the detail query fails, `thread` is
   *  null, nothing is pinned, and the pane says so. */
  const rows = useMemo(() => {
    if (!thread || visible.some((row) => row.id === thread.id)) return visible;
    return [thread, ...visible];
  }, [visible, thread]);

  // Opening a thread marks it read SERVER-SIDE, so the list's unread badges are
  // stale the moment the detail arrives. Invalidating here rather than in the
  // queryFn keeps that a consequence of the data landing.
  useEffect(() => {
    if (thread) {
      queryClient.invalidateQueries({ queryKey: ["inbox", role] });
    }
    // Keyed on the id, not the object: refetches of the same thread must not
    // loop this back into another invalidation.
  }, [thread?.id, queryClient, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pin the conversation to the newest message, the way every messaging app
  // does. `auto` and not `smooth` on a thread switch — animating a scroll the
  // reader did not ask for just delays the thing they clicked to see.
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.id, thread?.messages.length]);

  /** Put the server's copy of a thread straight into the cache, and refetch only
   *  the LISTS.
   *
   *  Every write here answers with the whole updated thread, so re-requesting the
   *  thing we were just handed is a round trip that can only tell us what we
   *  already know — and until it lands the conversation on screen is the one from
   *  before the write. That is the wait. Invalidating `["inbox"]` wholesale made
   *  it worse by matching the detail query too, so a reply fired the list, the
   *  sidebar badge AND a re-read of the open thread.
   *
   *  The predicate keeps the lists and the badge honest (a reply moves a thread
   *  between tabs and changes the open count) while leaving the detail alone,
   *  because what we just wrote into it IS the response. */
  const applyThread = (result: SupportThreadResponse) => {
    queryClient.setQueryData(["inbox", "thread", result.thread.id], result);
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === "inbox" && query.queryKey[1] !== "thread",
    });
  };

  const reply = useMutation({
    mutationFn: (body: string) =>
      replyToSupportThread(selectedId as string, body),

    // ON SCREEN AS IT IS PRESSED, not when the server comes back. A chat that
    // holds what you typed until a round trip finishes reads as having dropped
    // it — which is exactly what staff reported: the reply "took so long" to
    // appear, so it looked like nothing had been sent. The app's own composer
    // has always worked this way (see reply() in the app's Support screen); this
    // side was the one still waiting.
    //
    // The placeholder is replaced by the real row in onSuccess and rolled back in
    // onError, so a failed send cannot leave a message on screen that nobody
    // received.
    onMutate: async (body: string) => {
      const key = ["inbox", "thread", selectedId] as const;

      // Before the cancel, so the poll cannot be re-armed underneath it.
      setSending(true);

      // Stops an in-flight read of this thread resolving after the placeholder
      // goes in and overwriting it with a copy that does not have it.
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<SupportThreadResponse>(key);

      if (previous) {
        const pending: SupportMessage = {
          // Prefixed rather than a uuid: it is a React key for one render, and a
          // shape that cannot be mistaken for a row the API issued.
          id: `pending-${Date.now()}`,
          author: "admin",
          body,
          createdAt: new Date().toISOString(),
          readAt: null,
        };

        queryClient.setQueryData<SupportThreadResponse>(key, {
          ...previous,
          thread: {
            ...previous.thread,
            messages: [...previous.thread.messages, pending],
          },
        });
      }

      // Cleared here and not in onSuccess, for the same reason: the box empties
      // as the message leaves it.
      setDraft("");

      return { previous, key };
    },

    onSuccess: (result) => {
      applyThread(result);
      // Says what the reply DID, not that a request succeeded. The push is the
      // reason this feature exists, and staff should know it went out.
      toast.success("Reply sent — they have been notified");
    },

    onError: (error: Error, body, context) => {
      // The conversation goes back to exactly what it was, and the text returns
      // to the box so it can be sent again rather than retyped.
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
      setDraft((current) => current || body);
      toast.error(error.message || "Could not send that reply");
    },

    // Both paths, so a failed send cannot leave the conversation frozen on a
    // stale copy with its polling switched off.
    onSettled: () => setSending(false),
  });

  const statusChange = useMutation({
    mutationFn: (status: "closed" | "open") =>
      setSupportThreadStatus(selectedId as string, status),
    onSuccess: (result, status) => {
      applyThread(result);
      toast.success(
        status === "closed" ? "Conversation closed" : "Conversation reopened",
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not change that");
    },
  });

  const send = () => {
    const body = draft.trim();
    if (!body || reply.isPending) return;
    reply.mutate(body);
  };

  // From the API, not counted out of `threads` — that list has the status filter
  // on it, so counting it made the Open tab read "0" the moment somebody clicked
  // Closed, which is the badge lying about how much work is left.
  const openCount = data?.openCount ?? 0;

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title={title} description={description} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          options={FILTERS.map((f) => ({
            ...f,
            // Only on the tab that means work. A count beside "Closed" is a
            // number nobody acts on.
            count: f.value === "open" ? openCount : undefined,
          }))}
          value={filter}
          onChange={setFilter}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, question or category…"
          className="w-full sm:w-72"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <div className="grid h-[calc(100vh-19rem)] min-h-[26rem] md:grid-cols-[20rem_1fr]">
            {/* ── the threads ────────────────────────────────────────────── */}
            <div
              className={cn(
                "flex min-h-0 flex-col border-r",
                // On a phone the two panes are one screen at a time: the list
                // until something is picked, the conversation after. A 20rem
                // column beside a conversation does not fit, and a stacked list
                // above a chat means scrolling past it to every reply.
                selectedId ? "hidden md:flex" : "flex",
              )}
            >
              <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="divide-y">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex gap-3 px-4 py-3">
                        <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : rows.length === 0 ? (
                  <EmptyState
                    icon={BubbleChatQuestionIcon}
                    message={
                      search.trim()
                        ? "Nothing matches that search."
                        : filter === "open"
                          ? "Nothing waiting. Every question has been answered."
                          : "No conversations here."
                    }
                  />
                ) : (
                  rows.map((row) => (
                    <ThreadRow
                      key={row.id}
                      thread={row}
                      active={row.id === selectedId}
                      onClick={() => {
                        setSelectedId(row.id);
                        // A half-typed reply belongs to the thread it was typed
                        // in. Carrying it across would be a message sent to the
                        // wrong person.
                        setDraft("");
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            {/* ── the conversation ───────────────────────────────────────── */}
            <div
              className={cn(
                "flex min-h-0 flex-col",
                selectedId ? "flex" : "hidden md:flex",
              )}
            >
              {!selectedId ? (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState
                    icon={BubbleChatQuestionIcon}
                    message="Pick a conversation to read it."
                  />
                </div>
              ) : !thread && loadingThread ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : !thread ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  That conversation is no longer there.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 border-b px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="md:hidden"
                      onClick={() => setSelectedId(null)}
                      aria-label="Back to the list"
                    >
                      <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={2} />
                    </Button>

                    <InitialsAvatar
                      seed={thread.userId}
                      label={initials(thread.name ?? "?")}
                      className="size-9 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {thread.name ?? `${thread.userId.slice(0, 8)}…`}
                        </span>
                        <StatusPill
                          status={thread.status}
                          styles={SUPPORT_STATUS_STYLES}
                        />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {categoryLabel(thread.category)} · asked{" "}
                        {relative(thread.createdAt)}
                      </p>
                    </div>

                    {thread.status === "closed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => statusChange.mutate("open")}
                        disabled={statusChange.isPending}
                      >
                        <HugeiconsIcon
                          icon={ArrowTurnBackwardIcon}
                          size={14}
                          strokeWidth={2}
                        />
                        Reopen
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => statusChange.mutate("closed")}
                        disabled={statusChange.isPending}
                      >
                        <HugeiconsIcon
                          icon={CheckmarkCircle02Icon}
                          size={14}
                          strokeWidth={2}
                        />
                        Close
                      </Button>
                    )}
                  </div>

                  {/* The question that started it, pinned above the conversation
                      so it survives scrolling — a long thread otherwise leaves
                      you reading replies with no idea what they are replying to.
                      It IS also the last thing they typed in the funnel, so it
                      appears once more in the transcript below; that repetition
                      is the point of a subject line, not an accident. */}
                  <div className="border-b bg-muted/30 px-4 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Could not be answered by the FAQ
                    </p>
                    <p className="mt-0.5 text-sm">{thread.question}</p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto py-3">
                    {thread.messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                    <div ref={bottomRef} />
                  </div>

                  <div className="border-t p-3">
                    {thread.status === "closed" ? (
                      <p className="px-1 py-2 text-center text-xs text-muted-foreground">
                        This conversation is closed. Reopen it to reply.
                      </p>
                    ) : (
                      <div className="flex items-end gap-2">
                        <textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            // Enter sends, Shift+Enter breaks the line — the
                            // convention every chat app has trained people on.
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              send();
                            }
                          }}
                          rows={2}
                          placeholder="Write a reply… they get a notification on their phone."
                          className="min-h-[2.5rem] flex-1 resize-none rounded-md border border-input bg-input/30 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        />
                        <Button
                          onClick={send}
                          disabled={!draft.trim() || reply.isPending}
                        >
                          <HugeiconsIcon icon={SentIcon} size={16} strokeWidth={2} />
                          {reply.isPending ? "Sending…" : "Send"}
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Notification03Icon, RefreshIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminCounts } from "@/hooks/use-admin-counts";
import { CountBadge, CountDot } from "@/components/dashboard/count-badge";
import {
  WORK_QUEUES,
  arrivalSentence,
  firstWaiting,
  workTotal,
} from "@/components/dashboard/work-queues";
import type { AdminCounts } from "@/lib/counts";
import { INBOX_TABS } from "@/components/dashboard/section-tabs";
import {
  freshIn,
  lowerSeen,
  markSeen,
  readSeen,
  seedSeen,
  seenAsCounts,
  useSeen,
} from "@/lib/seen-counts";
import { cn } from "@/lib/utils";

/** The page a queue lives on, without its filter. The inbox counts on both of its tabs. */
const queuePath = (queue: (typeof WORK_QUEUES)[number]) =>
  queue.count === "support" ? "/dashboard/inbox" : queue.url.split("?")[0];

// WHAT IS WAITING, ON WHATEVER PAGE YOU ARE ON.
//
// The sidebar badges and Home's to-do list both already said this, and neither
// was any use for the thing staff actually need: knowing that something ARRIVED.
// The badges were fetched once per screen and then left alone, and Home is the
// one page nobody is on while they work — so a business that signed up at 10:05
// waited for somebody to reload, and a question sat in the inbox until whoever
// was clearing certificates happened to look somewhere else.
//
// This sits in the header, which is on every page, and it does three things with
// the same polled numbers:
//
//   the count    always visible, so "is there anything" needs no click
//   the list     one click, every queue with its number, linking through
//   the arrival  a banner naming what came in, the moment the poll sees it
//
// IT IS NOT A NOTIFICATION FEED and deliberately reads nothing per-event. There
// is no table of admin notifications on the API and this does not invent one: it
// compares the counts it already fetches against what they were a moment ago,
// which answers "what is new" without anything having to be marked as read. The
// cost of that is honest and worth stating — it cannot tell you about something
// that arrived and was cleared between two polls, and after a reload the
// baseline starts again. Both are fine for a number whose job is to get somebody
// to open a queue.

export function WorkWaiting() {
  const { data: counts, isLoading, isFetching, refetch } = useAdminCounts();

  const total = workTotal(counts);
  const seen = useSeen();

  useArrivalBanner(counts);
  useSinceLastVisit(counts);
  useTitleCount(total);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="relative gap-2"
            aria-label={
              total === 0 ? "Nothing waiting" : `${total} items waiting for review`
            }
          />
        }
      >
        {/* ONE COUNT, the red one on the bell. It carries the number itself,
            so a second badge beside it only said the same thing twice and made
            both harder to read. */}
        <span className="relative inline-flex">
          <HugeiconsIcon icon={Notification03Icon} strokeWidth={2} />
          <CountDot count={total} className="absolute -right-1.5 -top-1.5" />
        </span>

        {isLoading ? (
          <span className="text-xs text-muted-foreground">…</span>
        ) : total === 0 ? (
          <span className="text-xs text-muted-foreground">All clear</span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">Waiting for review</span>
            <span className="text-xs text-muted-foreground">
              {total === 0
                ? "No items waiting."
                : `${total} ${total === 1 ? "item" : "items"} to review.`}
            </span>
          </div>
          {/* A manual check beside the automatic one. Thirty seconds is a long
              time to stare at a number somebody has just been told about on the
              phone. */}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh now"
            disabled={isFetching}
            onClick={(event) => {
              // The menu would close on a plain click, and closing the panel is
              // the opposite of what somebody pressing refresh wants.
              event.preventDefault();
              void refetch();
            }}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              className={cn(isFetching && "animate-spin")}
            />
          </Button>
        </div>

        <ul className="max-h-80 overflow-y-auto py-1">
          {WORK_QUEUES.map((queue) => {
            const count = counts?.[queue.count] ?? 0;
            const fresh = freshIn(seen, counts, queue.count);

            return (
              <li key={queue.url}>
                <Link
                  href={queue.url}
                  className="flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      count === 0 && "text-muted-foreground",
                    )}
                  >
                    {queue.label}
                  </span>
                  {/* What arrived since this queue was last opened. */}
                  {fresh > 0 && (
                    <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-4 text-white">
                      {fresh} new
                    </span>
                  )}
                  {count > 0 ? (
                    <CountBadge count={count} tone="amber" />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {total > 0 && (
          <div className="border-t p-2">
            <Button
              size="sm"
              className="w-full"
              render={<Link href={firstWaiting(counts)} />}
            >
              Start reviewing
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The banner, when a number goes UP.
 *
 *  Built on the rise in each queue rather than on the total, because the total
 *  hides the case that matters: two certificates cleared and one employer
 *  arriving is a total that has gone DOWN, and the employer still needs a phone
 *  call. See arrivalSentence.
 *
 *  THE FIRST ANSWER IS ONLY A BASELINE. Announcing it would mean a banner about
 *  four things waiting every time anybody opened the dashboard, which is not news
 *  — the bell beside it already says so, and a notification that fires on arrival
 *  at a page is one people learn to dismiss without reading. */
function useArrivalBanner(counts: AdminCounts | undefined) {
  const previous = useRef<AdminCounts | null>(null);

  useEffect(() => {
    if (!counts) return;

    const before = previous.current;
    previous.current = counts;

    if (!before) return;

    const sentence = arrivalSentence(before, counts);
    if (!sentence) return;

    // `id` fixed, so two polls in quick succession replace one banner rather than
    // stacking two — and so a staff member who has stepped away comes back to
    // the latest one instead of a wall of them.
    toast.info(sentence, { id: "work-arrived", duration: 8000 });
  }, [counts]);
}

/** What is new since this browser last looked, kept across reloads (see lib/seen-counts).
 *  Says it once when the dashboard opens, and marks the queue on screen as seen. */
function useSinceLastVisit(counts: AdminCounts | undefined) {
  const pathname = usePathname();
  const told = useRef(false);

  useEffect(() => {
    if (!counts) return;

    seedSeen(counts);
    lowerSeen(counts);

    // Once per page load, before the queue on screen is marked: what came in while away.
    if (!told.current) {
      told.current = true;
      const seen = readSeen();
      const sentence = seen ? arrivalSentence(seenAsCounts(seen), counts) : null;
      if (sentence) {
        toast.info(`Since your last visit: ${sentence}.`, {
          id: "work-since-last",
          duration: 12000,
          action: { label: "Open", onClick: () => window.location.assign(firstNew(counts)) },
        });
      }
    }

    // The queue somebody is standing on is seen, including anything that arrives while they are on it.
    for (const queue of WORK_QUEUES) {
      if (pathname.startsWith(queuePath(queue))) markSeen(queue.count, counts[queue.count] ?? 0);
    }
    // The two inbox tabs carry their own counts for the sidebar.
    for (const tab of INBOX_TABS) {
      if (tab.countKey && pathname.startsWith(tab.url)) markSeen(tab.countKey, counts[tab.countKey] ?? 0);
    }
  }, [counts, pathname]);
}

/** The first queue with something new in it. */
function firstNew(counts: AdminCounts) {
  const seen = readSeen();
  return WORK_QUEUES.find((queue) => freshIn(seen, counts, queue.count) > 0)?.url ?? firstWaiting(counts);
}

/** '(3) AdHoc Admin' in the tab title.
 *
 *  For the case the bell cannot reach: this dashboard lives in a background tab
 *  beside a bank statement and an email client for most of the day, and a number
 *  in the tab is the only thing visible from there. The poll deliberately stops
 *  while the tab is hidden — see useAdminCounts — so this shows what was true
 *  when they looked away, which is the honest answer and still the one that gets
 *  them to come back. */
function useTitleCount(total: number) {
  // The PATHNAME is a dependency as well as the count, and it is not decoration.
  // Next sets the title from the route's metadata on every navigation, so
  // clicking through to a queue would drop the prefix and leave it off until the
  // count next changed — up to half a minute of a tab that says nothing is
  // waiting while something is.
  const pathname = usePathname();

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = total > 0 ? `(${total}) ${base}` : base;

    return () => {
      document.title = document.title.replace(/^\(\d+\)\s*/, "");
    };
  }, [total, pathname]);
}

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
import { cn } from "@/lib/utils";

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

  useArrivalBanner(counts);
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
              total === 0 ? "Nothing waiting" : `${total} things waiting on you`
            }
          />
        }
      >
        {/* BOTH THE DOT AND THE NUMBER, and they are not redundant.
            The dot on the corner of the bell is the thing peripheral vision
            catches — it is what "there is something" looks like anywhere on the
            web, and it is the half this screen was missing. The number beside it
            is what decides whether somebody stops what they are doing, because
            one certificate and fourteen are different mornings. */}
        <span className="relative inline-flex">
          <HugeiconsIcon icon={Notification03Icon} strokeWidth={2} />
          <CountDot count={total} className="absolute -right-1.5 -top-1.5" />
        </span>

        {isLoading ? (
          <span className="text-xs text-muted-foreground">…</span>
        ) : total > 0 ? (
          // AMBER here beside a red dot, not a second red one. The dot is the
          // alarm and this is the number it is about; two reds side by side would
          // be the same shout twice and the figure is the part being read.
          <CountBadge count={total} tone="amber" />
        ) : (
          <span className="text-xs text-muted-foreground">All clear</span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">Waiting on you</span>
            <span className="text-xs text-muted-foreground">
              {total === 0
                ? "Nothing to clear."
                : `${total} ${total === 1 ? "thing" : "things"} to clear.`}
            </span>
          </div>
          {/* A manual check beside the automatic one. Thirty seconds is a long
              time to stare at a number somebody has just been told about on the
              phone. */}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Check again now"
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
              Start clearing
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

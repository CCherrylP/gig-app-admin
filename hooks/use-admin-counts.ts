"use client";

import { useQuery } from "@tanstack/react-query";

import { adminCounts } from "@/lib/counts";

// WHAT IS WAITING, AND IT ASKS AGAIN ON ITS OWN.
//
// THE PROBLEM THIS SOLVES. The badges were fetched once when a screen mounted
// and then left alone: the dashboard runs on `staleTime: 30_000` with
// `refetchOnWindowFocus: false` — both deliberate, because the list endpoints are
// whole tables and re-reading them on every alt-tab is what made this thing feel
// slow. The cost was that nothing ever arrived. Somebody working through the
// shifts calendar for an hour saw the same numbers all hour, and a business that
// signed up at 10:05 waited for a page reload to be noticed.
//
// So this ONE query opts out of those defaults, and it is the only one that
// should: /admin/counts is eight `count` queries against indexed columns, which
// is the whole reason it exists. Polling a list endpoint would be the bug those
// defaults were added to fix.
//
// EVERY BADGE READS THROUGH HERE — the sidebar, the review tabs, the inbox tabs,
// the header bell and Home's to-do list. They share the query key, so it is one
// request between all of them however many are on screen; and having one hook
// means the interval is a decision made once rather than a prop somebody forgets
// on the next screen.

/** The shared key. Anything that changes a queue invalidates it — see the
 *  MutationCache in providers/QueryClientProvider, which does that for every
 *  mutation in the app rather than asking each screen to remember. */
export const COUNTS_KEY = ["admin", "counts"] as const;

/** How often to ask. Thirty seconds against how this is actually used: staff
 *  leave the dashboard open beside a bank statement and an email client, and the
 *  thing they want to know is that something came in while they were elsewhere.
 *  A minute is long enough to miss a phone call about it; ten seconds is three
 *  times the requests for no decision made any sooner. */
const POLL_MS = 30_000;

export function useAdminCounts() {
  return useQuery({
    queryKey: COUNTS_KEY,
    queryFn: adminCounts,

    refetchInterval: POLL_MS,
    // NOT in a hidden tab. A dashboard left open overnight in a background tab
    // would otherwise make three thousand requests before anybody looked at it,
    // and the answer it wants is the one from the moment they come back — which
    // the focus refetch below provides for nothing.
    refetchIntervalInBackground: false,
    // ON, against the app-wide default of off. That default is right for the
    // queues and wrong for this: coming back from somewhere else is exactly the
    // moment somebody wants to know what arrived, and the answer costs eight
    // counts.
    refetchOnWindowFocus: true,
    // Zero, so the focus refetch above is not silently swallowed by the thirty
    // seconds of freshness the rest of the app is given.
    staleTime: 0,
  });
}

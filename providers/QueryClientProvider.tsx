"use client";

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

// THE SIDEBAR BADGES REFRESH AFTER ANY DECISION, wherever it was made.
//
// The badges come from /admin/counts now rather than from the six list
// endpoints, which means the pages' own `invalidateQueries` calls no longer
// touch them: approving a certificate refreshed the certificate queue and left
// the number beside it stale.
//
// Done here rather than by adding a second invalidate to every mutation,
// because that is a line somebody has to remember on every new screen and the
// symptom of forgetting it — a badge that is quietly wrong — is one nobody
// notices for weeks. A MutationCache callback fires IN ADDITION to a mutation's
// own onSuccess rather than replacing it, so nothing on the pages changes.
const mutationCache = new MutationCache({
  onSuccess: () => {
    void client.invalidateQueries({ queryKey: ["admin", "counts"] });
  },
});

// HOW OFTEN THIS DASHBOARD IS ALLOWED TO ASK AGAIN.
//
// It ran on the library's defaults, which are built for small, cheap queries:
// `staleTime: 0` marks every answer stale the instant it lands, and
// `refetchOnWindowFocus` is on. Neither assumption holds here. These queues are
// whole tables with joins — none of the admin list endpoints page — so every
// move between pages, and every alt-tab back from a bank statement or an email,
// re-ran the lot. The dashboard felt slow because it was genuinely refetching
// constantly, not because any single request was pathological.
//
// Thirty seconds is chosen against how these queues are actually worked: a
// reviewer clears a certificate, looks at appeals, comes back. That round trip
// is well under a minute and there is no reason to re-read the queue for it.
// Anything that CHANGES a queue already calls invalidateQueries itself — see the
// mutations on each page — so a decision still refreshes the list at once. This
// only stops the re-reads nobody asked for.
const client = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // The one that bites hardest. Staff keep this open beside other windows,
      // so focus events are constant and each was a full reload of the queue.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // One retry, not three. A failing admin request is usually the API being
      // down or the session being over, and three doomed attempts with backoff
      // turn a fast failure into a long hang before the error appears.
      retry: 1,
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

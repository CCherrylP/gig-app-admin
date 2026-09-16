import type { QueryClient, QueryKey } from "@tanstack/react-query";

// Opening a document that is behind a SHORT-LIVED signed link.
//
// THE BUG THIS EXISTS TO FIX. Every file in these queues — a certificate, an
// MC, a payment receipt — lives in a private bucket, so the API cannot send a
// URL. It sends a signed one that lives ten minutes (SIGNED_URL_TTL_S in the
// API's lib/storage), which is deliberate: these are identity and health
// records, and a link that outlived the reason it was issued would be access
// with no way to revoke it.
//
// The consequence is that the URL in a list goes stale WHILE THE PAGE IS OPEN.
// A reviewer who loads the queue, works two appeals, and then clicks the third
// one's document at minute eleven gets handed a dead token, and Supabase answers
// with the raw JSON `InvalidJWT: "exp" claim timestamp check failed` — which
// reads to the reviewer as the dashboard being broken.
//
// So the link is minted AT THE MOMENT IT IS USED rather than when the list drew.
// The API re-signs on every GET, so re-running the same query is all it takes.
// The API's own contract says as much: "it cannot be a durable reference to the
// file — re-fetch the queue to get a fresh one rather than storing this
// anywhere." This is that re-fetch.

/** Open a fresh signed link in a new tab.
 *
 *  `select` pulls the one URL out of the re-fetched response — by id rather than
 *  by position, because the queue is re-sorted server-side and the row that was
 *  third when the page drew may not be third now. */
export async function openFreshDocument<T>({
  queryClient,
  queryKey,
  queryFn,
  select,
  onMissing,
}: {
  queryClient: QueryClient;
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  select: (data: T) => string | null | undefined;
  onMissing?: () => void;
}): Promise<void> {
  // The tab is opened SYNCHRONOUSLY, before any await. A window.open() that runs
  // after a promise resolves has lost the user-gesture that permits it, and
  // every browser blocks it as a popup — so the tab is claimed first and its
  // location set once the URL arrives.
  //
  // NO `noopener` IN THE FEATURES STRING, and that is not an oversight. The spec
  // says window.open() returns NULL whenever noopener is set — there is no
  // handle to hand back, which is the entire point of the flag. Passing it here
  // meant `tab` was always null: the browser opened the blank tab anyway, the
  // `if (tab)` below never ran, and the fallback redirected THIS page to the
  // document. So every receipt and certificate opened a blank tab and threw the
  // reviewer off the queue they were working.
  //
  // The opener is severed on the line below instead, which gets both: a handle
  // to point at the URL, and a new tab that cannot reach back into this one.
  const tab = window.open("", "_blank");

  if (tab) tab.opener = null;

  try {
    const data = await queryClient.fetchQuery({
      queryKey,
      queryFn,
      // Never a cached answer: a cached one carries the stale URL that is the
      // whole problem.
      staleTime: 0,
    });

    const url = select(data);

    if (!url) {
      tab?.close();
      onMissing?.();
      return;
    }

    if (tab) tab.location.href = url;
    // A blocked popup is not a failure worth an error — fall back to navigating
    // this tab, which is what the user asked for either way.
    else window.location.href = url;
  } catch {
    tab?.close();
    onMissing?.();
  }
}

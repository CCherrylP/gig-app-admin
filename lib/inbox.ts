import { fetchWithAuth } from "./api";

// GET /admin/support and the reply that empties it.
//
// Shapes copied from gig-app-api's contract/admin.ts and contract/support.ts —
// the two repos share no package. Keep them in step.
//
// WHAT IS IN THIS QUEUE. Only questions the FAQ already failed to answer, and
// only ones the person then deliberately escalated from the dead end in the app.
// So a row here is somebody who looked and could not find it, which is why the
// list is short enough to work as a conversation rather than as a ticket system.

export type SupportStatus = "open" | "answered" | "closed";
export type SupportFilter = SupportStatus | "all";
export type SupportRole = "candidate" | "employer";

/** `bot` is the FAQ funnel itself. Rendered differently from both sides of the
 *  conversation because it is neither: it is what was already tried. */
export type SupportAuthor = "user" | "bot" | "admin";

export interface SupportMessage {
  id: string;
  author: SupportAuthor;
  body: string;
  createdAt: string;
  /** Null is unread. On a `user` message that means staff have not opened the
   *  thread yet; opening it stamps them. */
  readAt: string | null;
}

export interface SupportThreadSummary {
  id: string;
  userId: string;
  /** Null on an account that never finished setup — itself a common reason for
   *  writing in, so the list falls back to the id rather than an empty row. */
  name: string | null;
  role: SupportRole;
  /** The category slug they picked in the app — 'payments'. */
  category: string;
  /** What the FAQ could not answer. The line the queue is read by. */
  question: string;
  status: SupportStatus;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  /** Messages from them that staff have not read. The badge on the row. */
  unreadCount: number;
}

export type SupportThread = SupportThreadSummary & {
  messages: SupportMessage[];
};

export interface SupportThreadsResponse {
  threads: SupportThreadSummary[];
  /** Threads still `open`, ignoring the status filter — so the sidebar badge and
   *  the Open tab's count do not drop to zero when somebody switches to Closed.
   *  Respects `role`, so asking for neither gives the total across both inboxes. */
  openCount: number;
}

export interface SupportThreadResponse {
  thread: SupportThread;
}

/** `role` is optional so the sidebar can ask for BOTH inboxes in one request
 *  rather than two — the badge is a single number and does not care which side
 *  the work is on. The pages always pass one. */
export function listSupportThreads(
  role?: SupportRole,
  status: SupportFilter = "all",
) {
  const query = new URLSearchParams();
  if (role) query.set("role", role);
  // 'all' is the absence of the filter, not a value the API knows.
  if (status !== "all") query.set("status", status);

  const suffix = query.toString();
  return fetchWithAuth<SupportThreadsResponse>(
    `/admin/support${suffix ? `?${suffix}` : ""}`,
  );
}

/** Reading a thread MARKS IT READ server-side — there is no separate acknowledge
 *  call, because a thread on screen has been read and a second action is one
 *  more thing to forget. Callers must invalidate the list after this or the
 *  unread badges stay stale. */
export function getSupportThread(id: string) {
  return fetchWithAuth<SupportThreadResponse>(`/admin/support/${id}`);
}

/** The reply, which is also what notifies them: the API writes an Inbox row and
 *  fires a push at their phone. Moves the thread to `answered`. */
export function replyToSupportThread(id: string, body: string) {
  return fetchWithAuth<SupportThreadResponse>(`/admin/support/${id}/reply`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

/** Closing, and reopening something closed by mistake. Deliberately silent —
 *  the person is not notified, because "your question was closed" with no answer
 *  attached reads as being dismissed. */
export function setSupportThreadStatus(id: string, status: SupportStatus) {
  return fetchWithAuth<SupportThreadResponse>(`/admin/support/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// The category catalogue, mirrored from the app's Help & Support menu for the
// same reason as APPEAL_GROUNDS in lib/appeals: the API sends a SLUG, and
// 'gigs-and-shifts' is not a heading anybody wants to read in a queue. An
// unknown slug is title-cased rather than dropped, so a category added in the
// app shows up here readable without a deploy.
export const SUPPORT_CATEGORIES: Record<string, string> = {
  account: "Account",
  payments: "Payments",
  "gigs-and-shifts": "Gigs & shifts",
  certificates: "Certificates",
  "clock-in": "Clock in & out",
  penalties: "Penalties & appeals",
  safety: "Safety",
  employers: "Hiring",
  other: "Something else",
};

export const categoryLabel = (slug: string) =>
  SUPPORT_CATEGORIES[slug] ??
  slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const SUPPORT_STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ANSWERED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  CLOSED: "bg-muted text-muted-foreground",
};
